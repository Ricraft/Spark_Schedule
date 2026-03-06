"""
冲突检测器

负责检测课程时间冲突
"""

from typing import List, Tuple

try:
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
except ImportError:
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail


class ConflictDetector:
    """
    冲突检测器
    
    检测课程之间的时间冲突
    """
    
    def __init__(self, schedule=None):
        """
        初始化冲突检测器
        
        Args:
            schedule: Schedule 对象（可选）
        """
        self.schedule = schedule
    
    def detect_conflicts(self, course_detail: CourseDetail, exclude_course_id: str = None) -> List[CourseDetail]:
        """
        检测课程详细信息与现有课程是否有冲突
        
        Args:
            course_detail: 要检查的课程详细信息
            exclude_course_id: 要排除的课程ID（用于编辑时排除自己）
            
        Returns:
            冲突的课程详细信息列表
        """
        if not self.schedule:
            return []
        
        conflicts = []
        
        for existing in self.schedule.course_details:
            # 跳过要排除的课程
            if exclude_course_id and existing.course_id == exclude_course_id:
                continue
            
            # 跳过自己
            if existing == course_detail:
                continue
            
            # 检查是否有任何周次存在冲突
            if self._has_any_week_overlap(course_detail, existing):
                conflicts.append(existing)
        
        return conflicts
    
    def get_conflict_description(self, detail1: CourseDetail, detail2: CourseDetail) -> str:
        """
        获取冲突描述信息
        
        Args:
            detail1: 第一个课程详细信息
            detail2: 第二个课程详细信息
            
        Returns:
            冲突描述字符串
        """
        # 找出冲突的周次
        conflict_weeks = []
        overlap_start = max(detail1.start_week, detail2.start_week)
        overlap_end = min(detail1.end_week, detail2.end_week)
        
        for week in range(overlap_start, overlap_end + 1):
            if detail1.is_in_week(week) and detail2.is_in_week(week):
                conflict_weeks.append(week)
        
        # 构建描述
        day_names = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        day_name = day_names[detail1.day_of_week]
        
        weeks_str = f"第{conflict_weeks[0]}"
        if len(conflict_weeks) > 1:
            weeks_str += f"-{conflict_weeks[-1]}"
        weeks_str += "周"
        
        return f"{day_name} 第{detail1.start_section}-{detail1.end_section}节 ({weeks_str}) 时间冲突"
    
    @staticmethod
    def check_conflict(
        course_detail: CourseDetail,
        existing_details: List[CourseDetail]
    ) -> List[CourseDetail]:
        """
        检查课程详细信息与现有课程是否有冲突（静态方法）
        
        Args:
            course_detail: 要检查的课程详细信息
            existing_details: 现有的课程详细信息列表
            
        Returns:
            冲突的课程详细信息列表
        """
        conflicts = []
        
        for existing in existing_details:
            # 跳过自己
            if existing == course_detail:
                continue
            
            # 检查是否有任何周次存在冲突
            if ConflictDetector._has_any_week_overlap(course_detail, existing):
                conflicts.append(existing)
        
        return conflicts
    
    @staticmethod
    def has_time_overlap(
        detail1: CourseDetail,
        detail2: CourseDetail,
        week: int
    ) -> bool:
        """
        检查两个课程在指定周次是否有时间重叠
        
        Args:
            detail1: 第一个课程详细信息
            detail2: 第二个课程详细信息
            week: 周次
            
        Returns:
            是否有时间重叠
        """
        # 检查两个课程是否都在该周上课
        if not (detail1.is_in_week(week) and detail2.is_in_week(week)):
            return False
        
        # 检查是否在同一天
        if detail1.day_of_week != detail2.day_of_week:
            return False
        
        # 检查节次是否重叠
        return ConflictDetector._sections_overlap(
            detail1.start_section,
            detail1.end_section,
            detail2.start_section,
            detail2.end_section
        )
    
    @staticmethod
    def _has_any_week_overlap(
        detail1: CourseDetail,
        detail2: CourseDetail
    ) -> bool:
        """
        检查两个课程是否在任何周次有时间重叠（内部方法）
        
        Args:
            detail1: 第一个课程详细信息
            detail2: 第二个课程详细信息
            
        Returns:
            是否有任何周次存在时间重叠
        """
        # 检查是否在同一天
        if detail1.day_of_week != detail2.day_of_week:
            return False
        
        # 检查节次是否重叠
        if not ConflictDetector._sections_overlap(
            detail1.start_section,
            detail1.end_section,
            detail2.start_section,
            detail2.end_section
        ):
            return False
        
        # 检查周次范围是否有交集
        week_range_overlap = not (
            detail1.end_week < detail2.start_week or
            detail2.end_week < detail1.start_week
        )
        
        if not week_range_overlap:
            return False
        
        # 找出周次范围的交集
        overlap_start = max(detail1.start_week, detail2.start_week)
        overlap_end = min(detail1.end_week, detail2.end_week)
        
        # 检查交集范围内是否有任何周次两个课程都上课
        for week in range(overlap_start, overlap_end + 1):
            if detail1.is_in_week(week) and detail2.is_in_week(week):
                return True
        
        return False
    
    @staticmethod
    def _sections_overlap(
        start1: int,
        end1: int,
        start2: int,
        end2: int
    ) -> bool:
        """
        检查两个节次范围是否重叠（内部方法）
        
        Args:
            start1: 第一个范围的开始节次
            end1: 第一个范围的结束节次
            start2: 第二个范围的开始节次
            end2: 第二个范围的结束节次
            
        Returns:
            是否重叠
        """
        # 两个范围不重叠的条件：
        # 1. 第一个范围完全在第二个范围之前（end1 < start2）
        # 2. 第二个范围完全在第一个范围之前（end2 < start1）
        # 取反即为重叠的条件
        return not (end1 < start2 or end2 < start1)
