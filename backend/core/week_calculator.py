"""
周次计算器

负责计算当前周次、判断单双周等时间相关的业务逻辑
"""

from datetime import date

def calculate_week_number(start_date: date, target_date: date) -> int:
    """
    计算从开始日期到目标日期是第几周
    
    Args:
        start_date: 开始日期（学期开始）
        target_date: 目标日期
        
    Returns:
        周次（从1开始）
    """
    delta = target_date - start_date
    return (delta.days // 7) + 1

def is_odd_week(week: int) -> bool:
    """
    判断是否为单周（奇数周）
    
    Args:
        week: 周次
        
    Returns:
        是否为单周
    """
    return week % 2 != 0

def is_even_week(week: int) -> bool:
    """
    判断是否为双周（偶数周）
    
    Args:
        week: 周次
        
    Returns:
        是否为双周
    """
    return week % 2 == 0


class WeekCalculator:
    """
    周次计算器
    
    提供周次计算相关的功能
    """
    
    def __init__(self, semester_start_date: date):
        """
        初始化周次计算器
        
        Args:
            semester_start_date: 学期开始日期
        """
        self.semester_start_date = semester_start_date
    
    def get_current_week(self) -> int:
        """
        获取当前周次
        
        Returns:
            当前周次（从1开始）
        """
        return calculate_week_number(self.semester_start_date, date.today())
    
    def calculate_week(self, target_date: date) -> int:
        """
        计算指定日期是第几周
        
        Args:
            target_date: 目标日期
            
        Returns:
            周次（从1开始）
        """
        return calculate_week_number(self.semester_start_date, target_date)
    
    def is_odd_week(self, week: int) -> bool:
        """
        判断是否为单周（奇数周）
        
        Args:
            week: 周次
            
        Returns:
            是否为单周
        """
        return is_odd_week(week)
    
    def is_even_week(self, week: int) -> bool:
        """
        判断是否为双周（偶数周）
        
        Args:
            week: 周次
            
        Returns:
            是否为双周
        """
        return is_even_week(week)
    
    def set_semester_start_date(self, semester_start_date: date) -> None:
        """
        设置学期开始日期
        
        Args:
            semester_start_date: 新的学期开始日期
        """
        self.semester_start_date = semester_start_date
