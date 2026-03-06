"""
课程详情模型
src/models/course_detail.py
"""

from dataclasses import dataclass
from src.models.week_type import WeekType

@dataclass
class CourseDetail:
    """
    课程详细时间地点信息
    """
    course_id: str
    teacher: str
    location: str
    day_of_week: int    # 1-7 (周一到周日)
    start_section: int  # 开始节次
    step: int           # 持续节数
    start_week: int     # 开始周次
    end_week: int       # 结束周次
    week_type: WeekType # 周次类型

    @property
    def end_section(self):
        return self.start_section + self.step - 1