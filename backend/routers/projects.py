from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from database import Project, get_session

router = APIRouter(prefix="/api/projects", tags=["Projects"])

@router.get("", response_model=List[Project])
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project)).all()
    return projects

@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(project: Project, session: Session = Depends(get_session)):
    # Check if project name already exists
    existing = session.exec(select(Project).where(Project.name == project.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with name '{project.name}' already exists."
        )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project
