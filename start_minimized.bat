@echo off
REM Spark Schedule - 最小化启动脚本
REM 用于开机自启动时最小化到托盘

cd /d "%~dp0"

REM 使用 pythonw.exe 启动（无控制台窗口）
start "" pythonw.exe main.py

exit
