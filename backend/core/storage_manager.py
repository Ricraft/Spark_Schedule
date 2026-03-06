# src/core/storage_manager.py

import json
import os
from typing import List, Tuple
from datetime import date

# Prefer real project models to avoid fallback stubs.
try:
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..models.week_type import WeekType
except ImportError:
    try:
        from backend.models.course_base import CourseBase
        from backend.models.course_detail import CourseDetail
        from backend.models.week_type import WeekType
    except ImportError:
        from src.models.course_base import CourseBase
        from src.models.course_detail import CourseDetail
        from src.models.week_type import WeekType


class StorageManager:
    """负责课表数据的持久化存储 (JSON)"""

    def __init__(self, filename="schedule_data.json"):
        # 数据保存在当前运行目录下的 data 文件夹
        self.data_dir = os.path.join(os.getcwd(), "data")
        os.makedirs(self.data_dir, exist_ok=True)
        self.filepath = os.path.join(self.data_dir, filename)

    def save(self, bases: List, details: List, current_week: int):
        """保存数据"""
        data = {
            "meta": {
                "version": "2.1",
                "update_time": str(date.today()),
                "current_week": current_week
            },
            "bases": [
                {
                    "name": b.name,
                    "course_id": b.course_id,
                    "color": b.color,
                    "note": getattr(b, "note", "")
                } for b in bases
            ],
            "details": [
                {
                    "course_id": d.course_id,
                    "day_of_week": d.day_of_week,
                    "start_section": d.start_section,
                    "step": d.step,
                    "start_week": d.start_week,
                    "end_week": d.end_week,
                    "week_type": d.week_type.value,  # 存枚举值
                    "teacher": d.teacher,
                    "location": d.location
                } for d in details
            ]
        }

        try:
            with open(self.filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存失败: {e}")
            return False

    def load(self) -> Tuple[List, List, int]:
        """加载数据，返回 (bases, details, current_week)"""
        if not os.path.exists(self.filepath):
            return [], [], 1

        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            current_week = data.get("meta", {}).get("current_week", 1)

            # 重建 CourseBase 对象
            bases = []
            for b in data.get("bases", []):
                bases.append(CourseBase(
                    name=b["name"],
                    course_id=b["course_id"],
                    color=b["color"],
                    note=b.get("note", "")
                ))

            # 重建 CourseDetail 对象
            details = []
            for d in data.get("details", []):
                # 恢复 WeekType 枚举
                try:
                    w_type = WeekType(d["week_type"])
                except Exception:
                    w_type = WeekType.EVERY_WEEK

                details.append(CourseDetail(
                    course_id=d["course_id"],
                    day_of_week=d["day_of_week"],
                    start_section=d["start_section"],
                    step=d["step"],
                    start_week=d["start_week"],
                    end_week=d["end_week"],
                    week_type=w_type,
                    teacher=d.get("teacher", ""),
                    location=d.get("location", "")
                ))

            return bases, details, current_week
        except Exception as e:
            print(f"加载数据出错: {e}")
            return [], [], 1
