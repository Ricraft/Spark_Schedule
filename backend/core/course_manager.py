"""
课程管理器

负责课程的增删改查操作，以及数据验证
"""

import random
from typing import List, Optional, Tuple

try:
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..models.schedule import Schedule
    from ..utils.validators import (
        validate_course_name,
        validate_teacher_name,
        validate_location,
        validate_day_of_week,
        validate_section_range,
        validate_week_range,
        validate_color,
        validate_note
    )
    from ..utils.color_manager import ColorManager
except ImportError:
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail
    from models.schedule import Schedule
    from utils.validators import (
        validate_course_name,
        validate_teacher_name,
        validate_location,
        validate_day_of_week,
        validate_section_range,
        validate_week_range,
        validate_color,
        validate_note
    )
    from utils.color_manager import ColorManager


class CourseManager:
    """
    课程管理器
    
    管理课程的增删改查操作，维护 CourseBase 和 CourseDetail 的关系
    """
    
    def __init__(self, schedule: Schedule, settings_manager=None):
        """
        初始化课程管理器
        
        Args:
            schedule: 课表对象
            settings_manager: 设置管理器，用于获取学期周数限制
        """
        self.schedule = schedule
        self.settings_manager = settings_manager
    
    def add_course_base(self, course_base: CourseBase) -> Tuple[bool, str]:
        """
        添加课程基础信息
        
        Args:
            course_base: 课程基础信息
            
        Returns:
            (是否成功, 错误消息)
        """
        # 验证课程名称
        valid, msg = validate_course_name(course_base.name)
        if not valid:
            return False, msg
        
        # 验证颜色
        valid, msg = validate_color(course_base.color)
        if not valid:
            return False, msg
        
        # 验证备注
        valid, msg = validate_note(course_base.note)
        if not valid:
            return False, msg
        
        # 检查是否已存在相同ID的课程
        if self.get_course_base(course_base.id) is not None:
            return False, f"课程ID {course_base.id} 已存在"
        
        # 添加到课表
        self.schedule.course_bases.append(course_base)
        return True, ""
    
    def add_course_detail(self, course_detail: CourseDetail) -> Tuple[bool, str]:
        """
        添加课程详细信息
        
        Args:
            course_detail: 课程详细信息
            
        Returns:
            (是否成功, 错误消息)
        """
        # 验证关联的课程基础信息是否存在
        course_base = self.get_course_base(course_detail.course_id)
        if course_base is None:
            return False, f"课程ID {course_detail.course_id} 不存在"
        
        # 验证教师姓名
        valid, msg = validate_teacher_name(course_detail.teacher)
        if not valid:
            return False, msg
        
        # 验证上课地点
        valid, msg = validate_location(course_detail.location)
        if not valid:
            return False, msg
        
        # 验证星期
        valid, msg = validate_day_of_week(course_detail.day_of_week)
        if not valid:
            return False, msg
        
        # 验证节次范围
        valid, msg = validate_section_range(
            course_detail.start_section,
            course_detail.end_section
        )
        if not valid:
            return False, msg
        
        # 验证周次范围
        max_week = 30  # 默认值
        if self.settings_manager:
            max_week = self.settings_manager.settings.semester_weeks
        
        valid, msg = validate_week_range(
            course_detail.start_week,
            course_detail.end_week,
            max_week
        )
        if not valid:
            return False, msg
        
        # 添加到课表
        self.schedule.course_details.append(course_detail)
        return True, ""
    
    def update_course_base(self, course_id: str, course_base: CourseBase) -> Tuple[bool, str]:
        """
        更新课程基础信息
        
        Args:
            course_id: 要更新的课程ID
            course_base: 新的课程基础信息
            
        Returns:
            (是否成功, 错误消息)
        """
        # 查找课程
        for i, cb in enumerate(self.schedule.course_bases):
            if cb.id == course_id:
                # 验证新数据
                valid, msg = validate_course_name(course_base.name)
                if not valid:
                    return False, msg
                
                valid, msg = validate_color(course_base.color)
                if not valid:
                    return False, msg
                
                valid, msg = validate_note(course_base.note)
                if not valid:
                    return False, msg
                
                # 保持ID不变
                course_base.id = course_id
                
                # 更新
                self.schedule.course_bases[i] = course_base
                return True, ""
        
        return False, f"课程ID {course_id} 不存在"
    
    def delete_course_base(self, course_id: str) -> Tuple[bool, str]:
        """
        删除课程基础信息（同时删除所有关联的详细信息）
        
        Args:
            course_id: 课程ID
            
        Returns:
            (是否成功, 错误消息)
        """
        # 查找并删除课程基础信息
        found = False
        for i, cb in enumerate(self.schedule.course_bases):
            if cb.id == course_id:
                self.schedule.course_bases.pop(i)
                found = True
                break
        
        if not found:
            return False, f"课程ID {course_id} 不存在"
        
        # 删除所有关联的详细信息
        self.schedule.course_details = [
            cd for cd in self.schedule.course_details
            if cd.course_id != course_id
        ]
        
        return True, ""
    
    def delete_course_detail(self, course_detail: CourseDetail) -> Tuple[bool, str]:
        """
        删除指定的课程详细信息
        
        Args:
            course_detail: 要删除的课程详细信息
            
        Returns:
            (是否成功, 错误消息)
        """
        try:
            self.schedule.course_details.remove(course_detail)
            return True, ""
        except ValueError:
            return False, "课程详细信息不存在"
    
    def get_course_base(self, course_id: str) -> Optional[CourseBase]:
        """
        获取课程基础信息
        
        Args:
            course_id: 课程ID
            
        Returns:
            课程基础信息，如果不存在则返回 None
        """
        for cb in self.schedule.course_bases:
            if cb.id == course_id:
                return cb
        return None
    
    def get_all_course_bases(self) -> List[CourseBase]:
        """
        获取所有课程基础信息
        
        Returns:
            课程基础信息列表
        """
        return self.schedule.course_bases.copy()
    
    def get_course_details_by_course_id(self, course_id: str) -> List[CourseDetail]:
        """
        获取指定课程的所有详细信息
        
        Args:
            course_id: 课程ID
            
        Returns:
            课程详细信息列表
        """
        return [
            cd for cd in self.schedule.course_details
            if cd.course_id == course_id
        ]
    
    def get_all_course_details(self) -> List[CourseDetail]:
        """
        获取所有课程详细信息
        
        Returns:
            课程详细信息列表
        """
        return self.schedule.course_details.copy()
    
    def validate_course_base(self, course_base: CourseBase) -> Tuple[bool, str]:
        """
        验证课程基础信息
        
        Args:
            course_base: 课程基础信息
            
        Returns:
            (是否有效, 错误消息)
        """
        # 验证课程名称
        valid, msg = validate_course_name(course_base.name)
        if not valid:
            return False, msg
        
        # 验证颜色
        valid, msg = validate_color(course_base.color)
        if not valid:
            return False, msg
        
        # 验证备注
        valid, msg = validate_note(course_base.note)
        if not valid:
            return False, msg
        
        return True, ""
    
    def validate_course_detail(self, course_detail: CourseDetail) -> Tuple[bool, str]:
        """
        验证课程详细信息
        
        Args:
            course_detail: 课程详细信息
            
        Returns:
            (是否有效, 错误消息)
        """
        # 验证教师姓名
        valid, msg = validate_teacher_name(course_detail.teacher)
        if not valid:
            return False, msg
        
        # 验证上课地点
        valid, msg = validate_location(course_detail.location)
        if not valid:
            return False, msg
        
        # 验证星期
        valid, msg = validate_day_of_week(course_detail.day_of_week)
        if not valid:
            return False, msg
        
        # 验证节次范围
        valid, msg = validate_section_range(
            course_detail.start_section,
            course_detail.end_section
        )
        if not valid:
            return False, msg
        
        # 验证周次范围
        max_week = 30  # 默认值
        if self.settings_manager:
            max_week = self.settings_manager.settings.semester_weeks
        
        valid, msg = validate_week_range(
            course_detail.start_week,
            course_detail.end_week,
            max_week
        )
        if not valid:
            return False, msg
        
        return True, ""

    def reassign_colors(self) -> Tuple[bool, str]:
        """
        为所有课程重新分配随机颜色
        
        从 ColorManager.COLOR_POOL 中随机选择颜色分配给每个课程
        
        Returns:
            (是否成功, 消息)
        """
        if not self.schedule.course_bases:
            return False, "没有课程需要重新分配颜色"
        
        # 获取颜色池
        color_pool = ColorManager.COLOR_POOL.copy()
        
        # 为每个课程随机分配颜色
        for course_base in self.schedule.course_bases:
            # 随机选择一个颜色
            course_base.color = random.choice(color_pool)
        
        return True, f"已为 {len(self.schedule.course_bases)} 个课程重新分配颜色"

    def check_week_conflicts_with_settings(self) -> list:
        """
        检查所有课程是否与当前学期周数设置冲突
        
        Returns:
            冲突的课程详细信息列表
        """
        conflicts = []
        
        if not self.settings_manager:
            return conflicts
        
        max_week = self.settings_manager.settings.semester_weeks
        
        for course_detail in self.schedule.course_details:
            # 检查开始周次
            if course_detail.start_week > max_week:
                conflicts.append({
                    'course_id': course_detail.course_id,
                    'conflict_type': 'start_week_exceeds',
                    'start_week': course_detail.start_week,
                    'end_week': course_detail.end_week,
                    'max_week': max_week
                })
            # 检查结束周次
            elif course_detail.end_week > max_week:
                conflicts.append({
                    'course_id': course_detail.course_id,
                    'conflict_type': 'end_week_exceeds',
                    'start_week': course_detail.start_week,
                    'end_week': course_detail.end_week,
                    'max_week': max_week
                })
        
        return conflicts
    
    def fix_week_conflicts(self, fix_strategy: str = 'truncate') -> tuple[bool, str]:
        """
        修复周数冲突
        
        Args:
            fix_strategy: 修复策略 ('truncate' - 截断到最大周数, 'remove' - 删除冲突课程)
            
        Returns:
            (是否成功, 消息)
        """
        if not self.settings_manager:
            return False, "设置管理器未初始化"
        
        max_week = self.settings_manager.settings.semester_weeks
        conflicts = self.check_week_conflicts_with_settings()
        
        if not conflicts:
            return True, "没有发现周数冲突"
        
        fixed_count = 0
        removed_count = 0
        
        if fix_strategy == 'truncate':
            # 截断策略：将超出的周数调整到最大周数
            for conflict in conflicts:
                course_id = conflict['course_id']
                for course_detail in self.schedule.course_details:
                    if course_detail.course_id == course_id:
                        if course_detail.start_week > max_week:
                            course_detail.start_week = max_week
                        if course_detail.end_week > max_week:
                            course_detail.end_week = max_week
                        fixed_count += 1
                        break
        
        elif fix_strategy == 'remove':
            # 删除策略：删除有冲突的课程
            course_ids_to_remove = {conflict['course_id'] for conflict in conflicts}
            
            # 删除课程详细信息
            self.schedule.course_details = [
                cd for cd in self.schedule.course_details 
                if cd.course_id not in course_ids_to_remove
            ]
            
            # 删除对应的课程基础信息
            self.schedule.course_bases = [
                cb for cb in self.schedule.course_bases 
                if cb.id not in course_ids_to_remove
            ]
            
            removed_count = len(course_ids_to_remove)
        
        if fix_strategy == 'truncate':
            return True, f"已修复 {fixed_count} 个课程的周数冲突"
        else:
            return True, f"已删除 {removed_count} 个有冲突的课程"
