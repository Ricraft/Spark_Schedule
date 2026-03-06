"""
任务数据模型

定义任务的数据结构和验证逻辑
"""

from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime
import uuid


@dataclass
class Task:
    """
    任务数据结构
    
    用于管理学习任务、作业、考试等待办事项
    """
    
    # 基本信息
    id: str = ""                                    # 任务唯一标识
    title: str = ""                                 # 任务标题
    course_id: str = ""                             # 关联课程ID（空字符串表示个人杂项）
    course_name: str = ""                           # 课程名称（冗余字段，便于显示）
    
    # 状态与优先级
    status: str = "todo"                            # 状态: todo, doing, done
    priority: str = "normal"                        # 优先级: normal, high, urgent
    is_exam: bool = False                           # 是否为考试/重要DDL
    
    # 时间信息
    deadline: str = ""                              # 截止日期 (YYYY-MM-DD 或 YYYY-MM-DD HH:mm格式)
    created_at: str = ""                            # 创建时间
    updated_at: str = ""                            # 更新时间
    completed_at: Optional[str] = None              # 完成时间
    
    # 详细信息
    description: str = ""                           # 详细描述
    tags: list[str] = None                          # 标签列表
    
    # 元数据
    order: int = 0                                  # 排序序号
    
    def __post_init__(self):
        """初始化后处理"""
        # 生成ID
        if not self.id:
            self.id = str(uuid.uuid4())
        
        # 设置创建时间
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        
        # 设置更新时间
        if not self.updated_at:
            self.updated_at = datetime.now().isoformat()
        
        # 初始化标签列表
        if self.tags is None:
            self.tags = []
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Task':
        """从字典创建实例"""
        # 过滤掉不存在的字段
        valid_fields = {field.name for field in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered_data)
    
    def validate(self) -> tuple[bool, str]:
        """
        验证任务数据的有效性
        
        Returns:
            (是否有效, 错误消息)
        """
        # 验证标题
        if not self.title or not self.title.strip():
            return False, "任务标题不能为空"
        
        if len(self.title) > 200:
            return False, "任务标题不能超过200个字符"
        
        # 验证状态
        valid_statuses = ['todo', 'doing', 'done']
        if self.status not in valid_statuses:
            return False, f"任务状态必须是 {', '.join(valid_statuses)} 之一"
        
        # 验证优先级
        valid_priorities = ['normal', 'high', 'urgent']
        if self.priority not in valid_priorities:
            return False, f"优先级必须是 {', '.join(valid_priorities)} 之一"
        
        # 验证截止日期格式 (支持日期或日期时间)
        if self.deadline:
            success = False
            for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
                try:
                    datetime.strptime(self.deadline, fmt)
                    success = True
                    break
                except ValueError:
                    continue
            
            if not success:
                return False, "截止日期格式必须为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm"
        
        return True, ""
    
    def update_timestamp(self):
        """更新时间戳"""
        self.updated_at = datetime.now().isoformat()
    
    def mark_completed(self):
        """标记为已完成"""
        self.status = "done"
        self.completed_at = datetime.now().isoformat()
        self.update_timestamp()
    
    def is_overdue(self) -> bool:
        """
        检查是否已过期
        
        Returns:
            是否过期
        """
        if not self.deadline or self.status == "done":
            return False
        
        try:
            # 统一解析为 datetime 对象进行比较
            if len(self.deadline) <= 10:
                # 只有日期，默认为该日期的 23:59:59
                deadline_dt = datetime.strptime(self.deadline, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            else:
                # 包含时间
                deadline_dt = datetime.strptime(self.deadline, "%Y-%m-%d %H:%M")
            
            return deadline_dt < datetime.now()
        except ValueError:
            return False
    
    def days_until_deadline(self) -> Optional[int]:
        """
        计算距离截止日期的天数
        
        Returns:
            天数（负数表示已过期），如果没有截止日期则返回None
        """
        if not self.deadline:
            return None
        
        try:
            if len(self.deadline) <= 10:
                deadline_date = datetime.strptime(self.deadline, "%Y-%m-%d").date()
            else:
                deadline_date = datetime.strptime(self.deadline, "%Y-%m-%d %H:%M").date()
            
            today = datetime.now().date()
            return (deadline_date - today).days
        except ValueError:
            return None
    
    def get_display_name(self) -> str:
        """
        获取任务的显示名称
        
        Returns:
            任务描述字符串
        """
        prefix = "🔴 " if self.is_exam else ""
        course_info = f"[{self.course_name}] " if self.course_name else ""
        return f"{prefix}{course_info}{self.title}"
