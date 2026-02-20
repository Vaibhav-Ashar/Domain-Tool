@echo off
cd /d "%~dp0"
echo Fetching latest CSV from Gmail (subject: Analytics Scheduled Dataset : Daily Advertiser Data)...
python gmail_fetcher.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Success. domain_data.csv updated. Restart the backend to see new data.
) else (
    echo.
    echo Failed. Create a .env file with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.
    echo See .env.example. Get the refresh token by running: python get_gmail_refresh_token.py
)
pause
