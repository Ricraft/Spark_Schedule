"""
课表模型
backend/models/schedule.py
"""

from dataclasses import dataclass
from typing import List
from datetime import date
from .course_base import CourseBase
from .course_detail import CourseDetail

@dataclass
class Schedule:
    """
    课表模型
    包含课程基础信息列表、课程详情列表和学期信息
    """
    course_bases: List[CourseBase]
    course_details: List[CourseDetail]
    semester_start_date: date
    current_week: int = 1
    
    def __post_init__(self):
        """初始化后处理"""
        if not isinstance(self.course_bases, list):
            self.course_bases = []
        if not isinstance(self.course_details, list):
            self.course_details = []