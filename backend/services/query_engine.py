import re
import json
from typing import List, Dict, Any, Optional
from functools import cmp_to_key
from sqlmodel import Session, select
from database import DatabaseRecord, Database

def evaluate_formula(expression: str, values: Dict[str, Any]) -> Any:
    """Safely evaluates a basic mathematical/string formula expression in Python."""
    if not expression:
        return 0
        
    # Replace prop("...") or prop('...') with its value
    def replace_prop(match):
        prop_name = match.group(1)
        val = values.get(prop_name, 0)
        if val is None:
            return "0"
        if isinstance(val, (int, float)):
            return str(val)
        return repr(str(val))
    
    # Match prop("name") or prop('name')
    expr = re.sub(r"prop\(['\"](.*?)['\"]\)", replace_prop, expression)
    
    # Sanitize: allow only standard arithmetic characters, parentheses, numbers, and strings
    # Ensure no dangerous commands are run
    cleaned = re.sub(r"[0-9\+\-\*\/\.\(\)\s\'\"]", "", expr)
    if cleaned == "":
        try:
            return eval(expr, {"__builtins__": None}, {})
        except Exception:
            return 0
    return expr

def evaluate_rollups(record_values: Dict[str, Any], properties: List[Dict[str, Any]], session: Session) -> Dict[str, Any]:
    """Computes rollups and formulas for a record by traversing relations."""
    computed = dict(record_values)
    
    for prop in properties:
        prop_name = prop["name"]
        prop_type = prop["type"]
        
        # 1. Rollup property calculations
        if prop_type == "rollup":
            relation_field = prop.get("relation_property")
            target_field = prop.get("target_property")
            agg_func = prop.get("aggregation", "show_original")
            
            # Get related record IDs
            related_ids = record_values.get(relation_field, [])
            if not isinstance(related_ids, list):
                related_ids = [related_ids] if related_ids else []
                
            if not related_ids:
                computed[prop_name] = 0 if agg_func in ["sum", "average", "count"] else ""
                continue
                
            # Query related records
            related_records = session.exec(
                select(DatabaseRecord).where(DatabaseRecord.id.in_(related_ids))
            ).all()
            
            # Extract target values
            vals = []
            for r in related_records:
                vals_dict = json.loads(r.property_values)
                v = vals_dict.get(target_field)
                if v is not None:
                    vals.append(v)
            
            # Aggregate
            if agg_func == "sum":
                computed[prop_name] = sum(float(x) for x in vals if str(x).replace(".", "", 1).isdigit())
            elif agg_func == "average":
                num_vals = [float(x) for x in vals if str(x).replace(".", "", 1).isdigit()]
                computed[prop_name] = sum(num_vals) / len(num_vals) if num_vals else 0
            elif agg_func == "count":
                computed[prop_name] = len(vals)
            else: # show_original
                computed[prop_name] = vals[0] if len(vals) == 1 else vals
                
        # 2. Formula property calculations
        elif prop_type == "formula":
            formula_expr = prop.get("formula_expression", "")
            computed[prop_name] = evaluate_formula(formula_expr, computed)
            
    return computed

def matches_filter(record: Dict[str, Any], filter_group: Dict[str, Any]) -> bool:
    """Recursively checks if a record matches nested filter groups."""
    if not filter_group or "operator" not in filter_group:
        return True
        
    operator = filter_group.get("operator", "and").lower()
    rules = filter_group.get("rules", [])
    
    if not rules:
        return True
        
    results = []
    for rule in rules:
        if "operator" in rule:
            # Nested filter group
            results.append(matches_filter(record, rule))
        else:
            # Rule comparison
            prop_name = rule.get("property")
            cond = rule.get("condition", "equals")
            target_val = rule.get("value")
            
            val = record.get(prop_name)
            
            if cond == "equals":
                results.append(str(val).lower() == str(target_val).lower())
            elif cond == "contains":
                results.append(str(target_val).lower() in str(val).lower())
            elif cond == "starts_with":
                results.append(str(val).lower().startswith(str(target_val).lower()))
            elif cond == "is_empty":
                results.append(val is None or val == "" or val == [])
            elif cond == "is_not_empty":
                results.append(not (val is None or val == "" or val == []))
            elif cond == "greater_than":
                try:
                    results.append(float(val) > float(target_val))
                except Exception:
                    results.append(False)
            elif cond == "less_than":
                try:
                    results.append(float(val) < float(target_val))
                except Exception:
                    results.append(False)
            else:
                results.append(True)
                
    if operator == "or":
        return any(results)
    return all(results)

def sort_records(records: List[Dict[str, Any]], sort_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sorts record dicts according to priority list of sort rules."""
    if not sort_rules:
        return records
        
    def compare(r1, r2):
        for rule in sort_rules:
            prop_name = rule.get("property")
            direction = rule.get("direction", "asc").lower()
            
            v1 = r1.get(prop_name)
            v2 = r2.get(prop_name)
            
            if v1 is None: v1 = ""
            if v2 is None: v2 = ""
            
            if v1 != v2:
                if direction == "desc":
                    return 1 if v1 < v2 else -1
                else:
                    return -1 if v1 < v2 else 1
        return 0
        
    return sorted(records, key=cmp_to_key(compare))

def group_records(records: List[Dict[str, Any]], grouping_rules: Dict[str, Any]) -> Dict[str, Any]:
    """Arranges flat records into structured subgroups based on primary/sub keys."""
    group_by = grouping_rules.get("group_by")
    subgroup_by = grouping_rules.get("subgroup_by")
    
    if not group_by:
        return {"grouped": False, "records": records}
        
    grouped = {}
    for r in records:
        g_val = r.get(group_by)
        if isinstance(g_val, list):
            g_val = g_val[0] if g_val else "None"
        g_val = str(g_val) if g_val is not None else "None"
        
        if g_val not in grouped:
            grouped[g_val] = []
        grouped[g_val].append(r)
        
    if subgroup_by:
        for g_val, g_recs in grouped.items():
            subgrouped = {}
            for r in g_recs:
                sg_val = r.get(subgroup_by)
                if isinstance(sg_val, list):
                    sg_val = sg_val[0] if sg_val else "None"
                sg_val = str(sg_val) if sg_val is not None else "None"
                
                if sg_val not in subgrouped:
                    subgrouped[sg_val] = []
                subgrouped[sg_val].append(r)
            grouped[g_val] = subgrouped
            
    return {
        "grouped": True,
        "group_by": group_by,
        "subgroup_by": subgroup_by,
        "groups": grouped
    }

class QueryEngine:
    @staticmethod
    def execute_view(session: Session, view_id: str) -> Dict[str, Any]:
        """Query primary database, calculate properties, apply sorting, filtering and grouping."""
        from database import DatabaseView
        
        # 1. Fetch View Config
        view = session.query(DatabaseView).filter(DatabaseView.id == view_id).first()
        if not view:
            raise ValueError(f"View {view_id} not found.")
            
        # 2. Fetch Database properties
        db = session.query(Database).filter(Database.id == view.database_id).first()
        properties = json.loads(db.properties) if db else []
        
        # 3. Load Database Records
        raw_records = session.exec(
            select(DatabaseRecord).where(DatabaseRecord.database_id == view.database_id)
        ).all()
        
        # 4. Parse property values and evaluate formulas/rollups
        computed_records = []
        for r in raw_records:
            vals = json.loads(r.property_values)
            # Add implicit ID field
            vals["id"] = r.id
            # Resolve computed fields
            computed_vals = evaluate_rollups(vals, properties, session)
            computed_records.append(computed_vals)
            
        # 5. Apply Filter AST
        filters = json.loads(view.filters) if view.filters else {}
        filtered_records = [r for r in computed_records if matches_filter(r, filters)]
        
        # 6. Apply Sort priority
        sorts = json.loads(view.sorts) if view.sorts else []
        sorted_records = sort_records(filtered_records, sorts)
        
        # 7. Apply Grouping (Columns & Swimlanes)
        grouping = json.loads(view.grouping) if view.grouping else {}
        grouped_result = group_records(sorted_records, grouping)
        
        # Append meta
        grouped_result["view_name"] = view.name
        grouped_result["layout_type"] = view.layout_type
        grouped_result["visible_properties"] = json.loads(view.visible_properties) if view.visible_properties else []
        
        return grouped_result
