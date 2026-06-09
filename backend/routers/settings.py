from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import Dict
from datetime import datetime
from database import Setting, get_session
from services.sync_service import sync_weekly_plan

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("", response_model=Dict[str, str])
def get_settings(session: Session = Depends(get_session)):
    settings_records = session.exec(select(Setting)).all()
    # Convert list of Settings to a simple key-value dict
    return {s.key: s.value for s in settings_records}

@router.post("", status_code=status.HTTP_200_OK)
def update_settings(settings_dict: Dict[str, str], session: Session = Depends(get_session)):
    updated_keys = []
    for key, value in settings_dict.items():
        db_setting = session.get(Setting, key)
        if db_setting:
            db_setting.value = value
            db_setting.updated_at = datetime.utcnow()
            session.add(db_setting)
        else:
            new_setting = Setting(key=key, value=value, updated_at=datetime.utcnow())
            session.add(new_setting)
        updated_keys.append(key)
        
    session.commit()
    return {"status": "success", "settings_updated": updated_keys}

@router.post("/sync-planning", status_code=status.HTTP_200_OK)
def trigger_sync_planning(force: bool = False, session: Session = Depends(get_session)):
    try:
        result = sync_weekly_plan(session, force=force)
        return result
    except FileNotFoundError as fnf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(fnf)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during synchronization: {str(e)}"
        )
