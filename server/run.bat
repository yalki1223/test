@echo off
REM Set up the venv (idempotent) and start the local SoundCloud Friends server.
setlocal

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
)

call .venv\Scripts\activate.bat

python -m pip install --upgrade pip >nul
pip install -r requirements.txt

if "%PORT%"=="" set PORT=8765
if "%HOST%"=="" set HOST=127.0.0.1

echo ^> http://%HOST%:%PORT% (press Ctrl+C to stop)
uvicorn main:app --host %HOST% --port %PORT% --reload
