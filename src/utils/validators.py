"""
数据验证工具
src/utils/validators.py
"""

from typing import Tuple

def validate_course_name(name: str) -> Tuple[bool, str]:
    if not name or not name.strip():
        return False, "课程名称不能为空"
    if len(name) > 50:
        return False, "课程名称过长"
    return True, ""

def validate_teacher_name(name: str) -> Tuple[bool, str]:
    if name and len(name) > 20:
        return False, "教师姓名过长"
    return True, ""

def validate_location(location: str) -> Tuple[bool, str]:
    if location and len(location) > 30:
        return False, "地点名称过长"
    return True, ""

def validate_section_range(start: int, end: int) -> Tuple[bool, str]:
    if start < 1 or end > 12:
        return False, "节次必须在 1-12 之间"
    if start > end:
        return False, "开始节次不能大于结束节次"
    return True, ""

def validate_week_range(start: int, end: int, max_week: int = 30) -> Tuple[bool, str]:
    """
    验证周次范围
    
    Args:
        start: 开始周次
        end: 结束周次
        max_week: 学期最大周数，默认30
    """
    if start < 1 or end > max_week:
        return False, f"周次必须在 1-{max_week} 之间"
    if start > end:
        return False, "开始周次不能大于结束周次"
    return True, ""

def validate_week_list(week_list: list, max_week: int = 30) -> Tuple[bool, str]:
    """
    验证周次列表
    
    Args:
        week_list: 周次列表
        max_week: 学期最大周数，默认30
    """
    if not week_list:
        return False, "周次列表不能为空"
    
    for week in week_list:
        if not isinstance(week, int):
            return False, "周次必须是整数"
        if week < 1 or week > max_week:
            return False, f"周次 {week} 超出范围 1-{max_week}"
    
    return True, ""

def validate_note(note: str) -> Tuple[bool, str]:
    if note and len(note) > 200:
        return False, "备注不能超过 200 字"
    return True, ""

def validate_day_of_week(day: int) -> Tuple[bool, str]:
    if day < 1 or day > 7:
        return False, "无效的星期"
    return True, ""

def validate_color(color: str) -> Tuple[bool, str]:
    """验证颜色值"""
    if not color:
        return False, "颜色不能为空"
    
    # 检查是否为有效的十六进制颜色
    if color.startswith('#'):
        if len(color) == 7:  # #RRGGBB
            try:
                int(color[1:], 16)
                return True, ""
            except ValueError:
                return False, "无效的颜色格式"
        else:
            return False, "颜色格式应为 #RRGGBB"
    else:
        return False, "颜色必须以 # 开头"