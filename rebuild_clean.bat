@echo off
setlocal
REM Safe rebuild: no process termination, source cleanup, or cache removal.
call "%~dp0build_clean.bat" %*
exit /b %ERRORLEVEL%
