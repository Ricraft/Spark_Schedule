"""
周类型枚举
src/models/week_type.py
"""

from enum import Enum

class WeekType(Enum):
    EVERY_WEEK = "every"
    ODD_WEEK = "odd"
    EVEN_WEEK = "even"

    def __str__(self):
        return self.value

    @classmethod
    def from_string(cls, value: str) -> 'WeekType':
        value = value.lower()
        for week_type in cls:
            if week_type.value == value:
                return week_type
        return cls.EVERY_WEEK

    def matches_week(self, week_number: int) -> bool:
        if self == WeekType.EVERY_WEEK:
            return True
        elif self == WeekType.ODD_WEEK:
            return week_number % 2 != 0
        elif self == WeekType.EVEN_WEEK:
            return week_number % 2 == 0
        return False