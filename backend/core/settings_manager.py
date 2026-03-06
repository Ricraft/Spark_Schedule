"""
设置管理器

负责课程表全局设置的加载、保存和验证
实现设置变更的通知机制
"""

import os
import json
import threading
import builtins
from typing import Optional, Callable, List, Tuple, Any
from datetime import datetime

try:
    from ..models.schedule_settings import ScheduleSettings
except ImportError:
    from models.schedule_settings import ScheduleSettings


def _safe_print(*args, **kwargs):
    """Avoid logger prints crashing business logic under non-UTF consoles."""
    try:
        builtins.print(*args, **kwargs)
    except UnicodeEncodeError:
        text = " ".join(str(arg) for arg in args)
        builtins.print(text.encode("ascii", errors="ignore").decode("ascii", errors="ignore"), **kwargs)


print = _safe_print


class SettingsManager:
    """
    设置管理器
    
    管理课程表全局设置的完整生命周期，包括加载、保存、验证和变更通知
    """
    
    def __init__(self, settings_file: str = "data/settings.json", backup_dir: Optional[str] = None):
            """
            初始化设置管理器

            Args:
                settings_file: 设置文件路径
            """
            self.settings_file = settings_file
            self.settings: ScheduleSettings = ScheduleSettings()
            self._change_listeners: List[Callable[[ScheduleSettings, dict], None]] = []
            self._last_backup_date: Optional[str] = None  # 上次备份日期
            self.current_version = "1.0"  # 当前支持的设置版本

            # 批处理相关
            self._pending_updates: dict = {}  # 待处理的更新
            self._batch_timer: Optional[Any] = None  # 批处理定时器
            self._batch_lock = threading.Lock()  # 批处理锁
            self._batch_delay = 0.5  # 批处理延迟（秒）
            self._batch_base_settings: Optional[ScheduleSettings] = None
            self._batch_has_unsaved_changes: bool = False

            # 确保数据目录存在
            settings_dir = os.path.dirname(os.path.abspath(self.settings_file))
            os.makedirs(settings_dir, exist_ok=True)

            # 确保备份目录存在
            self.backup_dir = backup_dir or os.path.join(settings_dir, "backups")
            os.makedirs(self.backup_dir, exist_ok=True)

            # 加载现有设置
            self.load_settings()

            # 执行备份保留策略
            self._cleanup_old_backups()

    
    def load_settings(self) -> ScheduleSettings:
        """
        从文件加载设置
        
        Returns:
            加载的设置对象
        """
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 检查版本并执行迁移
                loaded_version = data.get('version', '0.0')
                if loaded_version != self.current_version:
                    print(f"🔄 [SettingsManager] 检测到旧版本设置 ({loaded_version}), 执行迁移到 {self.current_version}")
                    data = self._migrate_settings(data, loaded_version)
                
                # 从字典创建设置对象
                self.settings = ScheduleSettings.from_dict(data)
                
                # 验证加载的设置
                is_valid, error_msg = self.settings.validate()
                if not is_valid:
                    print(f"⚠️ [SettingsManager] 设置验证失败: {error_msg}, 使用默认设置")
                    self.settings = ScheduleSettings()
                    self.save_settings(self.settings)
                else:
                    # 如果版本已迁移，保存更新后的设置
                    if loaded_version != self.current_version:
                        print(f"💾 [SettingsManager] 保存迁移后的设置")
                        self.save_settings(self.settings)
                    print(f"✅ [SettingsManager] 成功加载设置: {self.settings.get_display_name()}")
            else:
                # 文件不存在，创建默认设置
                print("📝 [SettingsManager] 设置文件不存在，创建默认设置")
                self.settings = ScheduleSettings()
                self.save_settings(self.settings)
                
        except (json.JSONDecodeError, ValueError) as e:
            # 文件损坏，备份并使用默认设置
            print(f"❌ [SettingsManager] 设置文件损坏: {e}")
            self._backup_corrupted_file()
            self.settings = ScheduleSettings()
            # 尝试保存默认设置
            try:
                self.save_settings(self.settings)
            except Exception as save_error:
                print(f"❌ [SettingsManager] 保存默认设置失败: {save_error}")
        except Exception as e:
            print(f"❌ [SettingsManager] 加载设置失败: {e}, 使用默认设置")
            self.settings = ScheduleSettings()
            # 尝试保存默认设置
            try:
                self.save_settings(self.settings)
            except Exception as save_error:
                print(f"❌ [SettingsManager] 保存默认设置失败: {save_error}")
        
        return self.settings
    
    def _migrate_settings(self, data: dict, from_version: str) -> dict:
        """
        迁移旧版本设置到当前版本
        
        Args:
            data: 旧版本设置数据
            from_version: 旧版本号
            
        Returns:
            迁移后的设置数据
        """
        try:
            # 创建默认设置以获取所有新字段
            default_settings = ScheduleSettings()
            default_dict = default_settings.to_dict()
            
            # 合并策略：保留旧数据，添加缺失的新字段
            migrated_data = default_dict.copy()
            
            # 更新为旧数据中存在的值
            for key, value in data.items():
                if key in migrated_data:
                    migrated_data[key] = value
            
            # 特定版本迁移逻辑
            if from_version == "0.0" or not from_version:
                # 从无版本号迁移到 1.0
                print("  📦 [Migration] 从无版本迁移到 1.0")
                # 添加新的外观设置默认值
                if 'gpu_acceleration' not in data:
                    migrated_data['gpu_acceleration'] = True
                if 'ui_transitions' not in data:
                    migrated_data['ui_transitions'] = True
                if 'acrylic_opacity' not in data:
                    migrated_data['acrylic_opacity'] = 80
                # 添加新的通知设置
                if 'notification_sound' not in data:
                    migrated_data['notification_sound'] = 'bell'
                if 'notification_volume' not in data:
                    migrated_data['notification_volume'] = 80
                # 添加新的启动行为设置
                if 'auto_start' not in data:
                    migrated_data['auto_start'] = False
                if 'minimize_to_tray' not in data:
                    migrated_data['minimize_to_tray'] = True
                if 'start_minimized' not in data:
                    migrated_data['start_minimized'] = False
                # 添加外部服务设置
                if 'weather_enabled' not in data:
                    migrated_data['weather_enabled'] = False
                if 'shici_enabled' not in data:
                    migrated_data['shici_enabled'] = False
                # 添加 AI 设置
                if 'ai_learning_enabled' not in data:
                    migrated_data['ai_learning_enabled'] = False
                if 'ai_task_parsing_enabled' not in data:
                    migrated_data['ai_task_parsing_enabled'] = False
                # 添加高级设置
                if 'enable_devtools' not in data:
                    migrated_data['enable_devtools'] = False
                if 'show_python_console' not in data:
                    migrated_data['show_python_console'] = False
                if 'performance_overlay' not in data:
                    migrated_data['performance_overlay'] = False
            
            # 更新版本号
            migrated_data['version'] = self.current_version
            
            # 更新修改时间
            migrated_data['last_modified'] = datetime.now().isoformat()
            
            print(f"  ✅ [Migration] 迁移完成: {from_version} -> {self.current_version}")
            return migrated_data
            
        except Exception as e:
            print(f"  ❌ [Migration] 迁移失败: {e}, 使用默认设置")
            # 迁移失败，返回默认设置
            return ScheduleSettings().to_dict()
    
    def save_settings(self, settings: ScheduleSettings) -> bool:
        """
        保存设置到文件（使用原子写入）
        
        Args:
            settings: 要保存的设置对象
            
        Returns:
            是否保存成功
        """
        temp_file = None
        try:
            # 验证设置
            is_valid, error_msg = settings.validate()
            if not is_valid:
                print(f"❌ [SettingsManager] 设置验证失败: {error_msg}")
                return False
            
            # 更新修改时间
            settings.update_modified_time()
            
            # 确保目标目录存在
            settings_dir = os.path.dirname(os.path.abspath(self.settings_file))
            os.makedirs(settings_dir, exist_ok=True)
            
            # 使用原子写入：先写入临时文件
            temp_file = self.settings_file + '.tmp'
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(settings.to_dict(), f, indent=4, ensure_ascii=False)
            
            # 原子地将临时文件重命名为目标文件
            # os.replace() 在所有平台上都是原子操作
            os.replace(temp_file, self.settings_file)
            
            print(f"✅ [SettingsManager] 设置保存成功: {settings.get_display_name()}")
            
            # 检查是否需要创建备份
            self._check_and_create_backup()
            
            return True
            
        except Exception as e:
            print(f"❌ [SettingsManager] 保存设置失败: {e}")
            # 清理临时文件
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    print(f"🧹 [SettingsManager] 已清理临时文件: {temp_file}")
                except Exception as cleanup_error:
                    print(f"⚠️ [SettingsManager] 清理临时文件失败: {cleanup_error}")
            return False
    
    def update_settings(self, updates: dict) -> Tuple[bool, str]:
        """
        Update settings with dependency-safe validation.

        Args:
            updates: Setting key/value pairs.

        Returns:
            (success, error_message)
        """
        try:
            if not isinstance(updates, dict):
                return False, "参数类型错误，必须传入对象"
            if not updates:
                return True, ""

            old_settings = ScheduleSettings.from_dict(self.settings.to_dict())
            target_settings = ScheduleSettings.from_dict(self.settings.to_dict())

            for key, value in updates.items():
                if not hasattr(target_settings, key):
                    return False, f"未知的设置项: {key}"
                setattr(target_settings, key, value)

            for key, value in updates.items():
                is_valid, error_msg = target_settings.validate_field(key, value)
                if not is_valid:
                    return False, f"{key}: {error_msg}"

            # Keep update API lenient for key strength while still enforcing structural validity.
            is_valid, error_msg = target_settings.validate(ignore_key_strength=True)
            if not is_valid:
                return False, error_msg

            with self._batch_lock:
                if self._batch_base_settings is None:
                    self._batch_base_settings = ScheduleSettings.from_dict(old_settings.to_dict())

                self.settings = target_settings
                self._pending_updates.update(updates)

                is_first_update_in_batch = self._batch_timer is None
                if self._batch_timer is not None:
                    self._batch_timer.cancel()

                self._batch_timer = threading.Timer(self._batch_delay, self._process_batched_updates)
                self._batch_timer.daemon = True
                self._batch_timer.start()

                if not is_first_update_in_batch:
                    self._batch_has_unsaved_changes = True

            # Persist first update immediately for crash resilience and existing sync expectations.
            if is_first_update_in_batch:
                if not self.save_settings(self.settings):
                    with self._batch_lock:
                        self.settings = old_settings
                        if self._batch_timer is not None:
                            self._batch_timer.cancel()
                        self._batch_timer = None
                        self._pending_updates.clear()
                        self._batch_base_settings = None
                        self._batch_has_unsaved_changes = False
                    return False, "保存设置失败"
                with self._batch_lock:
                    self._batch_has_unsaved_changes = False

            return True, ""

        except Exception as e:
            return False, f"更新设置失败: {str(e)}"

    def _process_batched_updates(self):
        """
        Process queued settings updates.

        Runs after the batch window and applies pending updates once.
        """
        try:
            with self._batch_lock:
                updates = self._pending_updates.copy()
                old_settings = self._batch_base_settings or ScheduleSettings.from_dict(self.settings.to_dict())
                final_settings = ScheduleSettings.from_dict(self.settings.to_dict())
                should_save = self._batch_has_unsaved_changes
                self._pending_updates.clear()
                self._batch_timer = None
                self._batch_base_settings = None
                self._batch_has_unsaved_changes = False

            if not updates:
                return

            if should_save:
                if not self.save_settings(final_settings):
                    print("[SettingsManager] Batch save failed")
                    return

            self._notify_change_listeners(old_settings, updates)
            print(f"[SettingsManager] Batch update success: {len(updates)} items")

        except Exception as e:
            print(f"[SettingsManager] Batch update failed: {e}")

    def flush_pending_updates(self) -> Tuple[bool, str]:
        """
        立即处理所有待处理的更新
        
        用于测试或需要立即保存的场景
        
        Returns:
            (是否成功, 错误消息)
        """
        try:
            with self._batch_lock:
                # 取消定时器
                if self._batch_timer is not None:
                    self._batch_timer.cancel()
                    self._batch_timer = None
            
            # 立即处理更新
            self._process_batched_updates()
            
            return True, ""
            
        except Exception as e:
            return False, f"刷新待处理更新失败: {str(e)}"
    
    def validate_field(self, field_name: str, value: any) -> Tuple[bool, str]:
        """
        验证单个字段的值
        
        Args:
            field_name: 字段名称
            value: 字段值
            
        Returns:
            (是否有效, 错误消息)
        """
        return self.settings.validate_field(field_name, value)
    
    def get_settings(self) -> ScheduleSettings:
        """
        获取当前设置
        
        Returns:
            当前设置对象的副本
        """
        return ScheduleSettings.from_dict(self.settings.to_dict())
    
    def get_settings_dict(self) -> dict:
        """
        获取当前设置的字典形式
        
        Returns:
            设置字典
        """
        return self.settings.to_dict()
    
    def reset_to_defaults(self) -> bool:
        """
        重置为默认设置
        
        Returns:
            是否重置成功
        """
        try:
            old_settings = self.get_settings()
            self.settings = ScheduleSettings()
            
            if self.save_settings(self.settings):
                # 通知变更监听器
                self._notify_change_listeners(old_settings, {"reset": True})
                print("✅ [SettingsManager] 已重置为默认设置")
                return True
            else:
                return False
                
        except Exception as e:
            print(f"❌ [SettingsManager] 重置设置失败: {e}")
            return False
    
    def validate_settings(self, settings: ScheduleSettings) -> Tuple[bool, str]:
        """
        验证设置的有效性
        
        Args:
            settings: 要验证的设置对象
            
        Returns:
            (是否有效, 错误消息)
        """
        return settings.validate()
    
    def add_change_listener(self, listener: Callable[[ScheduleSettings, dict], None]):
        """
        添加设置变更监听器
        
        Args:
            listener: 监听器函数，接收 (新设置, 变更字典) 参数
        """
        if listener not in self._change_listeners:
            self._change_listeners.append(listener)
            print(f"✅ [SettingsManager] 添加变更监听器: {listener.__name__}")
    
    def remove_change_listener(self, listener: Callable[[ScheduleSettings, dict], None]):
        """
        移除设置变更监听器
        
        Args:
            listener: 要移除的监听器函数
        """
        if listener in self._change_listeners:
            self._change_listeners.remove(listener)
            print(f"✅ [SettingsManager] 移除变更监听器: {listener.__name__}")
    
    def _notify_change_listeners(self, old_settings: ScheduleSettings, changes: dict):
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
                    print(f"⚠️ [SettingsManager] 监听器 {listener.__name__} 执行失败: {e}")
        except Exception as e:
            print(f"❌ [SettingsManager] 通知监听器失败: {e}")
    
    def get_week_options(self) -> List[int]:
        """
        获取可选的周数列表
        
        Returns:
            周数选项列表
        """
        return self.settings.get_week_range()
    
    def is_week_valid(self, week: int) -> bool:
        """
        检查周数是否在当前设置的有效范围内
        
        Args:
            week: 要检查的周数
            
        Returns:
            是否有效
        """
        return self.settings.is_week_valid(week)
    
    def check_course_week_conflicts(self, courses_data: List[dict]) -> List[dict]:
        """
        检查课程周数是否与当前设置冲突
        
        Args:
            courses_data: 课程数据列表
            
        Returns:
            冲突的课程列表
        """
        conflicts = []
        
        try:
            for course in courses_data:
                # 解析课程的周数信息
                weeks_str = course.get('weeks', '')
                week_list = course.get('week_list', [])
                
                # 检查week_list中的周数
                if week_list:
                    for week in week_list:
                        if not self.is_week_valid(week):
                            conflicts.append({
                                'course': course,
                                'conflict_type': 'week_out_of_range',
                                'invalid_week': week,
                                'max_week': self.settings.semester_weeks
                            })
                            break
                
                # 检查weeks字符串格式的周数
                elif weeks_str:
                    try:
                        # 解析 "1-16" 格式
                        if '-' in weeks_str:
                            start_week, end_week = map(int, weeks_str.split('-'))
                            if not self.is_week_valid(start_week) or not self.is_week_valid(end_week):
                                conflicts.append({
                                    'course': course,
                                    'conflict_type': 'week_range_out_of_bounds',
                                    'week_range': weeks_str,
                                    'max_week': self.settings.semester_weeks
                                })
                    except (ValueError, AttributeError):
                        # 周数格式无效，但不算冲突
                        pass
                        
        except Exception as e:
            print(f"❌ [SettingsManager] 检查课程周数冲突失败: {e}")
        
        return conflicts
    
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
            'semester_weeks': self.settings.semester_weeks,
            'start_date': self.settings.start_date,
            'features_enabled': {
                'auto_color_import': self.settings.auto_color_import,
                'course_grouping': self.settings.enable_course_grouping,
                'ui_animations': self.settings.ui_animations,
                'show_weekends': self.settings.show_weekends
            },
            'listeners_count': len(self._change_listeners),
            'version': self.settings.version
        }
    
    def export_settings(self, export_path: str) -> bool:
        """
        导出设置到指定文件
        
        Args:
            export_path: 导出文件路径
            
        Returns:
            是否导出成功
        """
        try:
            # 添加导出元数据
            export_data = self.settings.to_dict()
            export_data['export_timestamp'] = datetime.now().isoformat()
            export_data['export_source'] = self.settings_file
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=4, ensure_ascii=False)
            
            print(f"✅ [SettingsManager] 设置导出成功: {export_path}")
            return True
            
        except Exception as e:
            print(f"❌ [SettingsManager] 导出设置失败: {e}")
            return False
    
    def import_settings(self, import_path: str) -> Tuple[bool, str]:
        """
        从指定文件导入设置
        
        Args:
            import_path: 导入文件路径
            
        Returns:
            (是否成功, 错误消息)
        """
        try:
            if not os.path.exists(import_path):
                return False, "导入文件不存在"
            
            with open(import_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 移除导出元数据
            data.pop('export_timestamp', None)
            data.pop('export_source', None)
            
            # 创建设置对象并验证
            imported_settings = ScheduleSettings.from_dict(data)
            is_valid, error_msg = imported_settings.validate()
            
            if not is_valid:
                return False, f"导入的设置无效: {error_msg}"
            
            # 备份当前设置
            old_settings = self.get_settings()
            
            # 应用导入的设置
            self.settings = imported_settings
            
            if self.save_settings(self.settings):
                # 通知变更监听器
                self._notify_change_listeners(old_settings, {"imported": True})
                print(f"✅ [SettingsManager] 设置导入成功: {import_path}")
                return True, ""
            else:
                # 恢复原设置
                self.settings = old_settings
                return False, "保存导入的设置失败"
                
        except Exception as e:
            return False, f"导入设置失败: {str(e)}"
    
    def _check_and_create_backup(self):
        """
        检查并创建备份（如果需要）
        
        根据 enable_auto_backup 和 backup_freq 设置决定是否创建备份
        """
        try:
            # 检查是否启用自动备份
            if not self.settings.enable_auto_backup:
                return
            
            # 获取当前日期
            today = datetime.now().strftime("%Y-%m-%d")
            
            # 检查备份频率
            if self.settings.backup_freq == "manual":
                # 手动模式不自动备份
                return
            elif self.settings.backup_freq == "daily":
                # 每日备份：检查今天是否已备份
                if self._last_backup_date == today:
                    return
            elif self.settings.backup_freq == "weekly":
                # 每周备份：检查本周是否已备份
                if self._last_backup_date:
                    last_backup = datetime.strptime(self._last_backup_date, "%Y-%m-%d")
                    now = datetime.now()
                    # 如果在同一周内，不备份
                    if last_backup.isocalendar()[1] == now.isocalendar()[1] and \
                       last_backup.year == now.year:
                        return
            
            # 创建备份
            self._create_backup()
            self._last_backup_date = today
            
        except Exception as e:
            print(f"⚠️ [SettingsManager] 检查备份失败: {e}")
    
    def _create_backup(self) -> bool:
        """
        创建设置文件的备份
        
        Returns:
            是否备份成功
        """
        try:
            # 确保备份目录存在
            os.makedirs(self.backup_dir, exist_ok=True)
            
            # 生成带时间戳的备份文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"settings_{timestamp}.json"
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            # 复制当前设置文件到备份目录
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 添加备份元数据
                data['backup_timestamp'] = datetime.now().isoformat()
                data['backup_source'] = self.settings_file
                
                with open(backup_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                
                print(f"✅ [SettingsManager] 备份创建成功: {backup_filename}")
                return True
            else:
                print(f"⚠️ [SettingsManager] 设置文件不存在，无法备份")
                return False
                
        except Exception as e:
            print(f"❌ [SettingsManager] 创建备份失败: {e}")
            return False
    
    def _backup_corrupted_file(self):
        """
        备份损坏的设置文件
        
        将损坏的文件移动到备份目录，文件名包含 'corrupted' 标记
        """
        try:
            if not os.path.exists(self.settings_file):
                return
            
            # 确保备份目录存在
            os.makedirs(self.backup_dir, exist_ok=True)
            
            # 生成损坏文件的备份文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            corrupted_filename = f"settings_corrupted_{timestamp}.json"
            corrupted_path = os.path.join(self.backup_dir, corrupted_filename)
            
            # 移动损坏的文件到备份目录
            os.replace(self.settings_file, corrupted_path)
            
            print(f"🔧 [SettingsManager] 损坏文件已备份: {corrupted_filename}")
            
        except Exception as e:
            print(f"❌ [SettingsManager] 备份损坏文件失败: {e}")
    
    def _cleanup_old_backups(self):
        """
        清理过期的备份文件
        
        根据 backup_retention_days 设置删除过期的备份
        """
        try:
            if not os.path.exists(self.backup_dir):
                return
            
            # 获取保留天数
            retention_days = self.settings.backup_retention_days
            if retention_days <= 0:
                return
            
            # 计算截止日期
            cutoff_date = datetime.now().timestamp() - (retention_days * 24 * 60 * 60)
            
            # 遍历备份目录
            deleted_count = 0
            for filename in os.listdir(self.backup_dir):
                if not filename.startswith("settings_") or not filename.endswith(".json"):
                    continue
                
                file_path = os.path.join(self.backup_dir, filename)
                
                # 检查文件修改时间
                try:
                    file_mtime = os.path.getmtime(file_path)
                    if file_mtime < cutoff_date:
                        os.remove(file_path)
                        deleted_count += 1
                        print(f"🧹 [SettingsManager] 删除过期备份: {filename}")
                except Exception as e:
                    print(f"⚠️ [SettingsManager] 删除备份文件失败 {filename}: {e}")
            
            if deleted_count > 0:
                print(f"✅ [SettingsManager] 清理完成，删除了 {deleted_count} 个过期备份")
                
        except Exception as e:
            print(f"❌ [SettingsManager] 清理备份失败: {e}")
    
    def create_manual_backup(self) -> Tuple[bool, str]:
        """
        手动创建备份
        
        Returns:
            (是否成功, 备份文件路径或错误消息)
        """
        try:
            if self._create_backup():
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_filename = f"settings_{timestamp}.json"
                backup_path = os.path.join(self.backup_dir, backup_filename)
                return True, backup_path
            else:
                return False, "创建备份失败"
        except Exception as e:
            return False, f"创建备份失败: {str(e)}"
    
    def list_backups(self) -> List[dict]:
        """
        列出所有备份文件
        
        Returns:
            备份文件信息列表
        """
        backups = []
        try:
            if not os.path.exists(self.backup_dir):
                return backups
            
            for filename in os.listdir(self.backup_dir):
                if not filename.startswith("settings_") or not filename.endswith(".json"):
                    continue
                
                file_path = os.path.join(self.backup_dir, filename)
                
                try:
                    # 获取文件信息
                    file_stat = os.stat(file_path)
                    file_mtime = datetime.fromtimestamp(file_stat.st_mtime)
                    file_size = file_stat.st_size
                    
                    # 判断是否为损坏文件备份
                    is_corrupted = "corrupted" in filename
                    
                    backups.append({
                        'filename': filename,
                        'path': file_path,
                        'modified': file_mtime.isoformat(),
                        'size': file_size,
                        'is_corrupted': is_corrupted
                    })
                except Exception as e:
                    print(f"⚠️ [SettingsManager] 读取备份文件信息失败 {filename}: {e}")
            
            # 按修改时间降序排序
            backups.sort(key=lambda x: x['modified'], reverse=True)
            
        except Exception as e:
            print(f"❌ [SettingsManager] 列出备份失败: {e}")
        
        return backups
    
    def restore_from_backup(self, backup_path: str) -> Tuple[bool, str]:
        """
        从备份文件恢复设置
        
        Args:
            backup_path: 备份文件路径
            
        Returns:
            (是否成功, 错误消息)
        """
        try:
            if not os.path.exists(backup_path):
                return False, "备份文件不存在"
            
            # 读取备份文件
            with open(backup_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 移除备份元数据
            data.pop('backup_timestamp', None)
            data.pop('backup_source', None)
            
            # 创建设置对象并验证
            restored_settings = ScheduleSettings.from_dict(data)
            is_valid, error_msg = restored_settings.validate()
            
            if not is_valid:
                return False, f"备份文件中的设置无效: {error_msg}"
            
            # 备份当前设置（以防恢复失败）
            old_settings = self.get_settings()
            
            # 应用恢复的设置
            self.settings = restored_settings
            
            if self.save_settings(self.settings):
                # 通知变更监听器
                self._notify_change_listeners(old_settings, {"restored": True})
                print(f"✅ [SettingsManager] 从备份恢复成功: {backup_path}")
                return True, ""
            else:
                # 恢复原设置
                self.settings = old_settings
                return False, "保存恢复的设置失败"
                
        except Exception as e:
            return False, f"从备份恢复失败: {str(e)}"
