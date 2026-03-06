"""
任务管理器

负责任务的增删改查和业务逻辑
"""

import json
import os
import time
import threading
import builtins
from typing import List, Optional, Dict, Tuple
from datetime import datetime
from ..models.task import Task

# 🔒 跨平台文件锁实现
try:
    import msvcrt  # Windows
    PLATFORM = 'windows'
except ImportError:
    import fcntl  # Unix/Linux/Mac
    PLATFORM = 'unix'


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


class TaskManager:
    """任务管理器类"""

    def __init__(self, data_dir: str = "data"):
        """
        初始化任务管理器

        Args:
            data_dir: 数据目录路径
        """
        self.data_dir = data_dir
        self.tasks_file = os.path.join(data_dir, "tasks.json")
        self.tasks: List[Task] = []
        # Reentrant lock avoids deadlock when load_tasks() calls _save_tasks().
        self._file_lock = threading.RLock()
        self._ensure_data_dir()
        self.load_tasks()

    def _acquire_file_lock(self, file_handle, lock_type='shared', timeout=5):
        """
        跨平台文件锁获取 - 简化版本，避免在打包环境卡死
        """
        if PLATFORM != 'windows':
            # Unix/Linux 使用 fcntl
            import fcntl
            lock_flags = fcntl.LOCK_SH if lock_type == 'shared' else fcntl.LOCK_EX
            start_time = time.time()
            while True:
                try:
                    fcntl.flock(file_handle.fileno(), lock_flags | fcntl.LOCK_NB)
                    return True
                except (IOError, OSError):
                    if time.time() - start_time > timeout:
                        raise TimeoutError("文件锁获取超时")
                    time.sleep(0.1)
        
        # Windows 环境下，打包后 msvcrt.locking 容易出问题
        # 且由于使用了线程锁 threading.Lock()，在单进程应用中已经足够安全
        # 这里仅做尝试，失败则跳过，不阻塞进程
        if PLATFORM == 'windows':
            try:
                import msvcrt
                # 尝试锁定前 100 字节
                # LK_NBLCK: 非阻塞锁定
                msvcrt.locking(file_handle.fileno(), msvcrt.LK_NBLCK, 100)
                return True
            except:
                # 如果锁定失败（例如权限问题或文件已被锁定），我们选择继续
                # 因为 threading.Lock() 已经保证了线程安全
                return True
        
        return True

    def _release_file_lock(self, file_handle):
        """释放文件锁"""
        try:
            if PLATFORM == 'windows':
                import msvcrt
                file_handle.seek(0)
                msvcrt.locking(file_handle.fileno(), msvcrt.LK_UNLCK, 100)
            else:
                import fcntl
                fcntl.flock(file_handle.fileno(), fcntl.LOCK_UN)
        except:
            pass
    
    def _ensure_data_dir(self):
        """确保数据目录存在"""
        os.makedirs(self.data_dir, exist_ok=True)
    
    def load_tasks(self) -> List[Task]:
        """
        从文件加载任务列表（带文件锁保护）

        Returns:
            任务列表
        """
        with self._file_lock:  # 🔒 线程锁
            max_retries = 3
            retry_delay = 0.1

            for attempt in range(max_retries):
                try:
                    if os.path.exists(self.tasks_file):
                        with open(self.tasks_file, 'r', encoding='utf-8') as f:
                            # 🔒 获取共享锁（允许多个进程同时读取）
                            try:
                                self._acquire_file_lock(f, 'shared', timeout=3)
                            except TimeoutError:
                                if attempt < max_retries - 1:
                                    time.sleep(retry_delay)
                                    continue
                                raise

                            try:
                                data = json.load(f)
                                if not isinstance(data, list):
                                    print(f"⚠️ [TaskManager] 数据格式错误，期望列表，实际: {type(data)}")
                                    self.tasks = []
                                else:
                                    self.tasks = [Task.from_dict(task_data) for task_data in data]
                                    print(f"✅ [TaskManager] 加载了 {len(self.tasks)} 个任务")
                            finally:
                                # 释放锁
                                self._release_file_lock(f)
                    else:
                        self.tasks = []
                        self._save_tasks()
                        print("📝 [TaskManager] 创建了新的任务文件")

                    return self.tasks

                except json.JSONDecodeError as e:
                    print(f"❌ [TaskManager] JSON 解析失败: {e}")
                    self.tasks = []
                    return self.tasks
                except TimeoutError as e:
                    print(f"❌ [TaskManager] 文件锁超时: {e}")
                    self.tasks = []
                    return self.tasks
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"⚠️ [TaskManager] 加载任务失败 (尝试 {attempt + 1}/{max_retries}): {e}")
                        time.sleep(retry_delay)
                    else:
                        print(f"❌ [TaskManager] 加载任务失败: {e}")
                        self.tasks = []
                        return self.tasks

            return self.tasks
    
    def _save_tasks(self) -> bool:
        """
        保存任务列表到文件（带文件锁保护）

        Returns:
            是否保存成功
        """
        with self._file_lock:  # 🔒 线程锁
            max_retries = 3
            retry_delay = 0.1

            for attempt in range(max_retries):
                try:
                    # 先写入临时文件，再原子性替换
                    temp_file = self.tasks_file + '.tmp'

                    with open(temp_file, 'w', encoding='utf-8') as f:
                        # 🔒 获取独占锁
                        try:
                            self._acquire_file_lock(f, 'exclusive', timeout=3)
                        except TimeoutError:
                            if attempt < max_retries - 1:
                                time.sleep(retry_delay)
                                continue
                            raise

                        try:
                            data = [task.to_dict() for task in self.tasks]
                            json.dump(data, f, ensure_ascii=False, indent=2)
                            f.flush()
                            os.fsync(f.fileno())  # 强制写入磁盘
                        finally:
                            self._release_file_lock(f)

                    # 原子性替换
                    if os.path.exists(self.tasks_file):
                        os.replace(temp_file, self.tasks_file)
                    else:
                        os.rename(temp_file, self.tasks_file)

                    return True

                except TimeoutError as e:
                    print(f"⚠️ [TaskManager] 保存任务超时 (尝试 {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                    else:
                        return False
                except Exception as e:
                    print(f"❌ [TaskManager] 保存任务失败 (尝试 {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                    else:
                        return False
                finally:
                    # 清理临时文件
                    temp_file = self.tasks_file + '.tmp'
                    if os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except:
                            pass

            return False
    
    def get_all_tasks(self) -> List[Dict]:
        """
        获取所有任务
        
        Returns:
            任务字典列表
        """
        return [task.to_dict() for task in self.tasks]
    
    def get_task_by_id(self, task_id: str) -> Optional[Task]:
        """
        根据ID获取任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务对象，如果不存在则返回None
        """
        for task in self.tasks:
            if task.id == task_id:
                return task
        return None
    
    def get_tasks_by_status(self, status: str) -> List[Dict]:
        """
        根据状态获取任务
        
        Args:
            status: 任务状态 (todo, doing, done)
            
        Returns:
            任务字典列表
        """
        filtered_tasks = [task for task in self.tasks if task.status == status]
        return [task.to_dict() for task in filtered_tasks]
    
    def get_tasks_by_course(self, course_id: str) -> List[Dict]:
        """
        根据课程ID获取任务
        
        Args:
            course_id: 课程ID
            
        Returns:
            任务字典列表
        """
        filtered_tasks = [task for task in self.tasks if task.course_id == course_id]
        return [task.to_dict() for task in filtered_tasks]
    
    def get_exam_tasks(self) -> List[Dict]:
        """
        获取所有考试/重要DDL任务
        
        Returns:
            任务字典列表
        """
        exam_tasks = [task for task in self.tasks if task.is_exam and task.status != 'done']
        # 按截止日期排序
        exam_tasks.sort(key=lambda t: t.deadline if t.deadline else '9999-12-31')
        return [task.to_dict() for task in exam_tasks]
    
    def get_overdue_tasks(self) -> List[Dict]:
        """
        获取所有过期任务
        
        Returns:
            任务字典列表
        """
        overdue_tasks = [task for task in self.tasks if task.is_overdue()]
        return [task.to_dict() for task in overdue_tasks]
    
    def add_task(self, task_data: dict) -> Tuple[bool, str, Optional[Dict]]:
        """
        添加新任务

        Args:
            task_data: 任务数据字典

        Returns:
            (是否成功, 消息, 任务字典)
        """
        try:
            # 🔒 输入验证
            if not isinstance(task_data, dict):
                return False, "任务数据必须是字典类型", None

            # 验证必需字段
            required_fields = ['title']
            for field in required_fields:
                if field not in task_data:
                    return False, f"缺少必需字段: {field}", None

            # 清理和验证字段
            allowed_fields = {
                'id', 'title', 'course_id', 'course_name', 'status',
                'priority', 'is_exam', 'deadline', 'description',
                'tags', 'order', 'created_at', 'updated_at', 'completed_at'
            }
            cleaned_data = {k: v for k, v in task_data.items() if k in allowed_fields}

            # 创建任务对象
            task = Task.from_dict(cleaned_data)

            # 验证任务
            is_valid, error_msg = task.validate()
            if not is_valid:
                return False, error_msg, None

            # 添加到列表
            self.tasks.append(task)

            # 保存
            if self._save_tasks():
                print(f"✅ 添加任务: {task.title}")
                return True, "任务添加成功", task.to_dict()
            else:
                self.tasks.remove(task)
                return False, "保存任务失败", None

        except Exception as e:
            return False, f"添加任务失败: {str(e)}", None
    
    def update_task(self, task_id: str, task_data: dict) -> tuple[bool, str, Optional[Dict]]:
        """
        更新任务

        Args:
            task_id: 任务ID
            task_data: 新的任务数据

        Returns:
            (是否成功, 消息, 任务字典)
        """
        try:
            # 🔒 输入验证
            if not isinstance(task_data, dict):
                return False, "任务数据必须是字典类型", None

            if not isinstance(task_id, str) or not task_id:
                return False, "任务ID无效", None

            # 查找任务
            task = self.get_task_by_id(task_id)
            if not task:
                return False, "任务不存在", None

            # 🔒 只允许更新特定字段
            allowed_fields = {
                'title', 'course_id', 'course_name', 'status',
                'priority', 'is_exam', 'deadline', 'description',
                'tags', 'order'
            }

            # 备份原始数据（用于回滚）
            original_data = task.to_dict()

            # 更新字段
            for key, value in task_data.items():
                if key in allowed_fields and hasattr(task, key):
                    setattr(task, key, value)

            # 更新时间戳
            task.update_timestamp()

            # 验证任务
            is_valid, error_msg = task.validate()
            if not is_valid:
                # 回滚
                for key, value in original_data.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
                return False, error_msg, None

            # 保存
            if self._save_tasks():
                print(f"✅ 更新任务: {task.title}")
                return True, "任务更新成功", task.to_dict()
            else:
                # 回滚
                for key, value in original_data.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
                return False, "保存任务失败", None

        except Exception as e:
            return False, f"更新任务失败: {str(e)}", None
    
    def delete_task(self, task_id: str) -> tuple[bool, str]:
        """
        删除任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            (是否成功, 消息)
        """
        try:
            # 查找任务
            task = self.get_task_by_id(task_id)
            if not task:
                return False, "任务不存在"
            
            # 从列表中移除
            self.tasks.remove(task)
            
            # 保存
            if self._save_tasks():
                print(f"✅ 删除任务: {task.title}")
                return True, "任务删除成功"
            else:
                self.tasks.append(task)
                return False, "保存失败"
                
        except Exception as e:
            return False, f"删除任务失败: {str(e)}"
    
    def update_task_status(self, task_id: str, new_status: str) -> tuple[bool, str, Optional[Dict]]:
        """
        更新任务状态
        
        Args:
            task_id: 任务ID
            new_status: 新状态
            
        Returns:
            (是否成功, 消息, 任务字典)
        """
        task = self.get_task_by_id(task_id)
        if not task:
            return False, "任务不存在", None
        
        task.status = new_status
        if new_status == 'done':
            task.mark_completed()
        else:
            task.update_timestamp()
        
        if self._save_tasks():
            return True, "状态更新成功", task.to_dict()
        else:
            return False, "保存失败", None
    
    def get_statistics(self) -> Dict:
        """
        获取任务统计信息
        
        Returns:
            统计信息字典
        """
        total = len(self.tasks)
        todo = len([t for t in self.tasks if t.status == 'todo'])
        doing = len([t for t in self.tasks if t.status == 'doing'])
        done = len([t for t in self.tasks if t.status == 'done'])
        overdue = len([t for t in self.tasks if t.is_overdue()])
        exams = len([t for t in self.tasks if t.is_exam and t.status != 'done'])
        
        return {
            'total': total,
            'todo': todo,
            'doing': doing,
            'done': done,
            'overdue': overdue,
            'exams': exams,
            'completion_rate': round(done / total * 100, 1) if total > 0 else 0
        }
