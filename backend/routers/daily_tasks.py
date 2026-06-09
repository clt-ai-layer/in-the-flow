import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from database import DailyTask, Task, get_session

router = APIRouter(prefix="/api/daily-tasks", tags=["daily-tasks"])

DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_PATTERN = re.compile(r"^\d{2}:\d{2}$")
VALID_OWNERS = frozenset({"Alice", "Bob", "Shared"})


class DailyTaskCreate(BaseModel):
    date: str
    start_time: str
    end_time: str
    title: Optional[str] = None
    task_id: Optional[str] = None
    owner: Optional[str] = None


class DailyTaskUpdate(BaseModel):
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    title: Optional[str] = None
    task_id: Optional[str] = None
    owner: Optional[str] = None


class DailyTaskResponse(BaseModel):
    id: str
    task_id: Optional[str]
    date: str
    start_time: str
    end_time: str
    title: Optional[str]
    owner: str
    created_at: datetime
    updated_at: datetime
    parent_task_name: Optional[str] = None
    parent_task_grouping: Optional[str] = None
    parent_project_id: Optional[str] = None
    parent_status: Optional[str] = None
    parent_archived: Optional[bool] = None


def _parse_time_minutes(time_str: str) -> int:
    """Convert HH:mm to total minutes since midnight."""
    hours, minutes = map(int, time_str.split(":"))
    return hours * 60 + minutes


def validate_schedule(date: str, start_time: str, end_time: str) -> None:
    """Validate schedule fields; raise ValueError on failure."""
    if not DATE_PATTERN.match(date):
        raise ValueError(f"Invalid date '{date}'. Expected YYYY-MM-DD.")

    for label, time_val in (("start_time", start_time), ("end_time", end_time)):
        if not TIME_PATTERN.match(time_val):
            raise ValueError(f"Invalid {label} '{time_val}'. Expected HH:mm.")
        minutes = int(time_val.split(":")[1])
        if minutes % 15 != 0:
            raise ValueError(f"{label} '{time_val}' must align to 15-minute boundaries.")

    start_minutes = _parse_time_minutes(start_time)
    end_minutes = _parse_time_minutes(end_time)

    if end_minutes <= start_minutes:
        raise ValueError("end_time must be after start_time on the same day.")

    duration = end_minutes - start_minutes
    if duration < 15:
        raise ValueError("Schedule duration must be at least 15 minutes.")


def _normalize_owner(owner: Optional[str]) -> str:
    if owner is None or owner.strip() == "":
        return "Alice"
    normalized = owner.strip()
    if normalized not in VALID_OWNERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid owner '{owner}'. Must be one of: Alice, Bob, Shared.",
        )
    return normalized


def _resolve_owner(daily_task: DailyTask, parent: Optional[Task]) -> str:
    if daily_task.owner and daily_task.owner in VALID_OWNERS:
        return daily_task.owner
    if parent and parent.owner and parent.owner in VALID_OWNERS:
        return parent.owner
    return "Alice"


def _ensure_task_exists(session: Session, task_id: Optional[str]) -> None:
    """Verify parent task exists when task_id is provided."""
    if task_id is None:
        return
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID '{task_id}' not found.",
        )


def _to_response(daily_task: DailyTask, parent: Optional[Task]) -> DailyTaskResponse:
    """Build denormalized response from DailyTask and optional parent Task."""
    return DailyTaskResponse(
        id=daily_task.id,
        task_id=daily_task.task_id,
        date=daily_task.date,
        start_time=daily_task.start_time,
        end_time=daily_task.end_time,
        title=daily_task.title,
        owner=_resolve_owner(daily_task, parent),
        created_at=daily_task.created_at,
        updated_at=daily_task.updated_at,
        parent_task_name=parent.name if parent else None,
        parent_task_grouping=parent.task_grouping if parent else None,
        parent_project_id=parent.project_id if parent else None,
        parent_status=parent.status if parent else None,
        parent_archived=parent.archived if parent else None,
    )


def _unpack_daily_task_row(row) -> tuple[DailyTask, Optional[Task]]:
    """Unpack select(DailyTask, Task) — SQLAlchemy returns Row, not tuple."""
    if isinstance(row, tuple):
        daily_task, parent = row[0], row[1] if len(row) > 1 else None
        return daily_task, parent
    daily_task = row[0]
    parent = row[1] if len(row) > 1 else None
    return daily_task, parent


def _fetch_with_parents(
    session: Session,
    query,
) -> List[DailyTaskResponse]:
    """Execute query with LEFT JOIN on Task and map to response DTOs."""
    rows = session.exec(query).all()
    results: List[DailyTaskResponse] = []
    for row in rows:
        daily_task, parent = _unpack_daily_task_row(row)
        results.append(_to_response(daily_task, parent))
    return results


@router.get("", response_model=List[DailyTaskResponse])
def list_daily_tasks(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    task_id: Optional[str] = None,
    session: Session = Depends(get_session),
):
    has_date_range = start_date is not None and end_date is not None
    has_task_only = task_id is not None and not has_date_range

    if not has_date_range and not has_task_only:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Provide either start_date and end_date together for calendar fetch, "
                "or task_id alone for task-scoped list."
            ),
        )

    if (start_date is not None) != (end_date is not None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date and end_date must be provided together.",
        )

    query = (
        select(DailyTask, Task)
        .join(Task, DailyTask.task_id == Task.id, isouter=True)
    )

    if has_date_range:
        query = query.where(DailyTask.date >= start_date)
        query = query.where(DailyTask.date <= end_date)
        if task_id:
            query = query.where(DailyTask.task_id == task_id)
    else:
        query = query.where(DailyTask.task_id == task_id)

    query = query.order_by(DailyTask.date, DailyTask.start_time)
    return _fetch_with_parents(session, query)


@router.post("", response_model=DailyTaskResponse, status_code=status.HTTP_201_CREATED)
def create_daily_task(
    payload: DailyTaskCreate,
    session: Session = Depends(get_session),
):
    try:
        validate_schedule(payload.date, payload.start_time, payload.end_time)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    parent = None
    if payload.task_id:
        _ensure_task_exists(session, payload.task_id)
        parent = session.get(Task, payload.task_id)

    owner = "Alice"
    if payload.owner is not None:
        owner = _normalize_owner(payload.owner)
    elif parent and parent.owner:
        owner = _normalize_owner(parent.owner)

    now = datetime.utcnow()
    daily_task = DailyTask(
        task_id=payload.task_id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        title=payload.title,
        owner=owner,
        created_at=now,
        updated_at=now,
    )
    session.add(daily_task)
    session.commit()
    session.refresh(daily_task)

    if not parent and daily_task.task_id:
        parent = session.get(Task, daily_task.task_id)
    return _to_response(daily_task, parent)


@router.patch("/{daily_task_id}", response_model=DailyTaskResponse)
def update_daily_task(
    daily_task_id: str,
    payload: DailyTaskUpdate,
    session: Session = Depends(get_session),
):
    db_task = session.get(DailyTask, daily_task_id)
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Daily task with ID '{daily_task_id}' not found.",
        )

    update_data = payload.dict(exclude_unset=True)
    if "owner" in update_data:
        update_data["owner"] = _normalize_owner(update_data["owner"])
    if "task_id" in update_data:
        _ensure_task_exists(session, update_data["task_id"])

    for key, val in update_data.items():
        setattr(db_task, key, val)

    try:
        validate_schedule(db_task.date, db_task.start_time, db_task.end_time)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    db_task.updated_at = datetime.utcnow()
    session.add(db_task)
    session.commit()
    session.refresh(db_task)

    parent = session.get(Task, db_task.task_id) if db_task.task_id else None
    return _to_response(db_task, parent)


@router.delete("/{daily_task_id}", status_code=status.HTTP_200_OK)
def delete_daily_task(
    daily_task_id: str,
    session: Session = Depends(get_session),
):
    db_task = session.get(DailyTask, daily_task_id)
    if not db_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Daily task with ID '{daily_task_id}' not found.",
        )

    session.delete(db_task)
    session.commit()
    return {"status": "success", "message": f"Daily task '{daily_task_id}' deleted."}
