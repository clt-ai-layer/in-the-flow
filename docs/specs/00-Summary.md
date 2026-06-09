# InTheFlow: Project Specifications Summary

**InTheFlow** is a personal desktop productivity and task management workspace designed to embed development tickets, business strategies, and automate flow-state optimization. 

This document serves as the entry-point and summary directory for the multi-file specifications of the **InTheFlow** project.

---

## 🌟 Core Product Features
1. **Unified Kanban Board & Backlog**: A clean, responsive dashboard separating and managing Business and Technical tasks.
2. **Notion-Style Ticket Embedding**: Rich task editing screen rendering description markdown, metadata, and relations.
3. **AI Flow Assistant**: Integrated Google Gemini (`gemini-3.1-flash-lite`) capabilities to classify tasks, suggest daily agendas, summarize weekly context, and analyze blockages/friction.
4. **Desktop Shell Integrations**: Tray-based background operation, single-instance lock, custom window bounds, and automated backend server lifecycle management.

---

## 📂 Target Project Directory Layout

The codebase will be initialized with the following directory tree:

```
InTheFlow/
├── start.bat               # Dual-process launcher script
├── package.json            # Electron & frontend package manager definition
├── docs/                   # Product and technical specifications
│   ├── 00-Summary.md
│   ├── 01-Architecture.md
│   ├── 02-Database-Schema.md
│   ├── 03-Backend-API.md
│   ├── 04-Frontend-UI.md
│   ├── 05-AI-Capabilities.md
│   ├── 06-Initial-Seeding.md
│   └── 07-Enhanced-Notion-DB-Spec.md
├── backend/                # Python FastAPI backend
│   ├── main.py             # FastAPI Server entry point
│   ├── config.py           # Database & API configuration
│   ├── database.py         # SQLAlchemy / SQLModel models and engine
│   ├── requirements.txt    # Python dependencies
│   ├── routers/            # Endpoint modular controllers
│   │   ├── tasks.py
│   │   ├── projects.py
│   │   ├── ai.py
│   │   └── settings.py
│   └── services/           # Gemini and scheduling business logic
│       ├── gemini_service.py
│       └── scheduler.py
└── frontend/               # React + Electron frontend
    ├── electron.js         # Electron main process
    ├── preload.js          # Electron secure IPC preload bridge
    ├── vite.config.js      # Vite compilation configuration
    ├── index.html          # Frontend page entry
    └── src/                # React source code
        ├── main.jsx
        ├── App.jsx         # Navigation and state container
        ├── api.js          # Axios-wrapped API requests
        ├── index.css       # Core styling & glassmorphic system
        ├── components/     # Reusable presentation controls
        │   ├── Sidebar.jsx
        │   ├── KanbanBoard.jsx
        │   ├── TaskModal.jsx
        │   └── FlowMetrics.jsx
        └── pages/          # Full page layout views
            ├── Dashboard.jsx
            ├── Backlog.jsx
            ├── AiHub.jsx
            └── Settings.jsx
```

---

## 📝 Specifications Index

Click the links below to view the detailed specifications for each sub-system:

### 1. [01-Architecture.md](01-Architecture.md)
Detailed architecture overview, dual-process model, startup lifecycle (`start.bat`), IPC bridge, and standard developer package structure.

### 2. [02-Database-Schema.md](02-Database-Schema.md)
SQLite relational schema definition using SQLModel entities (`Task`, `Project`, `AiLog`, `Setting`) and indexing strategy.

### 3. [03-Backend-API.md](03-Backend-API.md)
FastAPI router definition, schemas, Pydantic requests/responses, and Swagger API descriptions.

### 4. [04-Frontend-UI.md](04-Frontend-UI.md)
Electron main process configuration, preload script, Lucide icons, glassmorphic layout, and React dashboard UI (Kanban, Backlog, AI Hub, Settings).

### 5. [05-AI-Capabilities.md](05-AI-Capabilities.md)
AI prompt design patterns for Gemini-3.1-flash-lite covering task classification, weekly planner formulation, blockages analyzer, and ticket text enhancement.

### 6. [06-Initial-Seeding.md](06-Initial-Seeding.md)
Full list of initial tasks to seed the SQLite database, detailing the 65 business tasks and 9 technical tasks.

### 7. [07-Enhanced-Notion-DB-Spec.md](07-Enhanced-Notion-DB-Spec.md)
Notion-like DB Query Engine, Dynamic JSON-EAV database schema, relational relations/rollups, nested AST filters, and calculated formula expression sandbox.
