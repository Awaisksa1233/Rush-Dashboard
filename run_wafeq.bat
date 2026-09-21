@echo off
title Wafeq Invoice Manager
echo Starting Wafeq Invoice & Accounting Manager...
cd /d "%~dp0"
python wafeq_app\main.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Application exited with error code %ERRORLEVEL%.
    pause
)
