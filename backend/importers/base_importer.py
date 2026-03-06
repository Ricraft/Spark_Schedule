"""
导入器基类

定义导入器的通用接口
"""

from abc import ABC, abstractmethod
from typing import List, Tuple

try:
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
except ImportError:
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail


class BaseImporter(ABC):
    """
    导入器基类
    
    所有导入器都应该继承此类并实现抽象方法
    """
    
    @abstractmethod
    def parse(self, content: str) -> Tuple[List[CourseBase], List[CourseDetail]]:
        """
        解析内容并返回课程列表
        
        Args:
            content: 要解析的内容（HTML、文本等）
            
        Returns:
            (CourseBase列表, CourseDetail列表) 元组
            
        Raises:
            ValueError: 解析失败时抛出
        """
        pass
    
    @abstractmethod
    def validate(self, content: str) -> Tuple[bool, str]:
        """
        验证内容格式是否正确
        
        Args:
            content: 要验证的内容
            
        Returns:
            (是否有效, 错误消息) 元组
        """
        pass
    
    def get_supported_formats(self) -> List[str]:
        """
        获取支持的文件格式
        
        Returns:
            支持的文件扩展名列表（如 ['.html', '.htm']）
        """
        return []
    
    def get_importer_name(self) -> str:
        """
        获取导入器名称
        
        Returns:
            导入器名称
        """
        return self.__class__.__name__
