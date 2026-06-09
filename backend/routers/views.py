import json
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session, DatabaseView, Database, DatabaseRecord
from services.query_engine import QueryEngine

router = APIRouter(prefix="/api/views", tags=["views"])

@router.get("")
def list_views(session: Session = Depends(get_session)):
    """Returns a list of all database views."""
    views = session.exec(select(DatabaseView)).all()
    
    result = []
    for v in views:
        db = session.query(Database).filter(Database.id == v.database_id).first()
        result.append({
            "id": v.id,
            "database_id": v.database_id,
            "database_name": db.name if db else "Unknown",
            "name": v.name,
            "layout_type": v.layout_type,
            "filters": json.loads(v.filters) if v.filters else {},
            "sorts": json.loads(v.sorts) if v.sorts else [],
            "grouping": json.loads(v.grouping) if v.grouping else {},
            "visible_properties": json.loads(v.visible_properties) if v.visible_properties else []
        })
    return result

@router.get("/{view_id}")
def get_view(view_id: str, session: Session = Depends(get_session)):
    """Gets details for a specific view."""
    v = session.query(DatabaseView).filter(DatabaseView.id == view_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="View not found")
        
    db = session.query(Database).filter(Database.id == v.database_id).first()
    return {
        "id": v.id,
        "database_id": v.database_id,
        "database_name": db.name if db else "Unknown",
        "name": v.name,
        "layout_type": v.layout_type,
        "filters": json.loads(v.filters) if v.filters else {},
        "sorts": json.loads(v.sorts) if v.sorts else [],
        "grouping": json.loads(v.grouping) if v.grouping else {},
        "visible_properties": json.loads(v.visible_properties) if v.visible_properties else [],
        "properties": json.loads(db.properties) if db else []
    }

@router.post("")
def upsert_view(config: Dict[str, Any], session: Session = Depends(get_session)):
    """Creates a new view or updates an existing one."""
    view_id = config.get("id")
    
    if view_id:
        existing = session.query(DatabaseView).filter(DatabaseView.id == view_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="View not found")
        view = existing
    else:
        view = DatabaseView()
        
    if config.get("database_id"):
        view.database_id = config["database_id"]
    else:
        db = session.exec(select(Database)).first()
        if db:
            view.database_id = db.id
        else:
            raise HTTPException(status_code=400, detail="No database found to bind view to")
    if "name" in config: view.name = config["name"]
    if "layout_type" in config: view.layout_type = config["layout_type"]
    if "filters" in config: view.filters = json.dumps(config["filters"])
    if "sorts" in config: view.sorts = json.dumps(config["sorts"])
    if "grouping" in config: view.grouping = json.dumps(config["grouping"])
    if "visible_properties" in config: view.visible_properties = json.dumps(config["visible_properties"])
    
    session.add(view)
    session.commit()
    session.refresh(view)
    
    return {"status": "success", "id": view.id}

@router.post("/{view_id}/update-config")
def update_view_config(config: Dict[str, Any], view_id: str, session: Session = Depends(get_session)):
    """Updates only query configurations on the fly."""
    view = session.query(DatabaseView).filter(DatabaseView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
        
    if "filters" in config: view.filters = json.dumps(config["filters"])
    if "sorts" in config: view.sorts = json.dumps(config["sorts"])
    if "grouping" in config: view.grouping = json.dumps(config["grouping"])
    if "visible_properties" in config: view.visible_properties = json.dumps(config["visible_properties"])
    
    session.add(view)
    session.commit()
    
    return {"status": "success", "id": view.id}

@router.delete("/{view_id}")
def delete_view(view_id: str, session: Session = Depends(get_session)):
    """Deletes a custom database view."""
    view = session.query(DatabaseView).filter(DatabaseView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    session.delete(view)
    session.commit()
    return {"status": "success"}

@router.post("/{view_id}/execute")
def execute_view(view_id: str, session: Session = Depends(get_session)):
    """Executes the query engine pipeline for the view parameters."""
    try:
        result = QueryEngine.execute_view(session, view_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
