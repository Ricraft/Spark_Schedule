"""
课程分组模型
backend/models/course_group.py
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Set


@dataclass
class CourseGroup:
    """
    课程分组数据类
    
    表示具有相同名称、教师和地点的课程集合
    """
    id: str
    name: str
    teacher: str
    location: str
    color: str
    course_ids: Set[str] = field(default_factory=set)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def __post_init__(self):
        """初始化后处理"""
        if not isinstance(self.course_ids, set):
            self.course_ids = set(self.course_ids) if self.course_ids else set()
    
    def get_group_key(self) -> str:
        """
        获取分组的唯一标识符
        
        Returns:
            基于名称、教师、地点的唯一标识符
        """
        return f"{self.name}|{self.teacher}|{self.location}"
    
    def add_course(self, course_id: str):
        """
        添加课程到分组
        
        Args:
            course_id: 课程ID
        """
        self.course_ids.add(course_id)
        self.updated_at = datetime.now()
    
    def remove_course(self, course_id: str):
        """
        从分组中移除课程
        
        Args:
            course_id: 课程ID
        """
        self.course_ids.discard(course_id)
        self.updated_at = datetime.now()
    
    def is_empty(self) -> bool:
        """
        检查分组是否为空
        
        Returns:
            分组是否不包含任何课程
        """
        return len(self.course_ids) == 0