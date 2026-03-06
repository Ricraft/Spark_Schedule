"""
配置模型
src/models/config.py
"""

import json
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import List, Dict, Any

# 配置文件路径
CONFIG_PATH = Path("config.json")

@dataclass
class Config:
    """
    应用配置类 (包含所有设置项)
    """
    # --- 外观 ---
    semester_start_date: str = "2024-09-01"  # 开学日期
    background_path: str = ""                # 背景图路径
    background_opacity: float = 0.85         # 背景不透明度
    course_opacity: float = 0.95             # 卡片不透明度
    theme_mode: str = "auto"                 # 主题
    header_style: str = "translucent"        # 表头风格: default, translucent, transparent

    # --- 常规: 启动与行为 ---
    auto_start: bool = False                 # 开机自启
    minimize_to_tray: bool = False           # 最小化到托盘
    exit_on_close: bool = True               # 关闭时退出

    # --- 常规: 提醒与更新 ---
    enable_notification: bool = True         # 开启通知
    remind_minutes: int = 15                 # 提前几分钟
    auto_update: bool = True                 # 自动检查更新
    language: str = "zh_CN"                  # 语言

    # --- 学期: 课程节数 (修复编辑功能失灵的关键) ---
    total_courses_per_day: int = 12
    morning_count: int = 4
    afternoon_count: int = 4
    evening_count: int = 4

    # --- 自定义作息时间表 ---
    # 格式: [{"section": 1, "start": "08:00", "end": "08:45"}, ...]
    custom_time_slots: List[Dict[str, Any]] = field(default_factory=list)

    @classmethod
    def load(cls) -> 'Config':
        if CONFIG_PATH.exists():
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                # 仅读取类中定义的字段，防止旧配置导致报错
                valid_keys = cls.__annotations__.keys()
                filtered_data = {k: v for k, v in data.items() if k in valid_keys}
                return cls(**filtered_data)
            except Exception as e:
                print(f"Failed to load config: {e}")
                return cls()
        return cls()

    def save(self):
        try:
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(asdict(self), f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"Failed to save config: {e}")