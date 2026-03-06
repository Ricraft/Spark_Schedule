"""
HTML 导入器 - 智能路由分发中心

负责检测 HTML 特征并路由到最合适的解析器
不再包含具体的解析细节，而是作为一个"分发中心"
"""

import re
from typing import List, Tuple

from bs4 import BeautifulSoup

try:
    from .base_importer import BaseImporter
    from .qiangzhi_importer import QiangZhiImporter
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..utils.color_manager import ColorManager
except ImportError:
    from importers.base_importer import BaseImporter
    from importers.qiangzhi_importer import QiangZhiImporter
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail
    from utils.color_manager import ColorManager


class HTMLImporter(BaseImporter):
    """
    智能 HTML 导入器
    
    负责检测 HTML 特征并路由到最合适的解析器
    优先尝试特定的学校插件，最后回退到通用解析
    """
    
    def __init__(self):
        """初始化 HTML 导入器 - 智能路由分发中心"""
        self.color_manager = ColorManager()
        
        # 预加载已知解析器列表，优先级从高到低
        self.specialized_importers = [
            None,  # USCImporter 将在首次使用时初始化
            None   # QiangZhiImporter 将在首次使用时初始化
        ]
    
    def get_supported_formats(self) -> List[str]:
        """获取支持的文件格式"""
        return ['.html', '.htm']
    
    def _init_importers(self):
        """延迟初始化导入器列表"""
        if self.specialized_importers[0] is None:
            try:
                from .usc_importer import USCImporter
                self.specialized_importers[0] = USCImporter()
            except ImportError:
                from importers.usc_importer import USCImporter
                self.specialized_importers[0] = USCImporter()
        
        if self.specialized_importers[1] is None:
            self.specialized_importers[1] = QiangZhiImporter(school_name="通用强智系统")
    
    def validate(self, content: str) -> Tuple[bool, str]:
        """
        验证 HTML 内容是否有效
        
        Args:
            content: HTML 内容
            
        Returns:
            (是否有效, 错误消息)
        """
        if not content or not content.strip():
            return False, "内容为空"
        
        try:
            # 延迟初始化导入器
            self._init_importers()
            
            # 只要有一个导入器能验证通过即可
            for importer in self.specialized_importers:
                if importer:
                    valid, _ = importer.validate(content)
                    if valid:
                        return True, ""
            
            return False, "无法识别的课表格式"
        except Exception as e:
            return False, f"HTML 解析失败: {str(e)}"
    
    def parse(self, content: str) -> Tuple[List[CourseBase], List[CourseDetail]]:
        """
        解析 HTML 内容 - 智能路由到最合适的解析器
        
        Args:
            content: HTML 内容
            
        Returns:
            (CourseBase列表, CourseDetail列表)
            
        Raises:
            ValueError: 解析失败时抛出
        """
        # 验证内容
        valid, msg = self.validate(content)
        if not valid:
            raise ValueError(msg)
        
        # 延迟初始化导入器
        self._init_importers()
        
        # 1. 自动分发：查找最匹配的专用解析器
        for importer in self.specialized_importers:
            if importer:
                valid, _ = importer.validate(content)
                if valid:
                    return importer.parse(content)
        
        # 2. 如果没有任何匹配，抛出异常
        raise ValueError("未找到适配的解析引擎")
