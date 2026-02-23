@echo off
cd /d "%~dp0"
echo Fetching data from Analytics API...
python analytics_fetcher.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success. domain_data.csv updated. Restart the backend or call POST /api/reload to see new data.
) else (
    echo.
    echo Failed. Set ANALYTICS_DATA_URL in .env to your analytics API CSV endpoint.
)
pause
