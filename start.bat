@echo off
echo ========================================
echo Starting React Dashboard
echo ========================================
echo.

echo Starting Backend API...
start "Backend API" cmd /k "cd /d "%~dp0" && python backend_api.py"

timeout /t 3 /nobreak > nul

echo Starting Frontend...
start "React Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================
echo Dashboard is starting!
echo ========================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo The browser should open automatically.
echo Keep both terminal windows open.
echo.
pause
