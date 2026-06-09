import os
import json
import uuid
from datetime import datetime
from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel, create_engine, Session
from sqlalchemy import text

# Database configuration
sqlite_file_name = "intheflow.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

# Model Definitions
class Project(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = Field(default=None)
    color: str = Field(default="#3B82F6")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    tasks: List["Task"] = Relationship(back_populates="project")

class Task(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    status: str = Field(default="backlog", index=True) # backlog, ready_to_start, in_progress, on_hold, done
    category: str = Field(default="business", index=True) # business, dev
    source: str = Field(default="user_created") # notion_arch, planning
    owner: Optional[str] = Field(default="Alice", index=True)
    task_grouping: Optional[str] = Field(default="General", index=True)
    archived: bool = Field(default=False, index=True)
    
    # Time Tracking
    estimated_duration: Optional[int] = Field(default=None) # in minutes
    current_duration: Optional[int] = Field(default=0) # in minutes
    
    # Foreign Keys
    project_id: Optional[str] = Field(default=None, foreign_key="project.id", index=True)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    project: Optional[Project] = Relationship(back_populates="tasks")

class AiLog(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    action: str = Field(index=True)
    prompt: str = Field(default="")
    response: str = Field(default="")
    tokens_used: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Database(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True, unique=True)
    icon: Optional[str] = Field(default=None)
    properties: str = Field(default="[]") # JSON string defining fields
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DatabaseRecord(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    database_id: str = Field(foreign_key="database.id", index=True)
    property_values: str = Field(default="{}") # JSON string of values
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DatabaseView(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    database_id: str = Field(foreign_key="database.id", index=True)
    name: str = Field(index=True)
    layout_type: str = Field(default="board") # table, board, calendar, timeline, list
    filters: str = Field(default="{}") # JSON filter AST
    sorts: str = Field(default="[]") # JSON sorting rules
    grouping: str = Field(default="{}") # JSON containing group_by and subgroup_by
    visible_properties: str = Field(default="[]") # JSON list of visible field names
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DailyTask(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    task_id: Optional[str] = Field(default=None, foreign_key="task.id", index=True)
    date: str = Field(index=True)  # YYYY-MM-DD local
    start_time: str  # HH:mm
    end_time: str    # HH:mm
    title: Optional[str] = Field(default=None)
    owner: Optional[str] = Field(default="Alice", index=True)  # Alice | Bob | Shared
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Seeding Logic
DEFAULT_PROJECTS = [
    {"name": "Sample Project", "color": "#3B82F6", "description": "Production DDD/CQRS/Event Sourcing platform"}
]

def clean_project_name(raw_name: str) -> str:
    if "(" in raw_name:
        return raw_name.split("(")[0].strip()
    return raw_name.strip()

VALID_TASK_STATUSES = frozenset({
    "backlog",
    "ready_to_start",
    "in_progress",
    "on_hold",
    "done",
})

STATUS_ALIASES = {
    "todo": "backlog",
    "to_do": "backlog",
    "not_started": "backlog",
    "pending": "backlog",
    "open": "backlog",
    "ready": "ready_to_start",
    "wip": "in_progress",
    "in-progress": "in_progress",
    "hold": "on_hold",
    "on-hold": "on_hold",
    "complete": "done",
    "completed": "done",
}


def validate_task_status(raw_status: str) -> str:
    """Return a canonical task status or raise ValueError."""
    if raw_status is None:
        return "backlog"

    normalized = str(raw_status).strip().lower()
    if not normalized:
        return "backlog"

    if normalized in VALID_TASK_STATUSES:
        return normalized

    if normalized in STATUS_ALIASES:
        return STATUS_ALIASES[normalized]

    valid_list = ", ".join(sorted(VALID_TASK_STATUSES))
    alias_list = ", ".join(sorted(STATUS_ALIASES.keys()))
    raise ValueError(
        f"Invalid task status '{raw_status}'. "
        f"Valid: {valid_list}. Aliases: {alias_list}"
    )


def normalize_status(raw_status: str) -> str:
    """Permissive normalization for seed/import sources."""
    try:
        return validate_task_status(raw_status)
    except ValueError:
        status_lower = raw_status.lower()
        if "progress" in status_lower:
            return "in_progress"
        if "start" in status_lower:
            return "ready_to_start"
        if "prioritized" in status_lower:
            return "ready_to_start"
        if "hold" in status_lower:
            return "on_hold"
        if status_lower in ("done", "complete", "completed"):
            return "done"
        return "backlog"

def seed_database(session: Session):
    # 1. Seed Projects
    project_map = {}
    for p_info in DEFAULT_PROJECTS:
        existing = session.query(Project).filter(Project.name == p_info["name"]).first()
        if not existing:
            project = Project(name=p_info["name"], color=p_info["color"], description=p_info["description"])
            session.add(project)
            session.commit()
            session.refresh(project)
            project_map[project.name] = project.id
        else:
            project_map[existing.name] = existing.id

    # 2. Seed Tasks if empty
    task_count = session.query(Task).count()
    if task_count == 0:
        seed_file = os.path.join(os.path.dirname(__file__), "seed_tasks.json")
        if os.path.exists(seed_file):
            try:
                with open(seed_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                # Seed Business Tasks
                for t_info in data.get("business", []):
                    proj_name = clean_project_name(t_info["project"])
                    proj_id = next(iter(project_map.values()), None)
                    task = Task(
                        name=t_info["name"],
                        status=normalize_status(t_info["status"]),
                        category="business",
                        source=t_info["source"],
                        project_id=proj_id
                    )
                    session.add(task)
                    
                # Seed Technical Tasks
                for t_info in data.get("technical", []):
                    proj_name = clean_project_name(t_info["project"])
                    proj_id = next(iter(project_map.values()), None)
                    task = Task(
                        name=t_info["name"],
                        status=normalize_status(t_info["status"]),
                        category="dev",
                        source=t_info["source"],
                        project_id=proj_id
                    )
                    session.add(task)
                    
                session.commit()
                print("Database seeded successfully.")
            except Exception as e:
                print(f"Error seeding database: {e}")
        else:
            print(f"Seed file not found at: {seed_file}")

    # 3. Migrate and Seed Dynamic Databases
    db_count = session.query(Database).count()
    if db_count == 0:
        print("Dynamic Database schema is empty. Performing migration...")
        try:
            # Create Projects Database
            proj_db_id = str(uuid.uuid4())
            proj_db = Database(
                id=proj_db_id,
                name="Projects Workspace",
                icon="📁",
                properties=json.dumps([
                    {"name": "Name", "type": "title"},
                    {"name": "Description", "type": "text"},
                    {"name": "Color", "type": "text"}
                ])
            )
            session.add(proj_db)
            
            # Create Tasks Database
            task_db_id = str(uuid.uuid4())
            task_db = Database(
                id=task_db_id,
                name="Tasks Workspace",
                icon="📋",
                properties=json.dumps([
                    {"name": "Name", "type": "title"},
                    {"name": "Description", "type": "text"},
                    {"name": "Status", "type": "status", "options": ["backlog", "ready_to_start", "in_progress", "on_hold", "done"]},
                    {"name": "Category", "type": "select", "options": ["business", "dev"]},
                    {"name": "Source", "type": "select", "options": ["user_created", "notion_arch", "planning"]},
                    {"name": "Owner", "type": "select", "options": ["Alice", "Bob", "Shared"]},
                    {"name": "TaskGrouping", "type": "select", "options": ["API", "Backend", "Frontend", "DevOps", "Design", "Infrastructure", "Testing", "Documentation"]},
                    {"name": "Estimated Duration", "type": "number"},
                    {"name": "Current Duration", "type": "number"},
                    {"name": "Project", "type": "relation", "database_id": proj_db_id},
                    {"name": "Archived", "type": "checkbox"},
                    {"name": "Remaining Duration", "type": "formula", "formula_expression": "prop('Estimated Duration') - prop('Current Duration')"}
                ])
            )
            session.add(task_db)
            session.commit()
            
            # Migrate Projects to DatabaseRecord
            all_projects = session.query(Project).all()
            for p in all_projects:
                rec = DatabaseRecord(
                    id=p.id,
                    database_id=proj_db_id,
                    property_values=json.dumps({
                        "Name": p.name,
                        "Description": p.description or "",
                        "Color": p.color
                    })
                )
                session.add(rec)
                
            # Migrate Tasks to DatabaseRecord
            all_tasks = session.query(Task).all()
            for t in all_tasks:
                rec = DatabaseRecord(
                    id=t.id,
                    database_id=task_db_id,
                    property_values=json.dumps({
                        "Name": t.name,
                        "Description": t.description or "",
                        "Status": t.status,
                        "Category": t.category,
                        "Source": t.source,
                        "Owner": t.owner or "Alice",
                        "TaskGrouping": t.task_grouping or "General",
                        "Estimated Duration": t.estimated_duration or 60,
                        "Current Duration": t.current_duration or 0,
                        "Project": [t.project_id] if t.project_id else [],
                        "Archived": t.archived
                    })
                )
                session.add(rec)
                       # Create Default Views
            views = [
                DatabaseView(
                    id=str(uuid.uuid4()),
                    database_id=task_db_id,
                    name="Sprint Board",
                    layout_type="board",
                    grouping=json.dumps({"group_by": "Status", "subgroup_by": None}),
                    filters=json.dumps({
                        "operator": "and",
                        "rules": [
                            {"property": "Archived", "condition": "equals", "value": "false"}
                        ]
                    }),
                    sorts=json.dumps([]),
                    visible_properties=json.dumps(["Name", "Status", "Category", "Owner", "TaskGrouping", "Project", "Remaining Duration"])
                ),
                DatabaseView(
                    id=str(uuid.uuid4()),
                    database_id=task_db_id,
                    name="Backlog Table",
                    layout_type="table",
                    grouping=json.dumps({}),
                    filters=json.dumps({
                        "operator": "and",
                        "rules": [
                            {"property": "Archived", "condition": "equals", "value": "false"}
                        ]
                    }),
                    sorts=json.dumps([]),
                    visible_properties=json.dumps(["Name", "Status", "Category", "Owner", "TaskGrouping", "Project", "Remaining Duration"])
                ),
                DatabaseView(
                    id=str(uuid.uuid4()),
                    database_id=task_db_id,
                    name="AI Flow Hub List",
                    layout_type="list",
                    grouping=json.dumps({}),
                    filters=json.dumps({
                        "operator": "and",
                        "rules": [
                            {"property": "Archived", "condition": "equals", "value": "false"}
                        ]
                    }),
                    sorts=json.dumps([]),
                    visible_properties=json.dumps(["Name", "Status", "Category", "Owner", "TaskGrouping", "Remaining Duration"])
                ),
                DatabaseView(
                    id=str(uuid.uuid4()),
                    database_id=task_db_id,
                    name="Archived Tasks History",
                    layout_type="table",
                    grouping=json.dumps({}),
                    filters=json.dumps({
                        "operator": "and",
                        "rules": [
                            {"property": "Archived", "condition": "equals", "value": "true"}
                        ]
                    }),
                    sorts=json.dumps([]),
                    visible_properties=json.dumps(["Name", "Status", "Category", "Owner", "TaskGrouping", "Project", "Remaining Duration"])
                )
            ]
            for v in views:
                session.add(v)
                
            session.commit()
            print("Dynamic Database seeded and migrated successfully.")
        except Exception as e:
            session.rollback()
            print(f"Error seeding dynamic databases: {e}")

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # Set WAL Mode
    with Session(engine) as session:
        session.exec(text("PRAGMA journal_mode=WAL;"))
        session.commit()
        migrate_daily_task_schema(session)
    
    # Run Seeding
    with Session(engine) as session:
        seed_database(session)


def migrate_daily_task_schema(session: Session) -> None:
    """Add dailytask.owner column and backfill from linked tasks when missing."""
    try:
        rows = session.exec(text("PRAGMA table_info(dailytask);")).all()
        col_names = set()
        for row in rows:
            if isinstance(row, tuple):
                col_names.add(row[1])
            else:
                col_names.add(row[1] if hasattr(row, "__getitem__") else row.name)

        if "owner" not in col_names:
            session.exec(text("ALTER TABLE dailytask ADD COLUMN owner TEXT DEFAULT 'Alice';"))
            session.commit()
            print("Migrated dailytask: added owner column.")

        session.exec(
            text(
                """
                UPDATE dailytask
                SET owner = (
                    SELECT task.owner FROM task WHERE task.id = dailytask.task_id
                )
                WHERE task_id IS NOT NULL
                  AND (owner IS NULL OR owner = '')
                """
            )
        )
        session.exec(
            text(
                """
                UPDATE dailytask
                SET owner = 'Alice'
                WHERE owner IS NULL OR owner = ''
                """
            )
        )
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Daily task schema migration skipped or failed: {e}")

def sync_task_to_record(session: Session, task: Task):
    """Ensures a legacy Task has a synchronized dynamic DatabaseRecord."""
    task_db = session.query(Database).filter(Database.name == "Tasks Workspace").first()
    if not task_db:
        return
    
    rec = session.query(DatabaseRecord).filter(DatabaseRecord.id == task.id).first()
    if not rec:
        rec = DatabaseRecord(id=task.id, database_id=task_db.id)
        
    rec.property_values = json.dumps({
        "Name": task.name,
        "Description": task.description or "",
        "Status": task.status,
        "Category": task.category,
        "Source": task.source,
        "Owner": task.owner or "Alice",
        "TaskGrouping": task.task_grouping or "General",
        "Estimated Duration": task.estimated_duration or 0,
        "Current Duration": task.current_duration or 0,
        "Project": [task.project_id] if task.project_id else [],
        "Archived": task.archived
    })
    session.add(rec)
    session.commit()

