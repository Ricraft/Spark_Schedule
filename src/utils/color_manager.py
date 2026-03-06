import hashlib
import colorsys
from typing import List, Dict, Any, Optional
from PyQt6.QtGui import QColor

class ColorManager:
    """
    颜色管理器：用于生成美观的课程颜色
    """
    
    # 高饱和度现代化配色板 (适用于渐变和卡片)
    PALETTE = [
        "#FF3B30", "#FF9500", "#FFCC00", "#34C759", 
        "#007AFF", "#5856D6", "#AF52DE", "#FF2D55",
        "#FF5E3A", "#FF2A68", "#FFDB4C", "#87FC70",
        "#52EDC7", "#1AD6FD", "#C644FC", "#EF4DB6",
        "#4CD964", "#5AC8FA", "#0059FF", "#34AADC"
    ]
    
    # 颜色分配缓存
    _color_cache: Dict[str, str] = {}
    
    @staticmethod
    def get_color_for_course(course_name: str) -> str:
        """
        根据课程名称生成固定的颜色
        """
        if not course_name:
            return "#E0E0E0" # 默认灰色
            
        # 检查缓存
        if course_name in ColorManager._color_cache:
            return ColorManager._color_cache[course_name]
            
        # 使用 MD5 哈希确保同一个课程名永远对应同一个颜色
        hash_obj = hashlib.md5(course_name.encode('utf-8'))
        hash_int = int(hash_obj.hexdigest(), 16)
        
        # 从调色板中取色
        index = hash_int % len(ColorManager.PALETTE)
        color = ColorManager.PALETTE[index]
        
        # 缓存结果
        ColorManager._color_cache[course_name] = color
        return color
    
    @staticmethod
    def assign_colors_to_import(courses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        为导入的课程批量分配颜色
        
        Args:
            courses: 课程列表，每个课程是包含课程信息的字典
            
        Returns:
            带有颜色信息的课程列表
        """
        if not courses:
            return []
            
        # 为每个课程分配颜色
        for course in courses:
            if isinstance(course, dict) and 'name' in course:
                # 如果课程已有颜色且有效，则保留
                if 'color' in course and ColorManager.validate_color_format(course['color']):
                    continue
                    
                # 否则分配新颜色
                course['color'] = ColorManager.get_color_for_course(course['name'])
        
        return courses
    
    @staticmethod
    def get_group_color(group_key: str) -> str:
        """
        为课程分组获取统一颜色
        
        Args:
            group_key: 分组标识符（通常是课程名称+教师+地点的组合）
            
        Returns:
            分组颜色的十六进制字符串
        """
        return ColorManager.get_color_for_course(group_key)
    
    @staticmethod
    def validate_color_format(color: str) -> bool:
        """
        验证颜色格式是否有效
        
        Args:
            color: 颜色字符串
            
        Returns:
            是否为有效的颜色格式
        """
        if not color or not isinstance(color, str):
            return False
            
        # 检查十六进制颜色格式
        if color.startswith('#') and len(color) == 7:
            try:
                int(color[1:], 16)
                return True
            except ValueError:
                return False
                
        return False
    
    @staticmethod
    def validate_color_contrast(color: str, background: str = "#FFFFFF") -> bool:
        """
        验证颜色对比度是否符合可访问性标准
        
        Args:
            color: 前景色
            background: 背景色，默认为白色
            
        Returns:
            是否符合WCAG AA标准（对比度 >= 4.5:1）
        """
        if not ColorManager.validate_color_format(color) or not ColorManager.validate_color_format(background):
            return False
            
        try:
            # 计算相对亮度
            def get_relative_luminance(hex_color: str) -> float:
                # 移除 # 符号并转换为RGB
                rgb = tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))
                
                # 转换为相对亮度
                def linearize(c: int) -> float:
                    c = c / 255.0
                    return c / 12.92 if c <= 0.03928 else pow((c + 0.055) / 1.055, 2.4)
                
                r, g, b = [linearize(c) for c in rgb]
                return 0.2126 * r + 0.7152 * g + 0.0722 * b
            
            # 计算对比度
            l1 = get_relative_luminance(color)
            l2 = get_relative_luminance(background)
            
            # 确保较亮的颜色在分子位置
            if l1 < l2:
                l1, l2 = l2, l1
                
            contrast_ratio = (l1 + 0.05) / (l2 + 0.05)
            
            # WCAG AA标准要求对比度至少为4.5:1
            return contrast_ratio >= 4.5
            
        except Exception:
            return False
    
    @staticmethod
    def get_color_info(color: str) -> Dict[str, Any]:
        """
        获取颜色的详细信息
        
        Args:
            color: 十六进制颜色字符串
            
        Returns:
            包含颜色信息的字典
        """
        if not ColorManager.validate_color_format(color):
            return {}
            
        try:
            # 转换为RGB
            rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))
            
            # 转换为HSV
            hsv = colorsys.rgb_to_hsv(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0)
            
            return {
                'hex': color,
                'rgb': rgb,
                'hsv': {
                    'hue': int(hsv[0] * 360),
                    'saturation': int(hsv[1] * 100),
                    'value': int(hsv[2] * 100)
                },
                'contrast_with_white': ColorManager.validate_color_contrast(color, "#FFFFFF"),
                'contrast_with_black': ColorManager.validate_color_contrast(color, "#000000")
            }
            
        except Exception:
            return {}
    
    @staticmethod
    def get_qcolor(color: str) -> QColor:
        """
        将十六进制颜色转换为QColor对象
        
        Args:
            color: 十六进制颜色字符串
            
        Returns:
            QColor对象
        """
        if ColorManager.validate_color_format(color):
            return QColor(color)
        return QColor("#E0E0E0")  # 默认灰色
    
    @staticmethod
    def clear_cache():
        """
        清空颜色缓存
        """
        ColorManager._color_cache.clear()