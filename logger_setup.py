"""
日志系统配置
用于记录应用运行时的所有信息，方便调试打包后的问题
"""

import logging
import os
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler


def setup_logger(name='SparkSchedule', log_dir=None):
    """
    设置日志系统
    
    Args:
        name: 日志记录器名称
        log_dir: 日志目录，如果为 None 则使用 data/logs
    
    Returns:
        logger: 配置好的日志记录器
    """
    # 确定日志目录
    if log_dir is None:
        if getattr(sys, 'frozen', False):
            # 打包后：日志保存在 exe 旁边的 data/logs 目录
            base_dir = os.path.dirname(sys.executable)
        else:
            # 开发环境：日志保存在项目的 data/logs 目录
            base_dir = os.path.dirname(os.path.abspath(__file__))
        
        log_dir = os.path.join(base_dir, 'data', 'logs')
    
    # 创建日志目录
    os.makedirs(log_dir, exist_ok=True)
    
    # 创建日志记录器
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    
    # 避免重复添加处理器
    if logger.handlers:
        return logger
    
    # 日志文件名：包含日期
    log_filename = f"spark_schedule_{datetime.now().strftime('%Y%m%d')}.log"
    log_filepath = os.path.join(log_dir, log_filename)
    
    # 文件处理器：详细日志（DEBUG 级别）
    # 使用 RotatingFileHandler 限制单个日志文件大小
    file_handler = RotatingFileHandler(
        log_filepath,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,  # 保留5个备份
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    
    # 控制台处理器：简化日志（INFO 级别）
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    
    # 添加处理器
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    # 记录日志系统启动
    logger.info("=" * 60)
    logger.info("Spark Schedule - Log System Initialized")
    logger.info(f"Log file: {log_filepath}")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Frozen: {getattr(sys, 'frozen', False)}")
    logger.info("=" * 60)
    
    return logger


def cleanup_old_logs(log_dir=None, days=7):
    """
    清理旧日志文件
    
    Args:
        log_dir: 日志目录
        days: 保留天数
    """
    if log_dir is None:
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        log_dir = os.path.join(base_dir, 'data', 'logs')
    
    if not os.path.exists(log_dir):
        return
    
    import time
    cutoff_time = time.time() - (days * 24 * 60 * 60)
    
    try:
        for filename in os.listdir(log_dir):
            if not filename.endswith('.log'):
                continue
            
            filepath = os.path.join(log_dir, filename)
            try:
                if os.path.getmtime(filepath) < cutoff_time:
                    os.remove(filepath)
                    print(f"[Logger] Removed old log: {filename}")
            except Exception as e:
                print(f"[Logger] Failed to remove {filename}: {e}")
    except Exception as e:
        print(f"[Logger] Failed to cleanup logs: {e}")


# 创建全局日志记录器
logger = setup_logger()
