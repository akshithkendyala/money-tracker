@echo off
title FinancePro Server
echo ==================================================
echo        FinancePro Personal Finance Dashboard
echo ==================================================
echo.
echo Starting backend server...
echo.
echo Desktop URL: http://localhost:8000
echo Mobile URL:  http://192.168.0.107:8000
echo.
echo Keep this command prompt window open to keep the server running.
echo Close this window if you want to stop the server.
echo ==================================================
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start server.
    echo Please ensure Node.js is installed and port 8000 is not in use.
    echo.
    pause
)
