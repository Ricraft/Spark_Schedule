"""
Models 包初始化
src/models/__init__.py
"""

from .week_type import WeekType
from .time_slot import TimeSlot
from .course_base import CourseBase
from .course_detail import CourseDetail
from .config import Config

__all__ = [
    'WeekType',
    'TimeSlot',
    'CourseBase',
    'CourseDetail',
    'Config',
]