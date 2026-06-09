from sqlmodel import Session, select
from database import engine, AiLog

with Session(engine) as session:
    statement = select(AiLog).order_by(AiLog.created_at.desc()).limit(10)
    logs = session.exec(statement).all()
    print("--- Recent AI Logs ---")
    for log in logs:
        print(f"[{log.created_at}] Action: {log.action}")
        print(f"Prompt: {log.prompt[:200]}...")
        print(f"Response: {log.response[:500]}...")
        print("-" * 50)
