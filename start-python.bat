@echo off
setlocal
cd /d "%~dp0"
echo Starting InTheFlow (legacy Python backend + Electron)...

echo Building frontend assets...
call pnpm build
if errorlevel 1 exit /b 1

echo Starting Python FastAPI on http://127.0.0.1:8000 ...
pushd backend
start /B cmd /c "venv\Scripts\python -m uvicorn main:app --port 8000 --reload --host 127.0.0.1"
popd

echo Waiting for backend API to start...
timeout /t 3 /nobreak > NUL

echo Starting Electron...
pnpm start
