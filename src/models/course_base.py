"""
课程基础信息模型
src/models/course_base.py
"""

from dataclasses import dataclass

@dataclass
class CourseBase:
    """
    课程基础信息
    包含：课程ID、名称、颜色、备注
    """
    course_id: str
    name: str
    color: str
    note: str = ""

    @property
    def id(self):
        """兼容性属性：id 等同于 course_id"""
        return self.course_id