from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
from pathlib import Path

# Load environment variables using absolute paths
backend_dir = Path(__file__).resolve().parent
load_dotenv(dotenv_path=backend_dir / ".env", override=True)
load_dotenv(dotenv_path=backend_dir.parent / ".env", override=True)

from database import create_db_and_tables
from routers import tasks, projects, settings, ai, views, daily_tasks

app = FastAPI(
    title="InTheFlow API",
    description="Backend services for the InTheFlow desktop productivity application.",
    version="1.0.0"
)

# Configure CORS for Electron development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to localhost / Electron origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(tasks.router)
app.include_router(daily_tasks.router)
app.include_router(projects.router)
app.include_router(settings.router)
app.include_router(ai.router)
app.include_router(views.router)

@app.on_event("startup")
def on_startup():
    print("Starting InTheFlow Server...")
    print("Checking database schemas and initial seeds...")
    create_db_and_tables()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "InTheFlow Backend API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
