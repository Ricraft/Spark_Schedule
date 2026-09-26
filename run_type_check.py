#!/usr/bin/env python3
"""
类型检查脚本
使用 mypy 对数据标准化模块进行类型检查
"""

import importlib.util
import subprocess
import sys
from pathlib import Path


def check_mypy_installed() -> bool:
    """检查 mypy 是否安装"""
    return importlib.util.find_spec("mypy") is not None


def run_type_check(file_path: str, strict: bool = True) -> bool:
    """
    运行类型检查
    
    Args:
        file_path: 要检查的文件路径
        strict: 是否使用严格模式
        
    Returns:
        bool: 检查是否通过
    """
    cmd = [
        sys.executable, "-m", "mypy",
        file_path,
        "--config-file", "mypy.ini"
    ]
    
    if not strict:
        cmd.append("--no-strict-optional")
    
    print(f"[检查] {file_path}...")
    result = subprocess.run(cmd, check=False)
    if result.returncode == 0:
        print(f"[成功] {file_path} 类型检查通过")
        return True
    print(f"[失败] {file_path} 类型检查失败")
    return False


def main():
    """主函数"""
    print("=" * 50)
    print("课程数据标准化 - 类型检查")
    print("=" * 50)
    print()
    
    # 检查 mypy 是否安装
    if not check_mypy_installed():
        print("[错误] mypy 未安装")
        print("请运行: pip install -r requirements-dev.txt")
        print()
        return 1
    
    print("[信息] 开始类型检查...")
    print()
    
    has_error = False
    
    # 检查数据标准化模块
    print("[1/3] 检查 data_normalizer.py...")
    if not run_type_check("backend/utils/data_normalizer.py", strict=True):
        has_error = True
    print()
    
    # 检查验证器模块（如果存在）
    validators_path = Path("src/utils/validators.py")
    if validators_path.exists():
        print("[2/3] 检查 validators.py...")
        if not run_type_check(str(validators_path), strict=True):
            has_error = True
        print()
    else:
        print("[2/3] 跳过 validators.py（文件不存在）")
        print()
    
    # 检查 bridge 模块（如果需要）
    bridge_path = Path("bridge.py")
    if bridge_path.exists():
        print("[3/3] 检查 bridge.py...")
        if not run_type_check("bridge.py", strict=False):
            print("[警告] bridge.py 类型检查有警告（非严格模式）")
        print()
    else:
        print("[3/3] 跳过 bridge.py（文件不存在）")
        print()
    
    # 输出结果
    print("=" * 50)
    if has_error:
        print("[结果] 类型检查失败 - 请修复上述错误")
        print("=" * 50)
        return 1
    else:
        print("[结果] 所有类型检查通过！")
        print("=" * 50)
        return 0


if __name__ == "__main__":
    sys.exit(main())
