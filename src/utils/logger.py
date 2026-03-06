"""
日志管理模块
src/utils/logger.py

自动将日志保存到 logs 目录
"""
import logging
import sys
from pathlib import Path
from datetime import datetime
from logging.handlers import RotatingFileHandler


def setup_logger(name: str = "WakeUpSchedule") -> logging.Logger:
    """
    设置并返回日志记录器
    
    日志文件保存在项目根目录的 logs 文件夹中
    自动按日期命名，超过 5MB 自动轮转
    """
    # 获取项目根目录
    if getattr(sys, 'frozen', False):
        # 打包后的 exe
        base_dir = Path(sys.executable).parent
    else:
        # 开发环境
        base_dir = Path(__file__).parent.parent.parent
    
    # 创建 logs 目录
    logs_dir = base_dir / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # 日志文件名（按日期）
    log_filename = f"wakeup_{datetime.now().strftime('%Y%m%d')}.log"
    log_path = logs_dir / log_filename
    
    # 创建 logger
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    
    # 避免重复添加 handler
    if logger.handlers:
        return logger
    
    # 文件 handler（带轮转，最大 5MB，保留 5 个备份）
    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=5 * 1024 * 1024,  # 5MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_format = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_format)
    logger.addHandler(file_handler)
    
    # 控制台 handler（仅在开发环境显示）
    if not getattr(sys, 'frozen', False):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_format = logging.Formatter('%(levelname)s: %(message)s')
        console_handler.setFormatter(console_format)
        logger.addHandler(console_handler)
    
    return logger


# 全局 logger 实例
logger = setup_logger()


def log_exception(exc_type, exc_value, exc_tb):
    """全局异常处理，记录未捕获的异常到日志"""
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_tb)
        return
    
    logger.critical("未捕获的异常:", exc_info=(exc_type, exc_value, exc_tb))
