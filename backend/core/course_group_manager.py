"""
课程分组管理器

负责课程的自动分组功能，基于名称、教师、地点进行匹配
实现分组创建、更新、删除的完整CRUD操作
实现分组内属性同步机制
"""

import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Set, Optional, Any, Tuple

try:
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..models.course_group import CourseGroup
    from ..utils.color_manager import ColorManager
except ImportError:
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail
    from models.course_group import CourseGroup
    from utils.color_manager import ColorManager


class CourseGroupManager:
    """
    课程分组管理器
    
    管理课程的自动分组功能，提供完整的CRUD操作
    """
    
    def __init__(self):
        """
        初始化课程分组管理器
        """
        self.groups: Dict[str, CourseGroup] = {}
        self.color_manager = ColorManager()
    
    def _generate_group_key(self, name: str, teacher: str, location: str) -> str:
        """
        生成分组的唯一标识符
        
        Args:
            name: 课程名称
            teacher: 教师姓名
            location: 上课地点
            
        Returns:
            分组的唯一标识符
        """
        # 标准化输入，去除多余空格并转为小写进行比较
        normalized_name = (name or "").strip().lower()
        normalized_teacher = (teacher or "").strip().lower()
        normalized_location = (location or "").strip().lower()
        
        return f"{normalized_name}|{normalized_teacher}|{normalized_location}"
    
    def _generate_group_id(self, group_key: str) -> str:
        """
        基于分组键生成唯一的分组ID
        
        Args:
            group_key: 分组键
            
        Returns:
            分组ID
        """
        # 使用MD5哈希生成稳定的ID
        hash_obj = hashlib.md5(group_key.encode('utf-8'))
        return f"group_{hash_obj.hexdigest()[:8]}"
    
    def find_matching_group(self, course_base: CourseBase, course_detail: CourseDetail) -> Optional[CourseGroup]:
        """
        根据课程名称、教师、地点查找匹配的分组
        
        Args:
            course_base: 课程基础信息
            course_detail: 课程详细信息
            
        Returns:
            匹配的分组，如果没有找到则返回None
        """
        if not course_base or not course_detail:
            return None
            
        group_key = self._generate_group_key(
            course_base.name,
            course_detail.teacher,
            course_detail.location
        )
        
        # 查找现有分组
        for group in self.groups.values():
            existing_key = self._generate_group_key(
                group.name,
                group.teacher,
                group.location
            )
            if existing_key == group_key:
                return group
        
        return None
    
    def create_or_update_group(self, course_base: CourseBase, course_detail: CourseDetail) -> Tuple[CourseGroup, bool]:
        """
        创建新分组或更新现有分组
        
        Args:
            course_base: 课程基础信息
            course_detail: 课程详细信息
            
        Returns:
            (分组对象, 是否为新创建的分组)
        """
        if not course_base or not course_detail:
            raise ValueError("课程基础信息和详细信息不能为空")
        
        # 查找现有分组
        existing_group = self.find_matching_group(course_base, course_detail)
        
        if existing_group:
            # 更新现有分组
            existing_group.add_course(course_base.course_id)
            return existing_group, False
        else:
            # 创建新分组
            group_key = self._generate_group_key(
                course_base.name,
                course_detail.teacher,
                course_detail.location
            )
            group_id = self._generate_group_id(group_key)
            
            # 为分组分配颜色
            group_color = self.color_manager.get_group_color(group_key)
            
            new_group = CourseGroup(
                id=group_id,
                name=course_base.name,
                teacher=course_detail.teacher,
                location=course_detail.location,
                color=group_color,
                course_ids={course_base.course_id}
            )
            
            self.groups[group_id] = new_group
            return new_group, True
    
    def sync_group_properties(self, group_id: str, updates: Dict[str, Any]) -> Tuple[bool, str]:
        """
        同步分组内所有课程的属性
        
        Args:
            group_id: 分组ID
            updates: 要更新的属性字典
            
        Returns:
            (是否成功, 错误消息)
        """
        if group_id not in self.groups:
            return False, f"分组 {group_id} 不存在"
        
        group = self.groups[group_id]
        
        # 验证更新字段
        allowed_fields = {'name', 'teacher', 'location', 'color', 'note'}
        invalid_fields = set(updates.keys()) - allowed_fields
        if invalid_fields:
            return False, f"不允许更新的字段: {', '.join(invalid_fields)}"
        
        try:
            # 更新分组属性
            if 'name' in updates:
                group.name = updates['name']
            if 'teacher' in updates:
                group.teacher = updates['teacher']
            if 'location' in updates:
                group.location = updates['location']
            if 'color' in updates:
                group.color = updates['color']
            
            group.updated_at = datetime.now()
            
            # 注意：实际的课程数据同步需要在调用方处理
            # 因为这里只管理分组信息，不直接操作课程数据
            
            return True, ""
            
        except Exception as e:
            return False, f"同步属性失败: {str(e)}"
    
    def delete_group(self, group_id: str) -> Tuple[bool, str]:
        """
        删除分组
        
        Args:
            group_id: 分组ID
            
        Returns:
            (是否成功, 错误消息)
        """
        if group_id not in self.groups:
            return False, f"分组 {group_id} 不存在"
        
        try:
            del self.groups[group_id]
            return True, ""
        except Exception as e:
            return False, f"删除分组失败: {str(e)}"
    
    def get_group(self, group_id: str) -> Optional[CourseGroup]:
        """
        获取指定分组
        
        Args:
            group_id: 分组ID
            
        Returns:
            分组对象，如果不存在则返回None
        """
        return self.groups.get(group_id)
    
    def get_all_groups(self) -> List[CourseGroup]:
        """
        获取所有分组
        
        Returns:
            分组列表
        """
        return list(self.groups.values())
    
    def get_grouped_courses(self, course_bases: List[CourseBase], course_details: List[CourseDetail]) -> Dict[str, List[Dict[str, Any]]]:
        """
        获取按分组组织的课程列表
        
        Args:
            course_bases: 课程基础信息列表
            course_details: 课程详细信息列表
            
        Returns:
            按分组组织的课程字典，键为分组ID，值为课程列表
        """
        # 建立课程ID到基础信息的映射
        base_map = {base.course_id: base for base in course_bases}
        
        # 建立课程ID到详细信息的映射
        detail_map = {}
        for detail in course_details:
            if detail.course_id not in detail_map:
                detail_map[detail.course_id] = []
            detail_map[detail.course_id].append(detail)
        
        grouped_courses = {}
        
        for group in self.groups.values():
            group_courses = []
            
            for course_id in group.course_ids:
                base = base_map.get(course_id)
                details = detail_map.get(course_id, [])
                
                if base:
                    # 为每个详细信息创建一个课程条目
                    for detail in details:
                        course_dict = {
                            'id': f"{course_id}_{detail.day_of_week}_{detail.start_section}",
                            'course_id': course_id,
                            'group_id': group.id,
                            'name': base.name,
                            'teacher': detail.teacher,
                            'location': detail.location,
                            'day': detail.day_of_week,
                            'start': detail.start_section,
                            'duration': detail.step,
                            'start_week': detail.start_week,
                            'end_week': detail.end_week,
                            'week_type': detail.week_type.value,
                            'color': group.color,
                            'note': base.note
                        }
                        group_courses.append(course_dict)
            
            if group_courses:
                grouped_courses[group.id] = group_courses
        
        return grouped_courses
    
    def remove_course_from_groups(self, course_id: str) -> List[str]:
        """
        从所有分组中移除指定课程
        
        Args:
            course_id: 课程ID
            
        Returns:
            被影响的分组ID列表
        """
        affected_groups = []
        
        for group_id, group in list(self.groups.items()):
            if course_id in group.course_ids:
                group.remove_course(course_id)
                affected_groups.append(group_id)
                
                # 如果分组变为空，删除分组
                if group.is_empty():
                    del self.groups[group_id]
        
        return affected_groups
    
    def get_course_group_id(self, course_id: str) -> Optional[str]:
        """
        获取课程所属的分组ID
        
        Args:
            course_id: 课程ID
            
        Returns:
            分组ID，如果课程不属于任何分组则返回None
        """
        for group in self.groups.values():
            if course_id in group.course_ids:
                return group.id
        return None
    
    def validate_group_data(self, name: str, teacher: str, location: str) -> Tuple[bool, str]:
        """
        验证分组数据的有效性
        
        Args:
            name: 课程名称
            teacher: 教师姓名
            location: 上课地点
            
        Returns:
            (是否有效, 错误消息)
        """
        if not name or not name.strip():
            return False, "课程名称不能为空"
        
        if not teacher or not teacher.strip():
            return False, "教师姓名不能为空"
        
        if not location or not location.strip():
            return False, "上课地点不能为空"
        
        # 检查长度限制
        if len(name.strip()) > 100:
            return False, "课程名称长度不能超过100个字符"
        
        if len(teacher.strip()) > 50:
            return False, "教师姓名长度不能超过50个字符"
        
        if len(location.strip()) > 100:
            return False, "上课地点长度不能超过100个字符"
        
        return True, ""
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取分组统计信息
        
        Returns:
            包含统计信息的字典
        """
        total_groups = len(self.groups)
        total_courses = sum(len(group.course_ids) for group in self.groups.values())
        
        # 按课程数量排序的分组
        groups_by_size = sorted(
            self.groups.values(),
            key=lambda g: len(g.course_ids),
            reverse=True
        )
        
        return {
            'total_groups': total_groups,
            'total_courses': total_courses,
            'average_courses_per_group': total_courses / total_groups if total_groups > 0 else 0,
            'largest_group': {
                'id': groups_by_size[0].id,
                'name': groups_by_size[0].name,
                'course_count': len(groups_by_size[0].course_ids)
            } if groups_by_size else None,
            'groups_by_size': [
                {
                    'id': group.id,
                    'name': group.name,
                    'teacher': group.teacher,
                    'location': group.location,
                    'course_count': len(group.course_ids)
                }
                for group in groups_by_size
            ]
        }
    
    def clear_all_groups(self):
        """
        清空所有分组
        """
        self.groups.clear()