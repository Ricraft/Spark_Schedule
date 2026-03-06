"""
JSON 存储模块

负责课表和配置数据的持久化存储
数据存储在 %APPDATA%/WakeupSchedule/ 目录
"""

import json
import os
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import Schedule, Config


class JSONStorage:
    """
    JSON 存储管理器
    
    负责将课表和配置数据保存到本地文件系统
    """
    
    # 数据目录路径
    DATA_DIR = Path(os.getenv('APPDATA')) / 'WakeupSchedule'
    
    # 文件路径
    SCHEDULE_FILE = DATA_DIR / 'schedule.json'
    CONFIG_FILE = DATA_DIR / 'config.json'
    
    # 备份文件路径
    SCHEDULE_BACKUP = DATA_DIR / 'schedule.json.bak'
    CONFIG_BACKUP = DATA_DIR / 'config.json.bak'
    
    @classmethod
    def _ensure_data_dir(cls):
        """
        确保数据目录存在
        
        如果目录不存在，则创建它
        """
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    @classmethod
    def _create_backup(cls, file_path: Path, backup_path: Path):
        """
        创建文件备份
        
        Args:
            file_path: 原文件路径
            backup_path: 备份文件路径
        """
        if file_path.exists():
            try:
                shutil.copy2(file_path, backup_path)
            except Exception as e:
                print(f"警告: 创建备份失败: {e}")
    
    @classmethod
    def _restore_from_backup(cls, file_path: Path, backup_path: Path) -> bool:
        """
        从备份恢复文件
        
        Args:
            file_path: 目标文件路径
            backup_path: 备份文件路径
            
        Returns:
            是否成功恢复
        """
        if backup_path.exists():
            try:
                shutil.copy2(backup_path, file_path)
                return True
            except Exception as e:
                print(f"错误: 从备份恢复失败: {e}")
                return False
        return False
    
    @classmethod
    def save_schedule(cls, schedule: Schedule) -> bool:
        """
        保存课表到文件
        
        Args:
            schedule: 课表对象
            
        Returns:
            是否保存成功
        """
        try:
            # 确保目录存在
            cls._ensure_data_dir()
            
            # 创建备份
            cls._create_backup(cls.SCHEDULE_FILE, cls.SCHEDULE_BACKUP)
            
            # 序列化为字典
            data = schedule.to_dict()
            
            # 添加元数据
            data['_metadata'] = {
                'version': '1.0.0',
                'saved_at': datetime.now().isoformat(),
            }
            
            # 写入文件
            with open(cls.SCHEDULE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"错误: 保存课表失败: {e}")
            # 尝试从备份恢复
            cls._restore_from_backup(cls.SCHEDULE_FILE, cls.SCHEDULE_BACKUP)
            return False
    
    @classmethod
    def load_schedule(cls) -> Optional[Schedule]:
        """
        从文件加载课表
        
        Returns:
            Schedule 对象，如果加载失败则返回 None
        """
        try:
            # 检查文件是否存在
            if not cls.SCHEDULE_FILE.exists():
                print("提示: 课表文件不存在，返回空课表")
                return Schedule()
            
            # 读取文件
            with open(cls.SCHEDULE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 移除元数据
            data.pop('_metadata', None)
            
            # 反序列化
            schedule = Schedule.from_dict(data)
            return schedule
            
        except json.JSONDecodeError as e:
            print(f"错误: JSON 解析失败: {e}")
            # 尝试从备份恢复
            if cls._restore_from_backup(cls.SCHEDULE_FILE, cls.SCHEDULE_BACKUP):
                print("提示: 已从备份恢复，请重试")
            return None
            
        except Exception as e:
            print(f"错误: 加载课表失败: {e}")
            return None
    
    @classmethod
    def save_config(cls, config: Config) -> bool:
        """
        保存配置到文件
        
        Args:
            config: 配置对象
            
        Returns:
            是否保存成功
        """
        try:
            # 确保目录存在
            cls._ensure_data_dir()
            
            # 创建备份
            cls._create_backup(cls.CONFIG_FILE, cls.CONFIG_BACKUP)
            
            # 序列化为字典
            data = config.to_dict()
            
            # 添加元数据
            data['_metadata'] = {
                'version': '1.0.0',
                'saved_at': datetime.now().isoformat(),
            }
            
            # 写入文件
            with open(cls.CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            return True
            
        except Exception as e:
            print(f"错误: 保存配置失败: {e}")
            # 尝试从备份恢复
            cls._restore_from_backup(cls.CONFIG_FILE, cls.CONFIG_BACKUP)
            return False
    
    @classmethod
    def load_config(cls) -> Config:
        """
        从文件加载配置
        
        Returns:
            Config 对象，如果加载失败则返回默认配置
        """
        try:
            # 检查文件是否存在
            if not cls.CONFIG_FILE.exists():
                print("提示: 配置文件不存在，返回默认配置")
                return Config()
            
            # 读取文件
            with open(cls.CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 移除元数据
            data.pop('_metadata', None)
            
            # 反序列化
            config = Config.from_dict(data)
            return config
            
        except json.JSONDecodeError as e:
            print(f"错误: JSON 解析失败: {e}")
            # 尝试从备份恢复
            if cls._restore_from_backup(cls.CONFIG_FILE, cls.CONFIG_BACKUP):
                print("提示: 已从备份恢复，请重试")
            return Config()
            
        except Exception as e:
            print(f"错误: 加载配置失败: {e}")
            return Config()
    
    @classmethod
    def get_data_dir(cls) -> Path:
        """
        获取数据目录路径
        
        Returns:
            数据目录路径
        """
        return cls.DATA_DIR
    
    @classmethod
    def clear_all_data(cls) -> bool:
        """
        清除所有数据（谨慎使用）
        
        Returns:
            是否成功
        """
        try:
            if cls.DATA_DIR.exists():
                shutil.rmtree(cls.DATA_DIR)
            return True
        except Exception as e:
            print(f"错误: 清除数据失败: {e}")
            return False
