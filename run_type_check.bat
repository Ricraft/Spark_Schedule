@echo off
REM 运行类型检查脚本
REM 使用 mypy 对数据标准化模块进行类型检查

echo ========================================
echo 课程数据标准化 - 类型检查
echo ========================================
echo.

REM 检查 mypy 是否安装
python -m mypy --version >nul 2>&1
if errorlevel 1 (
    echo [错误] mypy 未安装
    echo 请运行: pip install -r requirements-dev.txt
    echo.
    pause
    exit /b 1
)

echo [信息] 开始类型检查...
echo.

REM 检查数据标准化模块
echo [1/3] 检查 data_normalizer.py...
python -m mypy backend/utils/data_normalizer.py --config-file mypy.ini
if errorlevel 1 (
    echo [失败] data_normalizer.py 类型检查失败
    set HAS_ERROR=1
) else (
    echo [成功] data_normalizer.py 类型检查通过
)
echo.

REM 检查验证器模块（如果存在）
if exist src\utils\validators.py (
    echo [2/3] 检查 validators.py...
    python -m mypy src/utils/validators.py --config-file mypy.ini
    if errorlevel 1 (
        echo [失败] validators.py 类型检查失败
        set HAS_ERROR=1
    ) else (
        echo [成功] validators.py 类型检查通过
    )
    echo.
) else (
    echo [2/3] 跳过 validators.py（文件不存在）
    echo.
)

REM 检查 bridge 模块（如果需要）
if exist bridge.py (
    echo [3/3] 检查 bridge.py...
    python -m mypy bridge.py --config-file mypy.ini --no-strict-optional
    if errorlevel 1 (
        echo [警告] bridge.py 类型检查有警告（非严格模式）
    ) else (
        echo [成功] bridge.py 类型检查通过
    )
    echo.
) else (
    echo [3/3] 跳过 bridge.py（文件不存在）
    echo.
)

echo ========================================
if defined HAS_ERROR (
    echo [结果] 类型检查失败 - 请修复上述错误
    echo ========================================
    pause
    exit /b 1
) else (
    echo [结果] 所有类型检查通过！
    echo ========================================
    pause
    exit /b 0
)
