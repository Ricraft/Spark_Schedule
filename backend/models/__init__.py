# Backend models package

from .course_base import CourseBase
from .course_detail import CourseDetail
from .course_group import CourseGroup
from .week_type import WeekType
from .schedule_settings import ScheduleSettings

__all__ = ['CourseBase', 'CourseDetail', 'CourseGroup', 'WeekType', 'ScheduleSettings']