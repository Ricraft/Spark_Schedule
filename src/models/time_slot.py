"""
时间段数据模型

定义每节课的开始和结束时间
"""

from typing import Dict, Any, List
from datetime import time


class TimeSlot:
    """
    时间段
    
    表示一节课的时间范围
    
    Attributes:
        section_number: 节次编号（1-12）
        start_time: 开始时间
        end_time: 结束时间
    """
    
    def __init__(
        self,
        section_number: int,
        start_time: time,
        end_time: time
    ):
        """
        初始化时间段
        
        Args:
            section_number: 节次编号
            start_time: 开始时间
            end_time: 结束时间
        """
        self.section_number = section_number
        self.start_time = start_time
        self.end_time = end_time
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典（用于序列化）
        
        Returns:
            包含所有字段的字典
        """
        return {
            "section_number": self.section_number,
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M"),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TimeSlot':
        """
        从字典创建对象（用于反序列化）
        
        Args:
            data: 包含时间段信息的字典
            
        Returns:
            TimeSlot 对象
        """
        start_time = time.fromisoformat(data["start_time"])
        end_time = time.fromisoformat(data["end_time"])
        
        return cls(
            section_number=data["section_number"],
            start_time=start_time,
            end_time=end_time
        )
    
    def __eq__(self, other) -> bool:
        """比较两个时间段是否相等"""
        if not isinstance(other, TimeSlot):
            return False
        return (
            self.section_number == other.section_number and
            self.start_time == other.start_time and
            self.end_time == other.end_time
        )
    
    def __repr__(self) -> str:
        """字符串表示"""
        return (
            f"TimeSlot(section={self.section_number}, "
            f"{self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')})"
        )
    
    def __str__(self) -> str:
        """用户友好的字符串表示"""
        return f"第{self.section_number}节 {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"
    
    @classmethod
    def generate_default_time_slots(cls) -> List['TimeSlot']:
        """
        生成默认的时间段配置（12节课）
        
        参考常见高校作息时间：
        - 第1-2节：08:00-09:40（上午）
        - 第3-4节：10:00-11:40
        - 第5-6节：14:00-15:40（下午）
        - 第7-8节：16:00-17:40
        - 第9-10节：19:00-20:40（晚上）
        - 第11-12节：20:50-22:30
        
        Returns:
            时间段列表
        """
        time_slots = [
            # 上午
            cls(1, time(8, 0), time(8, 45)),
            cls(2, time(8, 55), time(9, 40)),
            cls(3, time(10, 0), time(10, 45)),
            cls(4, time(10, 55), time(11, 40)),
            # 下午
            cls(5, time(14, 0), time(14, 45)),
            cls(6, time(14, 55), time(15, 40)),
            cls(7, time(16, 0), time(16, 45)),
            cls(8, time(16, 55), time(17, 40)),
            # 晚上
            cls(9, time(19, 0), time(19, 45)),
            cls(10, time(19, 55), time(20, 40)),
            cls(11, time(20, 50), time(21, 35)),
            cls(12, time(21, 45), time(22, 30)),
        ]
        return time_slots
