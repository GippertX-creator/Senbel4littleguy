@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
    where python >nul 2>&1
    if errorlevel 1 (
        echo Python was not found. Install Python 3.12 from python.org.
        echo Enable "Add python.exe to PATH" during installation.
        pause
        exit /b 1
    )
    python launch.py
) else (
    py -3 launch.py
)
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
    echo Startup failed. Please read the error above.
    pause
)
exit /b %RESULT%
