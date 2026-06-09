# InTheFlow: System Architecture Specification

This document details the architectural boundaries, process structure, lifecycle management, and communication protocols of the **InTheFlow** application.

---

## 1. Process Model & Flow Diagram

InTheFlow utilizes a dual-process desktop architecture:
1. **Electron Main Process**: Operates node-level OS bindings, tray configurations, hotkey registration, and manages the lifecycle of the Python sub-process.
2. **React Renderer Process**: Runs inside the Chromium window shell and manages the Single Page App (SPA) dashboard UI.
3. **Python FastAPI Backend Process**: Serves the REST API, manages SQLite reads/writes, schedules background maintenance tasks, and integrates with the Google Gemini API.

```
┌───────────────────────────────────────────────────────────────┐
│              Desktop Application Layer (Electron)             │
│                                                               │
│  ┌──────────────────────┐           ┌──────────────────────┐  │
│  │     Main Process     │           │   Renderer (React)   │  │
│  │    (electron.js)     │           │      (App.jsx)       │  │
│  └──────────┬───────────┘           └──────────┬───────────┘  │
│             │                                  │              │
│             │ Spawns & monitors                │ IPC Bridge   │
│             ▼                                  ▼ (preload.js) │
│  ┌──────────────────────┐           ┌──────────────────────┐  │
│  │   FastAPI Backend    │◄──────────┤      api.js API      │  │
│  │     (Uvicorn)        │ HTTP REST │    (Axios/Fetch)     │  │
│  └──────────┬───────────┘           └──────────────────────┘  │
└─────────────┼─────────────────────────────────────────────────┘
              │
              ├──────────► SQLite Database (intheflow.db)
              │
              └──────────► Google Gemini API (gemini-3.1-flash-lite)
```

---

## 2. Process Startup & Lifecycle (start.bat)

To launch both processes cleanly during development, a root-level `start.bat` script is executed. This script validates the environment, spawns the FastAPI server, waits briefly for it to bind to port 8000, and then starts the Electron application.

### `start.bat` Draft
```batch
@echo off
echo Starting InTheFlow Development Workspace...

:: 1. Start Python FastAPI Backend in background
cd backend
start /B cmd /c "python -m uvicorn main:app --port 8000 --reload"
cd ..

:: 2. Wait for backend to boot (using a ping loop or timeout)
echo Waiting for backend API to be ready on port 8000...
timeout /t 3 /nobreak > NUL

:: 3. Run Electron Frontend
pnpm run dev
```

---

## 3. Inter-Process Communication (IPC) Bridge

The frontend code runs inside a sandboxed Electron renderer. To safely interact with the local operating system (e.g., system notifications, folder dialogs, global hotkeys), the renderer communicates through `preload.js` using Electron's `contextBridge`.

### Preload Bridge Implementation (`preload.js`)
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (title, body) => ipcRenderer.send('trigger-notification', { title, body }),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  onHotkeyTriggered: (callback) => ipcRenderer.on('hotkey-triggered', callback)
});
```

---

## 4. Sub-Process Spawn Logic inside Electron

For production packaging, rather than using a separate bat script, the Electron main process (`electron.js`) spawns the Python backend as a child process directly. This ensures that when the user closes the Electron window, the Python process is automatically killed.

### Electron Spawning Logic (`electron.js` excerpt)
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let pySubprocess = null;

function startBackend() {
  const script = path.join(__dirname, '..', 'backend', 'main.py');
  
  // Use python executable from active virtual env or global path
  pySubprocess = spawn('python', ['-m', 'uvicorn', 'main:app', '--port', '8000']);

  pySubprocess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  pySubprocess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('will-quit', () => {
  if (pySubprocess) {
    pySubprocess.kill();
  }
});
```
