"""
应用程序设置管理器

负责应用程序全局设置的加载、保存、验证和通知
"""

import os
import json
import shutil
import builtins
from typing import Optional, Callable, List, Tuple
from datetime import datetime
from pathlib import Path

try:
    from ..models.app_settings import AppSettings
except ImportError:
    from models.app_settings import AppSettings


def _safe_print(*args, **kwargs):
    """Avoid print encoding errors on legacy consoles."""
    try:
        builtins.print(*args, **kwargs)
    except UnicodeEncodeError:
        text = " ".join(str(arg) for arg in args)
        builtins.print(
            text.encode("ascii", errors="ignore").decode("ascii", errors="ignore"),
            **kwargs
        )


print = _safe_print


class AppSettingsManager:
    """
    应用程序设置管理器
    
    管理应用程序全局设置的完整生命周期
    """
    
    def __init__(self, settings_file: str = "data/app_settings.json"):
        """
        初始化应用程序设置管理器
        
        Args:
            settings_file: 设置文件路径
        """
        self.settings_file = os.path.abspath(settings_file)
        self.data_dir = os.path.dirname(self.settings_file)
        self.settings: AppSettings = AppSettings()
        self._change_listeners: List[Callable[[AppSettings, dict], None]] = []
        
        # 确保数据目录存在
        os.makedirs(self.data_dir, exist_ok=True)
        
        # 确保备份目录存在
        self.backup_dir = os.path.join(self.data_dir, "backups")
        os.makedirs(self.backup_dir, exist_ok=True)
        
        # 加载现有设置
        self.load_settings()
    
    def load_settings(self) -> AppSettings:
        """
        从文件加载设置
        
        Returns:
            加载的设置对象
        """
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 从字典创建设置对象
                self.settings = AppSettings.from_dict(data)
                
                # 验证加载的设置
                is_valid, error_msg = self.settings.validate()
                if not is_valid:
                    print(f"⚠️ [AppSettingsManager] 设置验证失败: {error_msg}, 使用默认设置")
                    self._backup_corrupted_file()
                    self.settings = AppSettings()
                    self.save_settings(self.settings)
                else:
                    print(f"✅ [AppSettingsManager] 成功加载设置: {self.settings.get_display_name()}")
            else:
                # 文件不存在，创建默认设置
                print("📝 [AppSettingsManager] 设置文件不存在，创建默认设置")
                self.settings = AppSettings()
                self.save_settings(self.settings)
                
        except Exception as e:
            print(f"❌ [AppSettingsManager] 加载设置失败: {e}, 使用默认设置")
            self._backup_corrupted_file()
            self.settings = AppSettings()
            # 尝试保存默认设置
            try:
                self.save_settings(self.settings)
            except Exception as save_error:
                print(f"❌ [AppSettingsManager] 保存默认设置失败: {save_error}")
        
        return self.settings
    
    def save_settings(self, settings: AppSettings) -> bool:
        """
        保存设置到文件(使用原子写入)
        
        Args:
            settings: 要保存的设置对象
            
        Returns:
            是否保存成功
        """
        try:
            # 验证设置
            is_valid, error_msg = settings.validate()
            if not is_valid:
                print(f"❌ [AppSettingsManager] 设置验证失败: {error_msg}")
                return False
            
            # 更新修改时间
            settings.update_modified_time()
            
            # 使用原子写入: 先写入临时文件,然后重命名
            temp_file = self.settings_file + ".tmp"
            
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(settings.to_dict(), f, indent=4, ensure_ascii=False)
            
            # 原子重命名
            if os.path.exists(self.settings_file):
                os.replace(temp_file, self.settings_file)
            else:
                os.rename(temp_file, self.settings_file)
            
            print(f"✅ [AppSettingsManager] 设置保存成功: {settings.get_display_name()}")
            return True
            
        except Exception as e:
            print(f"❌ [AppSettingsManager] 保存设置失败: {e}")
            # 清理临时文件
            temp_file = self.settings_file + ".tmp"
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass
            return False
    
    def update_settings(self, updates: dict) -> Tuple[bool, str]:
        """
        更新设置
        
        Args:
            updates: 要更新的设置字典
            
        Returns:
            (是否成功, 错误消息)
        """
        try:
            # 记录变更前的设置
            old_settings = AppSettings.from_dict(self.settings.to_dict())
            
            # 应用更新
            for key, value in updates.items():
                if hasattr(self.settings, key):
                    setattr(self.settings, key, value)
                else:
                    return False, f"未知的设置项: {key}"
            
            # 验证更新后的设置
            is_valid, error_msg = self.settings.validate()
            if not is_valid:
                # 恢复原设置
                self.settings = old_settings
                return False, f"设置验证失败: {error_msg}"
            
            # 保存设置
            if not self.save_settings(self.settings):
                # 恢复原设置
                self.settings = old_settings
                return False, "保存设置失败"
            
            # 通知变更监听器
            self._notify_change_listeners(old_settings, updates)
            
            return True, ""
            
        except Exception as e:
            return False, f"更新设置失败: {str(e)}"
    
    def get_settings(self) -> AppSettings:
        """
        获取当前设置
        
        Returns:
            当前设置对象的副本
        """
        return AppSettings.from_dict(self.settings.to_dict())
    
    def get_settings_dict(self) -> dict:
        """
        获取当前设置的字典形式
        
        Returns:
            设置字典
        """
        return self.settings.to_dict()
    
    def get_settings_for_ui(self) -> dict:
        """
        获取用于UI显示的设置(API密钥已屏蔽)
        
        Returns:
            屏蔽敏感信息后的设置字典
        """
        settings_dict = self.settings.to_dict()
        masked_keys = self.settings.get_masked_keys()
        
        # 替换为屏蔽后的密钥
        settings_dict.update(masked_keys)
        
        return settings_dict
    
    def reset_to_defaults(self) -> bool:
        """
        重置为默认设置
        
        Returns:
            是否重置成功
        """
        try:
            old_settings = self.get_settings()
            self.settings = AppSettings()
            
            if self.save_settings(self.settings):
                # 通知变更监听器
                self._notify_change_listeners(old_settings, {"reset": True})
                print("✅ [AppSettingsManager] 已重置为默认设置")
                return True
            else:
                return False
                
        except Exception as e:
            print(f"❌ [AppSettingsManager] 重置设置失败: {e}")
            return False
    
    def export_all_data(self) -> Tuple[bool, str]:
        """
        导出所有应用数据(设置、课程、任务、GPA记录)
        
        Returns:
            (是否成功, 导出文件路径或错误消息)
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            export_filename = f"wakeup_export_{timestamp}.json"
            export_path = os.path.join(self.data_dir, export_filename)
            
            export_data = {
                'export_timestamp': datetime.now().isoformat(),
                'app_version': self.settings.app_version,
                'settings': self.settings.to_dict(),
                'courses': self._load_json_file(os.path.join(self.data_dir, 'courses.json')),
                'tasks': self._load_json_file(os.path.join(self.data_dir, 'tasks.json')),
                'gpa_records': self._load_json_file(os.path.join(self.data_dir, 'gpa_records.json'))
            }
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=4, ensure_ascii=False)
            
            print(f"✅ [AppSettingsManager] 数据导出成功: {export_path}")
            return True, export_path
            
        except Exception as e:
            error_msg = f"导出数据失败: {str(e)}"
            print(f"❌ [AppSettingsManager] {error_msg}")
            return False, error_msg
    
    def clear_cache(self) -> Tuple[bool, str]:
        """
        清理运行缓存
        
        Returns:
            (是否成功, 消息)
        """
        try:
            cache_dirs = [
                'data/cache',
                'data/temp',
                '__pycache__',
                'backend/__pycache__',
                'backend/core/__pycache__',
                'backend/models/__pycache__'
            ]
            
            cleared_count = 0
            for cache_dir in cache_dirs:
                if os.path.exists(cache_dir):
                    shutil.rmtree(cache_dir)
                    cleared_count += 1
            
            message = f"已清理 {cleared_count} 个缓存目录"
            print(f"✅ [AppSettingsManager] {message}")
            return True, message
            
        except Exception as e:
            error_msg = f"清理缓存失败: {str(e)}"
            print(f"❌ [AppSettingsManager] {error_msg}")
            return False, error_msg
    
    def create_backup(self) -> Tuple[bool, str]:
        """
        创建数据备份
        
        Returns:
            (是否成功, 备份文件路径或错误消息)
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"backup_{timestamp}.json"
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            # 导出所有数据作为备份
            success, result = self.export_all_data()
            if success:
                # 移动导出文件到备份目录
                shutil.move(result, backup_path)
                
                # 清理过期备份
                self._cleanup_old_backups()
                
                print(f"✅ [AppSettingsManager] 备份创建成功: {backup_path}")
                return True, backup_path
            else:
                return False, result
                
        except Exception as e:
            error_msg = f"创建备份失败: {str(e)}"
            print(f"❌ [AppSettingsManager] {error_msg}")
            return False, error_msg
    
    def _cleanup_old_backups(self):
        """清理过期的备份文件"""
        try:
            if not os.path.exists(self.backup_dir):
                return
            
            retention_days = self.settings.backup_retention_days
            current_time = datetime.now()
            
            for filename in os.listdir(self.backup_dir):
                if not filename.startswith('backup_'):
                    continue
                
                file_path = os.path.join(self.backup_dir, filename)
                file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                age_days = (current_time - file_time).days
                
                if age_days > retention_days:
                    os.remove(file_path)
                    print(f"🗑️ [AppSettingsManager] 删除过期备份: {filename} (已保留 {age_days} 天)")
                    
        except Exception as e:
            print(f"⚠️ [AppSettingsManager] 清理过期备份失败: {e}")
    
    def _backup_corrupted_file(self):
        """备份损坏的设置文件"""
        try:
            if os.path.exists(self.settings_file):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_filename = f"corrupted_settings_{timestamp}.json"
                backup_path = os.path.join(self.backup_dir, backup_filename)
                shutil.copy2(self.settings_file, backup_path)
                print(f"📦 [AppSettingsManager] 已备份损坏的设置文件: {backup_path}")
        except Exception as e:
            print(f"⚠️ [AppSettingsManager] 备份损坏文件失败: {e}")
    
    def _load_json_file(self, file_path: str) -> dict:
        """加载JSON文件"""
        try:
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"⚠️ [AppSettingsManager] 加载文件失败 {file_path}: {e}")
        return {}
    
    def add_change_listener(self, listener: Callable[[AppSettings, dict], None]):
        """
        添加设置变更监听器
        
        Args:
            listener: 监听器函数，接收 (新设置, 变更字典) 参数
        """
        if listener not in self._change_listeners:
            self._change_listeners.append(listener)
            print(f"✅ [AppSettingsManager] 添加变更监听器: {listener.__name__}")
    
    def remove_change_listener(self, listener: Callable[[AppSettings, dict], None]):
        """
        移除设置变更监听器
        
        Args:
            listener: 要移除的监听器函数
        """
        if listener in self._change_listeners:
            self._change_listeners.remove(listener)
            print(f"✅ [AppSettingsManager] 移除变更监听器: {listener.__name__}")
    
    def _notify_change_listeners(self, old_settings: AppSettings, changes: dict):
        """
        通知所有变更监听器
        
        Args:
            old_settings: 变更前的设置
            changes: 变更内容
        """
        try:
            for listener in self._change_listeners:
                try:
                    listener(self.settings, changes)
                except Exception as e:
                    print(f"⚠️ [AppSettingsManager] 监听器 {listener.__name__} 执行失败: {e}")
        except Exception as e:
            print(f"❌ [AppSettingsManager] 通知监听器失败: {e}")
    
    def get_statistics(self) -> dict:
        """
        获取设置统计信息
        
        Returns:
            统计信息字典
        """
        return {
            'settings_file': self.settings_file,
            'file_exists': os.path.exists(self.settings_file),
            'last_modified': self.settings.last_modified,
            'app_version': self.settings.app_version,
            'features_enabled': {
                'notifications': self.settings.enable_notifications,
                'auto_save': self.settings.auto_save,
                'auto_backup': self.settings.auto_backup,
                'weather': self.settings.weather_enabled,
                'shici': self.settings.shici_enabled,
                'ai_learning': self.settings.ai_learning_enabled,
                'ai_task_parsing': self.settings.ai_task_parsing_enabled,
                'gpu_acceleration': self.settings.gpu_acceleration,
                'ui_transitions': self.settings.ui_transitions
            },
            'listeners_count': len(self._change_listeners),
            'version': self.settings.version
        }
