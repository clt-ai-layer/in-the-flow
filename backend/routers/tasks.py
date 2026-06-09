from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from database import Task, DailyTask, get_session, DatabaseRecord, sync_task_to_record, validate_task_status

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

@router.get("", response_model=List[Task])
def list_tasks(
    category: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    include_archived: bool = False,
    session: Session = Depends(get_session)
):
    query = select(Task)
    
    if not include_archived:
        query = query.where(Task.archived == False)
    if category:
        query = query.where(Task.category == category)
    if status:
        query = query.where(Task.status == status)
    if project_id:
        query = query.where(Task.project_id == project_id)
    if search:
        query = query.where(
            (Task.name.like(f"%{search}%")) | 
            (Task.description.like(f"%{search}%"))
        )
        
    tasks = session.exec(query).all()
    return tasks

@router.get("/{task_id}", response_model=Task)
def get_task(task_id: str, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{task_id}' not found."
        )
    return task

@router.post("", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(task: Task, session: Session = Depends(get_session)):
    task.created_at = datetime.utcnow()
    task.updated_at = datetime.utcnow()
    session.add(task)
    session.commit()
    session.refresh(task)
    
    # Sync to EAV DatabaseRecord
    try:
        sync_task_to_record(session, task)
    except Exception as e:
        print(f"Error syncing created task to dynamic record: {e}")
        
    return task

@router.put("/{task_id}", response_model=Task)
def update_task(task_id: str, task_update: Task, session: Session = Depends(get_session)):
    db_task = session.get(Task, task_id)
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{task_id}' not found."
        )
        
    # Copy parameters
    exclude_fields = {"id", "created_at"}
    for key, val in task_update.dict(exclude_unset=True).items():
        if key not in exclude_fields:
            setattr(db_task, key, val)
            
    db_task.updated_at = datetime.utcnow()
    session.add(db_task)
    session.commit()
    session.refresh(db_task)
    
    # Sync to EAV DatabaseRecord
    try:
        sync_task_to_record(session, db_task)
    except Exception as e:
        print(f"Error syncing updated task to dynamic record: {e}")
        
    return db_task

@router.delete("/{task_id}", status_code=status.HTTP_200_OK)
def delete_task(task_id: str, session: Session = Depends(get_session)):
    db_task = session.get(Task, task_id)
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{task_id}' not found."
        )
    session.delete(db_task)
    
    # Delete EAV DatabaseRecord too
    try:
        session.query(DatabaseRecord).filter(DatabaseRecord.id == task_id).delete()
    except Exception as e:
        print(f"Error deleting dynamic record: {e}")

    # Delete linked daily tasks (explicit cascade — SQLite FK not enforced)
    try:
        session.query(DailyTask).filter(DailyTask.task_id == task_id).delete()
    except Exception as e:
        print(f"Error deleting linked daily tasks: {e}")
        
    session.commit()
    return {"status": "success", "message": f"Task '{task_id}' deleted."}

from pydantic import BaseModel

class BulkSyncItemUpdate(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    owner: Optional[str] = None
    task_grouping: Optional[str] = None
    archived: Optional[bool] = None
    estimated_duration: Optional[int] = None
    current_duration: Optional[int] = None

class BulkSyncItemCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    status: Optional[str] = "backlog"
    category: Optional[str] = "business"
    owner: Optional[str] = "Alice"
    task_grouping: Optional[str] = "General"
    estimated_duration: Optional[int] = 60
    current_duration: Optional[int] = 0

class BulkSyncPayload(BaseModel):
    updates: Optional[List[BulkSyncItemUpdate]] = []
    creations: Optional[List[BulkSyncItemCreate]] = []

@router.post("/bulk-sync", status_code=status.HTTP_200_OK)
def bulk_sync_tasks(payload: BulkSyncPayload, session: Session = Depends(get_session)):
    updated_count = 0
    created_count = 0
    
    # Get default project ID to assign to new tasks
    from database import Project
    proj = session.exec(select(Project)).first()
    proj_id = proj.id if proj else None
    
    for u in payload.updates:
        db_task = session.get(Task, u.id)
        if db_task:
            exclude_fields = {"id"}
            for key, val in u.dict(exclude_unset=True).items():
                if key not in exclude_fields:
                    if key == "status" and val is not None:
                        try:
                            val = validate_task_status(val)
                        except ValueError as e:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail=str(e),
                            )
                    setattr(db_task, key, val)
            db_task.updated_at = datetime.utcnow()
            session.add(db_task)
            session.commit()
            
            try:
                sync_task_to_record(session, db_task)
            except Exception as e:
                print(f"Error syncing bulk updated task: {e}")
            updated_count += 1
            
    for c in payload.creations:
        task_status = "backlog"
        if c.status is not None:
            try:
                task_status = validate_task_status(c.status)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=str(e),
                )

        new_task = Task(
            name=c.name,
            description=c.description,
            status=task_status,
            category=c.category,
            owner=c.owner,
            task_grouping=c.task_grouping,
            estimated_duration=c.estimated_duration,
            current_duration=c.current_duration,
            source="planning",
            project_id=proj_id,
            archived=False
        )
        session.add(new_task)
        session.commit()
        session.refresh(new_task)
        
        try:
            sync_task_to_record(session, new_task)
        except Exception as e:
            print(f"Error syncing bulk created task: {e}")
        created_count += 1
        
    return {
        "status": "success",
        "tasks_updated": updated_count,
        "tasks_created": created_count
    }
