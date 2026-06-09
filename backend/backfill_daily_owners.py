"""One-off backfill: set dailytask.owner from Current_Planning Daily Schedule table."""
import re
from pathlib import Path

from sqlmodel import Session, create_engine, text

from database import migrate_daily_task_schema

engine = create_engine("sqlite:///intheflow.db")
DAY_HEADING_RE = re.compile(r"^###\s+[^\n]*\((\d{4}-\d{2}-\d{2})\)\s*$", re.MULTILINE)
TABLE_ROW_RE = re.compile(
    r"^\|\s*(\d{2}:\d{2})[–\-—](\d{2}:\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$"
)

PLAN_PATH = Path(__file__).resolve().parents[2] / "Documentation/1-Project/Planning/Current_Planning_May-26-to-Jun-01.md"


def parse_owner(raw: str) -> str:
    s = raw.strip()
    if "🤝" in s or s.lower() == "shared":
        return "Shared"
    if "🅾" in s or "bob" in s.lower():
        return "Bob"
    return "Alice"


def main() -> None:
    plan = PLAN_PATH.read_text(encoding="utf-8")
    idx = plan.lower().find("## daily schedule")
    if idx < 0:
        print("No Daily Schedule section found.")
        return

    section = plan[idx:]
    rows = []
    current_date = None
    for line in section.splitlines():
        day_match = DAY_HEADING_RE.match(line.strip())
        if day_match:
            current_date = day_match.group(1)
            continue
        if not current_date or not line.strip().startswith("|"):
            continue
        if "Time" in line or "---" in line:
            continue
        row_match = TABLE_ROW_RE.match(line.strip())
        if not row_match:
            continue
        start, end, owner_raw, block, _ = [p.strip() for p in row_match.groups()]
        rows.append((current_date, start, end, block, parse_owner(owner_raw)))

    with Session(engine) as session:
        migrate_daily_task_schema(session)
        updated = 0
        for date, start, end, title, owner in rows:
            row = session.exec(
                text(
                    """
                    SELECT id FROM dailytask
                    WHERE date = :d AND start_time = :s AND end_time = :e
                      AND COALESCE(title, '') = :t
                    """
                ).bindparams(d=date, s=start, e=end, t=title)
            ).first()
            if not row:
                continue
            block_id = row[0] if isinstance(row, tuple) else row.id
            session.exec(
                text("UPDATE dailytask SET owner = :o WHERE id = :id").bindparams(
                    o=owner, id=block_id
                )
            )
            updated += 1
        session.commit()
        print(f"Updated {updated} daily block owners from {PLAN_PATH.name}")


if __name__ == "__main__":
    main()
