@echo off
cd /d "%~dp0"
echo Submitting analytics queue for yesterday UTC, then polling and downloading...
python analytics_queue_fetcher.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success. domain_data.csv updated. Restart the backend or call POST /api/reload to see new data.
) else (
    echo.
    echo Failed. Set ANALYTICS_API_KEY (Bearer token) in .env.
)
pause
