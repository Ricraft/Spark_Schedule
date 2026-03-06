"""
?????

???????????????
"""

from typing import List, Tuple
from datetime import date

try:
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..models.schedule import Schedule
    from .week_calculator import WeekCalculator
except ImportError:
    try:
        from backend.models.course_base import CourseBase
        from backend.models.course_detail import CourseDetail
        from backend.models.schedule import Schedule
        from backend.core.week_calculator import WeekCalculator
    except ImportError:
        from src.models.course_base import CourseBase
        from src.models.course_detail import CourseDetail
        from src.models.schedule import Schedule
        from backend.core.week_calculator import WeekCalculator


class ScheduleManager:
    """
    课表管理器
    
    提供课表的高级查询和过滤功能
    """
    
    def __init__(self, schedule: Schedule):
        """
        初始化课表管理器
        
        Args:
            schedule: 课表对象
        """
        self.schedule = schedule
        self.week_calculator = WeekCalculator(schedule.semester_start_date)
    
    def get_courses_for_week(self, week: int) -> List[Tuple[CourseBase, CourseDetail]]:
        """
        获取指定周次的所有课程
        
        根据周次范围和单双周类型过滤课程
        
        Args:
            week: 周次（从1开始）
            
        Returns:
            (CourseBase, CourseDetail) 元组列表
        """
        result = []
        
        for detail in self.schedule.course_details:
            # 检查该课程是否在指定周次上课
            if detail.is_in_week(week):
                # 查找对应的课程基础信息
                course_base = self._get_course_base_by_id(detail.course_id)
                if course_base:
                    result.append((course_base, detail))
        
        return result
    
    def get_courses_for_day(self, week: int, day: int) -> List[Tuple[CourseBase, CourseDetail]]:
        """
        获取指定周次和星期的课程
        
        Args:
            week: 周次（从1开始）
            day: 星期几（1-7，1=周一）
            
        Returns:
            (CourseBase, CourseDetail) 元组列表，按节次排序
        """
        # 先获取该周的所有课程
        week_courses = self.get_courses_for_week(week)
        
        # 过滤出指定星期的课程
        day_courses = [
            (base, detail) for base, detail in week_courses
            if detail.day_of_week == day
        ]
        
        # 按开始节次排序
        day_courses.sort(key=lambda x: x[1].start_section)
        
        return day_courses
    
    def get_current_week_courses(self) -> List[Tuple[CourseBase, CourseDetail]]:
        """
        获取当前周次的所有课程
        
        Returns:
            (CourseBase, CourseDetail) 元组列表
        """
        current_week = self.week_calculator.get_current_week()
        return self.get_courses_for_week(current_week)
    
    def get_today_courses(self) -> List[Tuple[CourseBase, CourseDetail]]:
        """
        获取今天的所有课程
        
        Returns:
            (CourseBase, CourseDetail) 元组列表，按节次排序
        """
        current_week = self.week_calculator.get_current_week()
        today = date.today()
        # weekday() 返回 0-6（0=周一），我们需要 1-7
        day_of_week = today.weekday() + 1
        
        return self.get_courses_for_day(current_week, day_of_week)
    
    def set_semester_start_date(self, semester_start_date: date) -> None:
        """
        设置学期开始日期
        
        Args:
            semester_start_date: 新的学期开始日期
        """
        self.schedule.semester_start_date = semester_start_date
        self.week_calculator.set_semester_start_date(semester_start_date)
    
    def get_all_courses_sorted(self) -> List[Tuple[CourseBase, CourseDetail]]:
        """
        获取所有课程，按星期和节次排序
        
        Returns:
            (CourseBase, CourseDetail) 元组列表
        """
        result = []
        
        for detail in self.schedule.course_details:
            course_base = self._get_course_base_by_id(detail.course_id)
            if course_base:
                result.append((course_base, detail))
        
        # 按星期和节次排序
        result.sort(key=lambda x: (x[1].day_of_week, x[1].start_section))
        
        return result
    
    def _get_course_base_by_id(self, course_id: str) -> CourseBase:
        """
        根据ID获取课程基础信息（内部方法）
        
        Args:
            course_id: 课程ID
            
        Returns:
            课程基础信息，如果不存在则返回 None
        """
        for base in self.schedule.course_bases:
            if base.id == course_id:
                return base
        return None
