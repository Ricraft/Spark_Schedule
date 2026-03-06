"""
文本导入器

从文本格式导入课程数据
"""

import re
import uuid
from typing import List, Tuple, Optional

try:
    from .base_importer import BaseImporter
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..models.week_type import WeekType
    from ..utils.color_manager import ColorManager
except ImportError:
    from importers.base_importer import BaseImporter
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail
    from models.week_type import WeekType
    from utils.color_manager import ColorManager


class TextImporter(BaseImporter):
    """
    文本导入器
    
    解析文本格式的课表
    支持格式：周一 1-2节 高等数学 张三 A101 1-16周
    """
    
    # 文本解析模式
    # 格式：周一 1-2节 高等数学 张三 A101 1-16周
    # 或：周一 1-2节 高等数学 张三 A101 1-16周(单)
    PATTERN = re.compile(
        r'周([一二三四五六日])\s+'  # 星期
        r'(\d+)-(\d+)节\s+'  # 节次范围
        r'(.+?)\s+'  # 课程名称
        r'(.+?)\s+'  # 教师
        r'(.+?)\s+'  # 地点
        r'(\d+)-(\d+)周'  # 周次范围
        r'(?:\((单|双)\))?'  # 可选的单双周
    )
    
    # 中文星期映射
    WEEK_MAP = {
        '一': 1, '二': 2, '三': 3, '四': 4,
        '五': 5, '六': 6, '日': 7
    }
    
    def __init__(self):
        """初始化文本导入器"""
        self.color_manager = ColorManager()
    
    def get_supported_formats(self) -> List[str]:
        """获取支持的文件格式"""
        return ['.txt']
    
    def validate(self, content: str) -> Tuple[bool, str]:
        """
        验证文本内容是否有效
        
        Args:
            content: 文本内容
            
        Returns:
            (是否有效, 错误消息)
        """
        if not content or not content.strip():
            return False, "内容为空"
        
        # 检查是否至少有一行匹配格式
        lines = content.strip().split('\n')
        valid_lines = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if self.PATTERN.match(line):
                valid_lines += 1
        
        if valid_lines == 0:
            return False, "未找到有效的课程信息（格式：周一 1-2节 高等数学 张三 A101 1-16周）"
        
        return True, ""
    
    def parse(self, content: str) -> Tuple[List[CourseBase], List[CourseDetail]]:
        """
        解析文本内容
        
        Args:
            content: 文本内容
            
        Returns:
            (CourseBase列表, CourseDetail列表)
            
        Raises:
            ValueError: 解析失败时抛出
        """
        # 验证内容
        valid, msg = self.validate(content)
        if not valid:
            raise ValueError(msg)
        
        # 解析每一行
        import_beans = []
        lines = content.strip().split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                bean = self._parse_line(line)
                if bean:
                    import_beans.append(bean)
            except Exception as e:
                # 记录错误但继续解析其他行
                print(f"警告: 第 {line_num} 行解析失败: {line} ({str(e)})")
        
        if not import_beans:
            raise ValueError("没有成功解析任何课程")
        
        # 转换为 CourseBase 和 CourseDetail
        course_bases, course_details = self._convert_to_courses(import_beans)
        
        return course_bases, course_details
    
    def _parse_line(self, line: str) -> Optional[dict]:
        """
        解析单行课程信息
        
        Args:
            line: 单行文本
            
        Returns:
            课程信息字典，如果解析失败则返回 None
        """
        match = self.PATTERN.match(line)
        if not match:
            return None
        
        # 提取各个字段
        day_str = match.group(1)  # 一、二、三...
        start_section = int(match.group(2))
        end_section = int(match.group(3))
        name = match.group(4).strip()
        teacher = match.group(5).strip()
        location = match.group(6).strip()
        start_week = int(match.group(7))
        end_week = int(match.group(8))
        week_type_str = match.group(9)  # 单、双 或 None
        
        # 转换星期
        day_of_week = self.WEEK_MAP.get(day_str, 0)
        
        # 转换周类型
        if week_type_str == '单':
            week_type = WeekType.ODD_WEEK
        elif week_type_str == '双':
            week_type = WeekType.EVEN_WEEK
        else:
            week_type = WeekType.EVERY_WEEK
        
        # 计算持续节数
        step = end_section - start_section + 1
        
        return {
            'name': name,
            'teacher': teacher,
            'location': location,
            'day_of_week': day_of_week,
            'start_section': start_section,
            'step': step,
            'start_week': start_week,
            'end_week': end_week,
            'week_type': week_type
        }
    
    def _convert_to_courses(self, import_beans: List[dict]) -> Tuple[List[CourseBase], List[CourseDetail]]:
        """
        将导入的数据转换为 CourseBase 和 CourseDetail
        
        Args:
            import_beans: 导入的课程信息列表
            
        Returns:
            (CourseBase列表, CourseDetail列表)
        """
        course_bases = []
        course_details = []
        course_id_map = {}  # 课程名称 -> 课程ID 的映射
        
        for bean in import_beans:
            name = bean['name']
            
            # 检查课程是否已存在
            if name not in course_id_map:
                # 创建新的 CourseBase
                course_id = str(uuid.uuid4())
                color = self.color_manager.get_color_for_course(name)
                course_base = CourseBase(
                    name=name,
                    color=color,
                    course_id=course_id
                )
                course_bases.append(course_base)
                course_id_map[name] = course_id
            else:
                course_id = course_id_map[name]
            
            # 创建 CourseDetail
            course_detail = CourseDetail(
                course_id=course_id,
                teacher=bean['teacher'],
                location=bean['location'],
                day_of_week=bean['day_of_week'],
                start_section=bean['start_section'],
                step=bean['step'],
                start_week=bean['start_week'],
                end_week=bean['end_week'],
                week_type=bean['week_type']
            )
            course_details.append(course_detail)
        
        return course_bases, course_details
