# State Management, IPC & Theme System

## App.jsx — Central Orchestrator

File: `frontend/src/App.jsx`

All application state lives in `App.jsx`. There is no Redux, Zustand, or context provider — it's a single component with `useState` hooks and prop drilling.

### State inventory

| State | Type | Purpose |
| ----- | ---- | ------- |
| `currentView` | string | Active page ID or view UUID |
| `tasks` | Task[] | Full task list (dashboard, settings, dynamic views) |
| `projects` | Project[] | Project list for modals and calendar |
| `views` | ViewMeta[] | Sidebar workspace view list |
| `groupingColors` | Record<string, string> | Resolved grouping → hex color map |
| `theme` | `'light'` \| `'dark'` | Active theme mode |
| `activeViewData` | object \| null | Current dynamic view metadata + properties |
| `activeViewResult` | object \| null | Query engine execution result |
| `isLoading` | bool | Global loading gate (Calendar bypasses this) |
| `isSyncing` | bool | Weekly plan sync in progress |
| `activeEditTask` | Task \| null | TaskModal payload |
| `isModalOpen` | bool | TaskModal visibility |
| `dailyTasksVersion` | number | Counter — increment triggers Calendar refetch |
| `calendarAnchorDate` | string \| null | ISO date for calendar week anchor |
| `showCreateViewModal` | bool | Custom view creation dialog |
| `planningSyncEnabled` | bool | Whether sidebar sync button is visible |

### Data refresh strategy

`refreshData()` runs on every `currentView` change via `useEffect`:

| View type | What gets fetched |
| --------- | ----------------- |
| dashboard, ai-hub, settings | `api.views.list()` + `api.projects.list()` + `api.tasks.list()` |
| calendar | `api.views.list()` + `api.projects.list()` only (Calendar fetches daily tasks locally) |
| dynamic view (UUID) | `api.views.list()` + `api.projects.list()` + `api.views.get(id)` + `api.views.execute(id)` + `api.tasks.list()` |

### Key handlers

| Handler | Behavior |
| ------- | -------- |
| `refreshData()` | Reloads views, projects; conditionally loads tasks and view execution |
| `handleSyncPlanning()` | Calls `api.settings.syncPlanning()`, shows alert with sync summary |
| `handleEditTask(task)` | Opens TaskModal with task data |
| `handleCreateTask(defaults)` | Opens TaskModal with empty task + defaults |
| `handleSaveTask(taskData)` | POST or PUT via `api.tasks`, then refreshData |
| `handleDeleteTask(taskId)` | DELETE via `api.tasks`, then refreshData |
| `handleNavigateToCalendar(date)` | Sets `calendarAnchorDate`, switches to calendar view, closes modal |
| `handleThemeChange(mode)` | `applyTheme()` + auto-save to API |
| `handleUpdateViewConfig(config)` | PUT view config via `api.views.updateConfig` |
| `handleDeleteView()` | DELETE view, switch back to dashboard |
| `handleCreateViewSubmit(e)` | POST new view, switch to new view ID |

### View rendering flow

```
currentView
  ├── "calendar" → Calendar.jsx (rendered before isLoading check)
  ├── isLoading? → Spinner
  ├── "dashboard" → Dashboard.jsx
  ├── "ai-hub" → AiHub.jsx
  ├── "settings" → Settings.jsx
  └── UUID → activeViewData.layout_type
        ├── "board" → KanbanBoard.jsx
        └── "table"/"list" → Backlog.jsx
```

Calendar bypasses the global `isLoading` spinner — it manages its own loading state independently.

## Electron IPC Bridge

InTheFlow uses Electron's **context isolation** with a preload script.

### Files

| File | Role |
| ---- | ---- |
| `frontend/preload.js` | Exposes `window.electronAPI` via `contextBridge` |
| `frontend/electron.js` | Registers `ipcMain.handle` handlers + window management |

### Exposed IPC methods

| Method | IPC channel | Purpose |
| ------ | ----------- | ------- |
| `electronAPI.openDirectory()` | `dialog:openDirectory` | Native folder picker (Settings → planning path) |
| `electronAPI.setBackgroundColor(hex)` | `set-background-color` | Sync Electron window background with theme |

### What Electron does NOT do

- **Does not spawn the backend.** The API server must be started separately (`start.bat` or manual `pnpm dev` in `backend-js/`)
- **Does not manage data.** All data flows through HTTP to `localhost:8000`
- **Does not handle routing.** Navigation is string-based state in React

### Startup modes

| Mode | URL loaded | Behavior |
| ---- | ---------- | -------- |
| Development (`NODE_ENV=development`) | `http://127.0.0.1:5173` | Loads Vite dev server, DevTools open automatically |
| Production | `http://127.0.0.1:4173` | Spawns a Vite preview server on port 4173, loads that URL |

The production mode uses HTTP serving (not `file://`) because Vite's module scripts don't work from the `file://` protocol.

## Theme System

Files: `frontend/src/utils/theme.js`, `frontend/index.html`, `frontend/electron.js`, `frontend/src/index.css`

### Theme lifecycle

| Step | Behavior |
| ---- | -------- |
| Boot (`index.html`) | Inline script reads `localStorage('intheflow_theme')`, sets `document.documentElement.dataset.theme` before React loads — prevents flash of wrong theme |
| Boot (`main.jsx`) | Calls `applyTheme(cached)` including Electron IPC |
| App mount | Reconciles localStorage vs API `settings.theme` — API wins on conflict |
| Settings toggle | Immediate `applyTheme()` + auto-save `POST /api/settings` (no Save button) |
| Electron IPC | `setBackgroundColor('#0F172A'` for dark, `'#F8FAFC'` for light) |

### CSS tokens

Theme is applied via `document.documentElement.dataset.theme` (`dark` default, `light` override).

#### Core tokens

| Token | Dark (default) | Light |
| ----- | -------------- | ----- |
| `--bg-primary` | `hsl(224, 25%, 10%)` | `#F8FAFC` |
| `--bg-secondary` | `hsl(224, 20%, 15%)` | `#F1F5F9` |
| `--glass-bg` | Semi-transparent dark | Semi-transparent white |
| `--glass-border` | White 8% alpha | Gray border |
| `--text-primary` | 95% white | Dark slate |
| `--text-secondary` | 70% gray | Medium slate |
| `--text-muted` | 50% gray | Lighter slate |

#### Accent tokens

| Token | Purpose |
| ----- | ------- |
| `--accent-purple` | Gradients, duplicate button |
| `--accent-cyan` | Primary actions, active nav |
| `--accent-green` | Success states |
| `--accent-yellow` | On-hold status |
| `--accent-red` | Delete, errors |

Accents are toned down in light mode (lower saturation).

### Known theme limitations

- **Binary only** — Light or Dark, no system/native follow
- **Partial light coverage** — KanbanBoard, Backlog, AiHub, Dashboard have some hardcoded dark-era colors
- **Sidebar brand gradient** — Logo text uses hardcoded `#fff`

## Grouping Colors

File: `frontend/src/utils/groupingColors.js`

22 curated default colors in `DEFAULT_GROUPING_COLORS` (AI, Backend, API, Auth, Catalog, InTheFlow, SocialMedia, … General).

### Key exports

| Export | Purpose |
| ------ | ------- |
| `DEFAULT_GROUPING_COLORS` | 22 curated hex values |
| `resolveGroupingColors(storedJson)` | Merge user overrides from settings |
| `getTaskGrouping(taskOrRecord)` | Normalize `task_grouping` or EAV `TaskGrouping` |
| `getGroupingColor(grouping, map)` | Lookup with deterministic hash fallback |
| `getGroupingCardSurfaceStyle(grouping, map)` | Subtle card background + border tint |
| `getGroupingCardChromeStyle(grouping, map)` | Surface tint + **4px left stripe** (Kanban cards) |
| `getDailyBlockAccentColor(dailyTask, projects, map)` | Calendar stripe color |
| `deriveGroupingList(tasks)` | Settings editor grouping names |
| `validateGroupingColorMap(map)` | Hex validation before save |

### User overrides

Settings → **Task Grouping Colors** editor persists to `task_grouping_colors` setting (JSON map). Unknown groupings get a deterministic hash color from `OVERFLOW_PALETTE`.

## API Client

File: `frontend/src/api.js`

Single `fetch`-based client, base URL `http://localhost:8000/api`.

| Namespace | Methods |
| --------- | ------- |
| `api.tasks` | `list(filters)`, `get(id)`, `create(data)`, `update(id, data)`, `delete(id)` |
| `api.dailyTasks` | `list({ start_date, end_date, task_id })`, `create(data)`, `update(id, data)`, `delete(id)` |
| `api.projects` | `list()`, `create(data)` |
| `api.settings` | `get()`, `update(data)`, `syncPlanning()` |
| `api.ai` | `classify(data)`, `weeklyPlan()`, `flowAnalyzer()`, `enhanceTicket(data)` |
| `api.views` | `list()`, `get(id)`, `create(data)`, `updateConfig(id, data)`, `delete(id)`, `execute(id)` |

Error handling: Parses `detail` from JSON error responses (FastAPI-compatible format).

## Source files

- `frontend/src/App.jsx` — Root state and orchestration
- `frontend/src/api.js` — HTTP client
- `frontend/src/utils/theme.js` — Theme application and caching
- `frontend/src/utils/groupingColors.js` — Grouping color system
- `frontend/src/index.css` — CSS token definitions
- `frontend/index.html` — Theme boot script
- `frontend/electron.js` — Electron main process
- `frontend/preload.js` — IPC bridge
