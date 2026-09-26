@echo off
setlocal
REM The canonical pipeline is shared so no alternate build can bundle data.
call "%~dp0build_clean.bat" %*
exit /b %ERRORLEVEL%
