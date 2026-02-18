@echo off
echo ========================================
echo React Dashboard - First Time Setup
echo ========================================
echo.

echo Installing Backend Dependencies...
pip install -r requirements_backend.txt

echo.
echo Installing Frontend Dependencies...
cd frontend
npm install
cd ..

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the dashboard, run: start.bat
echo Or double-click start.bat
echo.
pause
