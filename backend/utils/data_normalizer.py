"""
课程数据标准化器
backend/utils/data_normalizer.py

该模块负责将各种格式的课程数据标准化为统一的格式，确保类型安全和数据一致性。
"""

from typing import List, Dict, Any, Optional, TypedDict
import re


class StandardCourseData(TypedDict):
    """标准课程数据类型定义"""
    id: str
    name: str
    teacher: str
    location: str
    day: int  # 1-7
    start: int  # >= 1
    duration: int  # >= 1
    weeks: List[int]
    week_list: List[int]
    color: str
    groupId: Optional[str]
    note: Optional[str]


class DataNormalizationError(Exception):
    """数据标准化错误"""
    pass


class CourseDataNormalizer:
    """
    课程数据标准化器
    
    提供统一的数据格式转换和验证功能，确保从后端到前端的数据流完全类型安全。
    """
    
    @staticmethod
    def normalize_course_dict(raw_data: Dict[str, Any]) -> StandardCourseData:
        """
        标准化课程数据字典
        
        将原始课程数据转换为标准格式，确保所有字段类型正确且符合规范。
        
        Args:
            raw_data: 原始课程数据字典
            
        Returns:
            StandardCourseData: 标准化后的课程数据
            
        Raises:
            DataNormalizationError: 当必填字段缺失或数据严重损坏时
            
        Example:
            >>> raw = {
            ...     'name': '高等数学',
            ...     'day': '1',
            ...     'start': 1,
            ...     'duration': '2',
            ...     'weeks': '1-16'
            ... }
            >>> normalized = CourseDataNormalizer.normalize_course_dict(raw)
            >>> normalized['day']
            1
            >>> normalized['weeks']
            [1, 2, 3, ..., 16]
        """
        # 必填字段检查
        if not raw_data.get('name'):
            raise DataNormalizationError("课程名称不能为空")
        
        if not raw_data.get('id'):
            raise DataNormalizationError("课程ID不能为空")
        
        # 标准化各个字段（使用默认值处理可恢复错误）
        try:
            day = CourseDataNormalizer.normalize_day(raw_data.get('day', 1))
        except ValueError as e:
            print(f"⚠️ [Normalizer] 星期字段错误，使用默认值1: {e}")
            day = 1
        
        try:
            start = CourseDataNormalizer.normalize_section(raw_data.get('start', 1))
        except ValueError as e:
            print(f"⚠️ [Normalizer] 起始节次错误，使用默认值1: {e}")
            start = 1
        
        try:
            duration = CourseDataNormalizer.normalize_duration(raw_data.get('duration', 2))
        except ValueError as e:
            print(f"⚠️ [Normalizer] 持续时长错误，使用默认值2: {e}")
            duration = 2
        
        # 标准化周次数组
        weeks = CourseDataNormalizer.normalize_weeks(raw_data.get('weeks', [1]))
        
        # 构建标准化数据
        normalized: StandardCourseData = {
            'id': str(raw_data['id']),
            'name': str(raw_data['name']),
            'teacher': str(raw_data.get('teacher', '未知教师')),
            'location': str(raw_data.get('location', '未知地点')),
            'day': day,
            'start': start,
            'duration': duration,
            'weeks': weeks,
            'week_list': weeks,  # 保持与weeks一致
            'color': str(raw_data.get('color', '#3B82F6')),
            'groupId': raw_data.get('groupId'),
            'note': raw_data.get('note')
        }
        
        return normalized
    
    @staticmethod
    def normalize_day(value: Any) -> int:
        """
        标准化星期字段
        
        将各种格式的星期值转换为1-7的整数（1=周一，7=周日）。
        
        Args:
            value: 星期值，支持整数、字符串、浮点数
            
        Returns:
            int: 1-7之间的整数
            
        Raises:
            ValueError: 当值无法转换或超出范围时
            
        Example:
            >>> CourseDataNormalizer.normalize_day(1)
            1
            >>> CourseDataNormalizer.normalize_day("3")
            3
            >>> CourseDataNormalizer.normalize_day(5.0)
            5
            >>> CourseDataNormalizer.normalize_day(0)
            ValueError: 星期值超出范围: 0
        """
        try:
            day = int(value)
            if 1 <= day <= 7:
                return day
            raise ValueError(f"星期值超出范围: {day}")
        except (TypeError, ValueError) as e:
            print(f"⚠️ [Normalizer] 无效的星期值: {value}, 错误: {e}")
            raise ValueError(f"无效的星期值: {value}")
    
    @staticmethod
    def normalize_section(value: Any) -> int:
        """
        标准化节次字段
        
        将各种格式的节次值转换为正整数（>= 1）。
        
        Args:
            value: 节次值，支持整数、字符串、浮点数
            
        Returns:
            int: 大于等于1的整数
            
        Raises:
            ValueError: 当值无法转换或小于1时
            
        Example:
            >>> CourseDataNormalizer.normalize_section(1)
            1
            >>> CourseDataNormalizer.normalize_section("5")
            5
            >>> CourseDataNormalizer.normalize_section(3.0)
            3
            >>> CourseDataNormalizer.normalize_section(0)
            ValueError: 节次必须大于等于1: 0
        """
        try:
            section = int(value)
            if section >= 1:
                return section
            raise ValueError(f"节次必须大于等于1: {section}")
        except (TypeError, ValueError) as e:
            print(f"⚠️ [Normalizer] 无效的节次值: {value}, 错误: {e}")
            raise ValueError(f"无效的节次值: {value}")
    
    @staticmethod
    def normalize_duration(value: Any) -> int:
        """
        标准化持续时长字段
        
        将各种格式的持续时长值转换为正整数（>= 1）。
        
        Args:
            value: 持续时长值，支持整数、字符串、浮点数
            
        Returns:
            int: 大于等于1的整数
            
        Raises:
            ValueError: 当值无法转换或小于1时
            
        Example:
            >>> CourseDataNormalizer.normalize_duration(2)
            2
            >>> CourseDataNormalizer.normalize_duration("4")
            4
            >>> CourseDataNormalizer.normalize_duration(1.0)
            1
            >>> CourseDataNormalizer.normalize_duration(0)
            ValueError: 持续时长必须大于等于1: 0
        """
        try:
            duration = int(value)
            if duration >= 1:
                return duration
            raise ValueError(f"持续时长必须大于等于1: {duration}")
        except (TypeError, ValueError) as e:
            print(f"⚠️ [Normalizer] 无效的持续时长值: {value}, 错误: {e}")
            raise ValueError(f"无效的持续时长值: {value}")
    
    @staticmethod
    def normalize_weeks(value: Any) -> List[int]:
        """
        标准化周次数组
        
        将各种格式的周次数据转换为整数数组。支持多种输入格式：
        - 数组: [1, 2, 3, ...]
        - 范围字符串: "1-16"
        - 逗号分隔字符串: "1,2,3"
        - 单个数字: 5
        
        Args:
            value: 周次数据，支持多种格式
            
        Returns:
            List[int]: 整数数组
            
        Example:
            >>> CourseDataNormalizer.normalize_weeks([1, 2, 3])
            [1, 2, 3]
            >>> CourseDataNormalizer.normalize_weeks("1-5")
            [1, 2, 3, 4, 5]
            >>> CourseDataNormalizer.normalize_weeks("1,3,5")
            [1, 3, 5]
            >>> CourseDataNormalizer.normalize_weeks(7)
            [7]
            >>> CourseDataNormalizer.normalize_weeks("invalid")
            [1]  # 返回默认值并记录警告
        """
        # 处理数组输入
        if isinstance(value, list):
            try:
                return [int(w) for w in value if isinstance(w, (int, str, float))]
            except (TypeError, ValueError) as e:
                print(f"⚠️ [Normalizer] 数组转换失败: {value}, 错误: {e}, 使用默认值 [1]")
                return [1]
        
        # 处理字符串输入
        if isinstance(value, str):
            # 处理 "1-16" 范围格式
            if '-' in value:
                try:
                    parts = value.split('-')
                    if len(parts) == 2:
                        start, end = int(parts[0].strip()), int(parts[1].strip())
                        if start <= end:
                            return list(range(start, end + 1))
                        else:
                            print(f"⚠️ [Normalizer] 周次范围无效（起始>结束）: {value}, 使用默认值 [1]")
                            return [1]
                except (ValueError, IndexError) as e:
                    print(f"⚠️ [Normalizer] 周次范围解析失败: {value}, 错误: {e}, 使用默认值 [1]")
                    return [1]
            
            # 处理 "1,2,3" 逗号分隔格式
            if ',' in value:
                try:
                    return [int(w.strip()) for w in value.split(',') if w.strip()]
                except (TypeError, ValueError) as e:
                    print(f"⚠️ [Normalizer] 逗号分隔周次解析失败: {value}, 错误: {e}, 使用默认值 [1]")
                    return [1]
            
            # 处理单个数字字符串
            try:
                return [int(value.strip())]
            except (TypeError, ValueError) as e:
                print(f"⚠️ [Normalizer] 单个周次解析失败: {value}, 错误: {e}, 使用默认值 [1]")
                return [1]
        
        # 处理数字输入
        if isinstance(value, (int, float)):
            try:
                return [int(value)]
            except (TypeError, ValueError) as e:
                print(f"⚠️ [Normalizer] 数字转换失败: {value}, 错误: {e}, 使用默认值 [1]")
                return [1]
        
        # 无法识别的格式
        print(f"⚠️ [Normalizer] 无法解析周次: {value} (类型: {type(value).__name__}), 使用默认值 [1]")
        return [1]
    
    @staticmethod
    def validate_and_log(course_data: Dict[str, Any]) -> bool:
        """
        验证课程数据并记录日志
        
        检查课程数据的完整性和有效性，记录详细的验证信息。
        
        Args:
            course_data: 课程数据字典
            
        Returns:
            bool: 数据是否有效
            
        Example:
            >>> data = {'name': '数学', 'day': 1, 'start': 1, 'duration': 2, 'weeks': [1,2,3]}
            >>> CourseDataNormalizer.validate_and_log(data)
            ✅ [Normalizer] 课程数据验证通过: 数学
            True
        """
        errors = []
        warnings = []
        
        # 检查必填字段
        if not course_data.get('name'):
            errors.append("课程名称缺失")
        
        if not course_data.get('id'):
            errors.append("课程ID缺失")
        
        # 检查类型
        if 'day' in course_data and not isinstance(course_data['day'], int):
            warnings.append(f"day字段类型错误: {type(course_data['day']).__name__}")
        
        if 'start' in course_data and not isinstance(course_data['start'], int):
            warnings.append(f"start字段类型错误: {type(course_data['start']).__name__}")
        
        if 'duration' in course_data and not isinstance(course_data['duration'], int):
            warnings.append(f"duration字段类型错误: {type(course_data['duration']).__name__}")
        
        if 'weeks' in course_data and not isinstance(course_data['weeks'], list):
            warnings.append(f"weeks字段类型错误: {type(course_data['weeks']).__name__}")
        
        # 检查值范围
        if 'day' in course_data:
            day = course_data['day']
            if isinstance(day, int) and not (1 <= day <= 7):
                errors.append(f"day值超出范围: {day}")
        
        if 'start' in course_data:
            start = course_data['start']
            if isinstance(start, int) and start < 1:
                errors.append(f"start值无效: {start}")
        
        if 'duration' in course_data:
            duration = course_data['duration']
            if isinstance(duration, int) and duration < 1:
                errors.append(f"duration值无效: {duration}")
        
        # 记录日志
        course_name = course_data.get('name', '未知课程')
        
        if errors:
            print(f"❌ [Normalizer] 课程数据验证失败: {course_name}")
            for error in errors:
                print(f"    - {error}")
            return False
        
        if warnings:
            print(f"⚠️ [Normalizer] 课程数据有警告: {course_name}")
            for warning in warnings:
                print(f"    - {warning}")
        else:
            print(f"✅ [Normalizer] 课程数据验证通过: {course_name}")
        
        return True
