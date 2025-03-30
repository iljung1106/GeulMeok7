@echo off
chcp 65001 > nul
echo ===================================================
echo GeulMeok7 Novel Writing Assistant
echo ===================================================
echo.

:: Create necessary directories
if not exist "data" mkdir data
if not exist "data\templates" mkdir data\templates

:: Check Python installation
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed.
    echo Please install Python from https://www.python.org/downloads/
    echo.
    pause
    exit /b
)

:: Install required packages
echo Installing required packages...
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo Error installing packages.
    pause
    exit /b
)

echo.
echo Installation complete.
echo.
echo ===================================================
echo Starting GeulMeok7 Novel Writing Assistant...
echo.
echo Access the application at http://127.0.0.1:5000
echo Press Ctrl+C in this window to exit.
echo ===================================================
echo.

:: Run the application
python app.py

pause
