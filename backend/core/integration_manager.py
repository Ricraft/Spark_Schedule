"""
集成管理器 - 统一各功能模块的数据流和通信机制

负责协调各个管理器之间的交互，确保数据一致性和错误处理的统一性
"""

import json
import os
import logging
from typing import Dict, Any, List, Optional, Tuple, Callable, Set
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

try:
    from .course_group_manager import CourseGroupManager
    from .settings_manager import SettingsManager
    from ..utils.color_manager import ColorManager
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..models.schedule_settings import ScheduleSettings
except ImportError:
    from course_group_manager import CourseGroupManager
    from settings_manager import SettingsManager
    from utils.color_manager import ColorManager
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail
    from models.schedule_settings import ScheduleSettings


class OperationType(Enum):
    """操作类型枚举"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    IMPORT = "import"
    EXPORT = "export"
    SYNC = "sync"


class OperationStatus(Enum):
    """操作状态枚举"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class OperationResult:
    """操作结果数据类"""
    operation_id: str
    operation_type: OperationType
    status: OperationStatus
    message: str
    data: Optional[Dict[str, Any]] = None
    error_details: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        result = asdict(self)
        result['operation_type'] = self.operation_type.value
        result['status'] = self.status.value
        result['timestamp'] = self.timestamp.isoformat()
        return result


@dataclass
class DataFlowEvent:
    """数据流事件"""
    event_type: str
    source_module: str
    target_modules: List[str]
    data: Dict[str, Any]
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


class IntegrationManager:
    """
    集成管理器
    
    统一管理各功能模块间的数据流、错误处理和状态同步
    """
    
    def __init__(self, data_dir: str = "data"):
        """
        初始化集成管理器
        
        Args:
            data_dir: 数据目录路径
        """
        self.data_dir = data_dir
        self.logger = self._setup_logger()
        
        # 初始化各管理器
        settings_file = os.path.join(self.data_dir, "settings.json")
        backup_dir = os.path.join(self.data_dir, "backups")
        self.settings_manager = SettingsManager(settings_file=settings_file, backup_dir=backup_dir)
        self.color_manager = ColorManager()
        self.course_group_manager = CourseGroupManager()
        
        # 操作历史和状态跟踪
        self.operation_history: List[OperationResult] = []
        self.active_operations: Dict[str, OperationResult] = {}
        self.event_listeners: Dict[str, List[Callable]] = {}
        
        # 跟踪已创建的课程ID
        self.created_courses: Set[str] = set()
        
        # 数据一致性检查器
        self.consistency_checkers: List[Callable] = []
        
        # 注册默认事件监听器
        self._register_default_listeners()
        
        self.logger.info("集成管理器初始化完成")
    
    def _setup_logger(self) -> logging.Logger:
        """设置日志记录器"""
        logger = logging.getLogger('IntegrationManager')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _register_default_listeners(self):
        """注册默认事件监听器"""
        # 设置变更监听器
        self.register_event_listener('settings_changed', self._handle_settings_change)
        
        # 课程变更监听器
        self.register_event_listener('course_added', self._handle_course_change)
        self.register_event_listener('course_updated', self._handle_course_change)
        self.register_event_listener('course_deleted', self._handle_course_change)
        
        # 分组变更监听器
        self.register_event_listener('group_created', self._handle_group_change)
        self.register_event_listener('group_updated', self._handle_group_change)
        self.register_event_listener('group_deleted', self._handle_group_change)
    
    def register_event_listener(self, event_type: str, callback: Callable):
        """
        注册事件监听器
        
        Args:
            event_type: 事件类型
            callback: 回调函数
        """
        if event_type not in self.event_listeners:
            self.event_listeners[event_type] = []
        self.event_listeners[event_type].append(callback)
        self.logger.debug(f"注册事件监听器: {event_type}")
    
    def emit_event(self, event: DataFlowEvent):
        """
        发送事件
        
        Args:
            event: 数据流事件
        """
        self.logger.info(f"发送事件: {event.event_type} from {event.source_module}")
        
        # 通知所有监听器
        if event.event_type in self.event_listeners:
            for callback in self.event_listeners[event.event_type]:
                try:
                    callback(event)
                except Exception as e:
                    self.logger.error(f"事件监听器执行失败: {e}")
    
    def start_operation(self, operation_type: OperationType, description: str) -> str:
        """
        开始一个操作
        
        Args:
            operation_type: 操作类型
            description: 操作描述
            
        Returns:
            操作ID
        """
        operation_id = f"{operation_type.value}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        operation = OperationResult(
            operation_id=operation_id,
            operation_type=operation_type,
            status=OperationStatus.IN_PROGRESS,
            message=description
        )
        
        self.active_operations[operation_id] = operation
        self.logger.info(f"开始操作: {operation_id} - {description}")
        
        return operation_id
    
    def complete_operation(self, operation_id: str, success: bool, message: str, 
                          data: Optional[Dict[str, Any]] = None, 
                          error_details: Optional[str] = None):
        """
        完成操作
        
        Args:
            operation_id: 操作ID
            success: 是否成功
            message: 结果消息
            data: 结果数据
            error_details: 错误详情
        """
        if operation_id not in self.active_operations:
            self.logger.warning(f"未找到操作: {operation_id}")
            return
        
        operation = self.active_operations[operation_id]
        operation.status = OperationStatus.SUCCESS if success else OperationStatus.FAILED
        operation.message = message
        operation.data = data
        operation.error_details = error_details
        
        # 移动到历史记录
        self.operation_history.append(operation)
        del self.active_operations[operation_id]
        
        # 保留最近100条记录
        if len(self.operation_history) > 100:
            self.operation_history = self.operation_history[-100:]
        
        self.logger.info(f"完成操作: {operation_id} - {message}")
    
    def create_course_with_integration(self, course_data: Dict[str, Any]) -> Tuple[bool, str, Optional[str]]:
        """
        集成式创建课程
        
        Args:
            course_data: 课程数据
            
        Returns:
            (是否成功, 消息, 课程ID)
        """
        operation_id = self.start_operation(OperationType.CREATE, "创建课程")
        
        try:
            # 1. 数据验证
            if not self._validate_course_data(course_data):
                raise ValueError("课程数据验证失败")
            
            # 2. 创建课程基础信息
            course_base = CourseBase(
                course_id=course_data.get('id', f"course_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
                name=course_data.get('name', ''),
                color=course_data.get('color', ''),
                note=course_data.get('note', '')
            )
            
            # 3. 创建课程详细信息
            course_detail = CourseDetail(
                course_id=course_base.course_id,
                teacher=course_data.get('teacher', ''),
                location=course_data.get('location', ''),
                day_of_week=course_data.get('day', 1),
                start_section=course_data.get('start', 1),
                step=course_data.get('duration', 1),
                start_week=course_data.get('start_week', 1),
                end_week=course_data.get('end_week', 16),
                week_type=course_data.get('week_type', 1)
            )
            
            # 4. 自动分组处理
            group, is_new_group = self.course_group_manager.create_or_update_group(
                course_base, course_detail
            )
            
            # 5. 自动配色处理
            if not course_base.color and group:
                course_base.color = group.color
            elif not course_base.color:
                course_base.color = self.color_manager.get_random_color()
            
            # 6. 发送事件通知
            event = DataFlowEvent(
                event_type='course_added',
                source_module='IntegrationManager',
                target_modules=['UI', 'Storage'],
                data={
                    'course_id': course_base.course_id,
                    'group_id': group.id if group else None,
                    'is_new_group': is_new_group
                }
            )
            self.emit_event(event)
            
            # 7. 跟踪已创建的课程
            self.created_courses.add(course_base.course_id)
            
            self.complete_operation(operation_id, True, "课程创建成功", {
                'course_id': course_base.course_id,
                'group_id': group.id if group else None
            })
            
            return True, "课程创建成功", course_base.course_id
            
        except Exception as e:
            error_msg = f"创建课程失败: {str(e)}"
            self.logger.error(error_msg)
            self.complete_operation(operation_id, False, error_msg, error_details=str(e))
            return False, error_msg, None
    
    def update_course_with_integration(self, course_id: str, updates: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Update a course with integrated side effects.

        Args:
            course_id: Course ID.
            updates: Update payload.

        Returns:
            (success, message)
        """
        operation_id = self.start_operation(OperationType.UPDATE, f"Update course {course_id}")

        try:
            if course_id not in self.created_courses and not self.course_group_manager.get_course_group_id(course_id):
                raise ValueError(f"Course not found: {course_id}")

            group_id = self.course_group_manager.get_course_group_id(course_id)

            # Keep group core properties in sync when identity fields are updated.
            if group_id and any(key in updates for key in ['name', 'teacher', 'location']):
                group_updates = {k: updates[k] for k in ['name', 'teacher', 'location'] if k in updates}
                success, msg = self.course_group_manager.sync_group_properties(group_id, group_updates)
                if not success:
                    raise ValueError(msg)

            # Keep group color synchronized.
            if group_id and 'color' in updates:
                success, msg = self.course_group_manager.sync_group_properties(group_id, {'color': updates['color']})
                if not success:
                    raise ValueError(msg)

            event = DataFlowEvent(
                event_type='course_updated',
                source_module='IntegrationManager',
                target_modules=['UI', 'Storage'],
                data={'course_id': course_id, 'updates': updates, 'group_id': group_id}
            )
            self.emit_event(event)

            self.complete_operation(operation_id, True, "Course updated successfully")
            return True, "Course updated successfully"

        except Exception as e:
            error_msg = f"Failed to update course: {str(e)}"
            self.logger.error(error_msg)
            self.complete_operation(operation_id, False, error_msg, error_details=str(e))
            return False, error_msg

    def delete_course_with_integration(self, course_id: str) -> Tuple[bool, str]:
        """
        集成式删除课程
        
        Args:
            course_id: 课程ID
            
        Returns:
            (是否成功, 消息)
        """
        operation_id = self.start_operation(OperationType.DELETE, f"删除课程 {course_id}")
        
        try:
            # 1. 从分组中移除
            affected_groups = self.course_group_manager.remove_course_from_groups(course_id)
            
            # 2. 发送事件通知
            # affected_groups is a list of group IDs (strings), not group objects
            event = DataFlowEvent(
                event_type='course_deleted',
                source_module='IntegrationManager',
                target_modules=['UI', 'Storage'],
                data={
                    'course_id': course_id,
                    'affected_groups': affected_groups if isinstance(affected_groups, list) else []
                }
            )
            self.emit_event(event)
            
            # 3. 从跟踪集合中移除
            self.created_courses.discard(course_id)
            
            self.complete_operation(operation_id, True, "课程删除成功")
            return True, "课程删除成功"
            
        except Exception as e:
            error_msg = f"删除课程失败: {str(e)}"
            self.logger.error(error_msg)
            self.complete_operation(operation_id, False, error_msg, error_details=str(e))
            return False, error_msg
    
    def update_settings_with_integration(self, updates: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Update settings with integrated consistency checks.

        Args:
            updates: Settings payload.

        Returns:
            (success, message)
        """
        operation_id = self.start_operation(OperationType.UPDATE, "Update global settings")

        try:
            success, error_msg = self.settings_manager.update_settings(updates)
            if not success:
                raise ValueError(error_msg)

            conflict_warning = ""
            if 'semester_weeks' in updates:
                courses_file = os.path.join(self.data_dir, "courses.json")
                courses_data = []
                if os.path.exists(courses_file):
                    with open(courses_file, 'r', encoding='utf-8') as f:
                        courses_data = json.load(f)
                conflicts = self.settings_manager.check_course_week_conflicts(courses_data)
                if conflicts:
                    conflict_warning = f"Detected {len(conflicts)} courses outside the new semester range"

            event = DataFlowEvent(
                event_type='settings_changed',
                source_module='IntegrationManager',
                target_modules=['UI', 'CourseManager'],
                data={'updates': updates, 'conflict_warning': conflict_warning}
            )
            self.emit_event(event)

            final_msg = "Settings updated successfully"
            if conflict_warning:
                final_msg = f"{final_msg} ({conflict_warning})"

            self.complete_operation(operation_id, True, final_msg)
            return True, final_msg

        except Exception as e:
            error_msg = f"Failed to update settings: {str(e)}"
            self.logger.error(error_msg)
            self.complete_operation(operation_id, False, error_msg, error_details=str(e))
            return False, error_msg

    def _validate_course_data(self, course_data: Dict[str, Any]) -> bool:
        """
        验证课程数据
        
        Args:
            course_data: 课程数据
            
        Returns:
            是否有效
        """
        required_fields = ['name']
        for field in required_fields:
            if field not in course_data or not course_data[field]:
                self.logger.error(f"缺少必需字段: {field}")
                return False
        
        return True
    
    def handle_settings_change(self, settings: Dict[str, Any]):
        """
        公开的设置变更处理接口
        
        Args:
            settings: 新的设置字典
        """
        # 封装成事件并处理
        event = DataFlowEvent(
            event_type='settings_changed',
            source_module='AppBridge',
            target_modules=['IntegrationManager'],
            data={'updates': settings}
        )
        self._handle_settings_change(event)

    def _handle_settings_change(self, event: DataFlowEvent):
        """处理设置变更事件"""
        self.logger.info(f"处理设置变更: {event.data}")
        
        # 检查是否需要重新验证课程数据
        updates = event.data.get('updates', {})
        if 'semester_weeks' in updates:
            self.logger.info("学期周数变更，需要检查课程冲突")
    
    def _handle_course_change(self, event: DataFlowEvent):
        """处理课程变更事件"""
        self.logger.info(f"处理课程变更: {event.event_type} - {event.data}")
    
    def _handle_group_change(self, event: DataFlowEvent):
        """处理分组变更事件"""
        self.logger.info(f"处理分组变更: {event.event_type} - {event.data}")
    
    def get_operation_status(self, operation_id: str) -> Optional[OperationResult]:
        """
        获取操作状态
        
        Args:
            operation_id: 操作ID
            
        Returns:
            操作结果
        """
        # 先检查活跃操作
        if operation_id in self.active_operations:
            return self.active_operations[operation_id]
        
        # 再检查历史记录
        for operation in self.operation_history:
            if operation.operation_id == operation_id:
                return operation
        
        return None
    
    def get_system_status(self) -> Dict[str, Any]:
        """
        获取系统状态
        
        Returns:
            系统状态信息
        """
        return {
            'active_operations': len(self.active_operations),
            'total_operations': len(self.operation_history),
            'settings_status': 'healthy',
            'group_manager_status': 'healthy',
            'color_manager_status': 'healthy',
            'last_operation': self.operation_history[-1].to_dict() if self.operation_history else None
        }
    
    def perform_consistency_check(self) -> List[str]:
        """
        执行数据一致性检查
        
        Returns:
            发现的问题列表
        """
        issues = []
        
        try:
            # 检查设置一致性
            settings = self.settings_manager.get_settings_dict()
            if not settings:
                issues.append("无法获取设置数据")
            
            # 检查分组一致性
            groups = self.course_group_manager.get_all_groups()
            for group in groups:
                if not group.course_ids:
                    issues.append(f"分组 {group.name} 没有关联的课程")
            
            self.logger.info(f"一致性检查完成，发现 {len(issues)} 个问题")
            
        except Exception as e:
            issues.append(f"一致性检查失败: {str(e)}")
            self.logger.error(f"一致性检查异常: {e}")
        
        return issues
