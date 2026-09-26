@echo off
setlocal
chcp 65001 >nul

REM Run from this repository regardless of the caller's current directory.
pushd "%~dp0"
if errorlevel 1 (
    echo [FAIL] Cannot enter the project directory.
    exit /b 1
)

echo ========================================
echo Spark Schedule - Safe Packaging
echo ========================================
echo Source data is never cleaned or bundled.
echo.

if not exist "frontend\package.json" (
    echo [FAIL] frontend\package.json is missing.
    goto :fail_root
)
if not exist "frontend\package-lock.json" (
    echo [FAIL] frontend\package-lock.json is missing; reproducible npm ci is unavailable.
    goto :fail_root
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [FAIL] npm was not found. Install Node.js with npm, then rerun this script.
    goto :fail_root
)

echo [1/4] Installing locked frontend dependencies...
pushd "frontend"
if errorlevel 1 (
    echo [FAIL] Cannot enter frontend directory.
    goto :fail_frontend
)
call npm ci
if errorlevel 1 (
    echo [FAIL] npm ci failed.
    goto :fail_frontend
)

echo.
echo [2/4] Building frontend...
call npm run build
if errorlevel 1 (
    echo [FAIL] npm run build failed.
    goto :fail_frontend
)
popd

if not exist "frontend\dist\index.html" (
    echo [FAIL] Expected build output frontend\dist\index.html was not produced.
    goto :fail_root
)

echo.
echo [3/4] Checking packaging inputs and allowlist...
python pre_package_check.py
if errorlevel 1 (
    echo [FAIL] Pre-package checks failed.
    goto :fail_root
)
python -m PyInstaller --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] PyInstaller is not installed for the active Python.
    echo Install it with: python -m pip install pyinstaller
    goto :fail_root
)

echo.
echo [4/4] Packaging with the safe spec...
python -m PyInstaller build_exe_clean.spec --clean --noconfirm
if errorlevel 1 (
    echo [FAIL] PyInstaller failed.
    goto :fail_root
)
if not exist "dist\SparkSchedule\SparkSchedule.exe" (
    echo [FAIL] PyInstaller returned success but the expected executable is missing.
    goto :fail_root
)

echo.
echo [OK] Packaging completed: dist\SparkSchedule\SparkSchedule.exe
popd
exit /b 0

:fail_frontend
echo Frontend dependency installation/build failed; packaging was not run.
popd
:fail_root
popd
exit /b 1
