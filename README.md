# InTheFlow ⚡

> A desktop productivity workspace for task management, weekly planning, and flow optimization.

InTheFlow is a standalone **Electron desktop app** built with **React**, **Express**, and **Emmett** (event sourcing) on **MongoDB**. It combines a Kanban board, calendar time-blocking, AI-powered task analysis, and a flexible custom views system — all in a single, offline-first workspace.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Kanban Board** | Status-based swimlanes (Backlog → Ready → In Progress → On Hold → Done) with owner filtering |
| **Calendar** | Weekly time-block scheduler with 15-minute grid for daily task planning |
| **Dashboard** | Stats overview with task distribution, completion rates, and flow metrics |
| **Backlog** | Filterable, sortable table view for all tasks |
| **Custom Views** | Create Kanban or Table views with custom filters, groupings, and an EAV query engine |
| **AI Hub** | Classify tasks, analyze flow friction, enhance ticket descriptions, compile weekly plans |
| **Planning Sync** | Parse weekly planning markdown files into structured tasks |
| **Dark / Light Theme** | Full theme support with glassmorphism design |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 27 |
| Frontend | React 18, Vite 5, Lucide Icons |
| Backend | Express, TypeScript, Emmett (Event Sourcing) |
| Database | MongoDB 6 (event streams + EAV records) |
| AI | Moonshot Kimi (configurable) |
| Testing | Vitest, Supertest, mongodb-memory-server |
| Legacy Backend | Python FastAPI + SQLite (deprecated) |

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** 6+ running locally (or via Docker)
- **pnpm** (recommended) or npm

### 1. Clone and install

```bash
git clone https://github.com/your-username/InTheFlow.git
cd InTheFlow
pnpm install
```

### 2. Start MongoDB

```bash
# Using Docker
docker run -d --name mongodb -p 27017:27017 mongo:6

# Or install locally: https://www.mongodb.com/docs/manual/installation/
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys (optional — app works without AI features)
```

### 4. Run the app

```bash
# Windows
start.bat

# Manual start (any OS)
cd backend-js && npx tsx src/index.ts   # Terminal 1: Start backend
cd frontend && npx vite                  # Terminal 2: Start frontend dev server
npx electron .                           # Terminal 3: Launch Electron shell
```

The app will open at `http://localhost:5173` (browser) or in the Electron window.

## 📁 Project Structure

```
InTheFlow/
├── frontend/               # React + Vite + Electron
│   ├── electron.js          # Electron main process
│   ├── src/
│   │   ├── App.jsx          # Root component, routing, state
│   │   ├── api.js           # REST API client
│   │   ├── components/      # Sidebar, TaskModal, Toast, ViewControlBar
│   │   ├── pages/           # Dashboard, Calendar, KanbanBoard, Backlog, AiHub, Settings
│   │   └── utils/           # Theme, grouping colors
│   └── index.html
├── backend-js/              # Express + Emmett (active backend)
│   ├── src/
│   │   ├── index.ts         # Server entry (port 8000)
│   │   ├── platform/        # App factory, MongoDB config, Emmett helpers
│   │   ├── es-kit/          # Custom event sourcing toolkit
│   │   ├── task/            # Task domain (DDD: domain/api/application/projections)
│   │   ├── dailyTask/       # Daily task / calendar blocks
│   │   ├── project/         # Project management
│   │   ├── settings/        # App settings + planning sync
│   │   ├── views/           # Custom views, EAV query engine
│   │   └── ai/              # AI integration (Kimi)
│   ├── test/                # Vitest test suites
│   └── seed/                # JSON seed data
├── backend/                 # ⚠️ Legacy Python backend (deprecated)
├── docs/                    # Documentation
│   ├── reference/           # Architecture, API, database, frontend docs
│   ├── specs/               # Historical specifications
│   └── emmett/              # Emmett event sourcing guides
├── .env.example             # Environment template
├── start.bat                # Windows launcher
└── README.md                # This file
```

## 🧪 Running Tests

```bash
cd backend-js
pnpm install
npx vitest --run           # Unit + integration tests
npx vitest --run --watch   # Watch mode
```

> **Note**: Integration tests require MongoDB. Tests use `mongodb-memory-server` for isolated instances.

## 📖 Documentation

- [Overview](docs/reference/00-Overview.md) — What InTheFlow is and how to run it
- [Architecture](docs/reference/01-Architecture.md) — Electron + backend startup, IPC, navigation
- [Database](docs/reference/02-Database.md) — MongoDB event streams, EAV system
- [Backend API](docs/reference/03-Backend-API.md) — REST endpoints reference
- [Frontend](docs/reference/04-Frontend.md) — Pages, components, state management
- [AI Capabilities](docs/reference/05-AI-Capabilities.md) — Kimi integration, task analysis
- [Calendar](docs/reference/06-Weekly-Plan-Calendar.md) — Time-blocking, daily tasks
- [Emmett Guide](docs/emmett/Getting-Started.md) — Event sourcing with Emmett

## 🎨 Design

InTheFlow uses a **glassmorphism design** with:
- CSS custom properties for full theming
- Dark/light mode toggle
- Responsive layout with collapsible sidebar
- Lucide icons throughout
- WCAG-compliant color contrast for task groupings

## 📝 License

MIT © [Your Name]

---

Built with ❤️ using [Emmett](https://event-driven-io.github.io/emmett/) for event sourcing.
