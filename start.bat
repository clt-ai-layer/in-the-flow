@echo off
setlocal
cd /d "%~dp0"
echo Starting InTheFlow (backend-js + Electron)...

:: 1. Build React frontend assets
echo Building frontend assets...
call pnpm build
if errorlevel 1 exit /b 1

:: 2. Ensure backend-js dependencies (standalone package, not root workspace)
if not exist "backend-js\node_modules\" (
  echo Installing backend-js dependencies...
  pushd backend-js
  call pnpm install --ignore-workspace
  if errorlevel 1 exit /b 1
  popd
)

:: 3. Start backend-js on :8000 (MongoDB via Documentation/.../JsBackend/.mongo-key or MONGODB_URI)
echo Starting backend-js API on http://127.0.0.1:8000 ...
start /B cmd /c "cd /d %~dp0backend-js && pnpm dev"

:: 4. Wait for API boot (Mongo connect + seed)
echo Waiting for backend API to start...
timeout /t 5 /nobreak > NUL

:: 5. Run Electron (serves built UI from dist/ on :4173)
echo Starting Electron...
pnpm start
