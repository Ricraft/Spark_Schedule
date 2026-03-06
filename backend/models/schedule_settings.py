"""
璇剧▼琛ㄥ叏灞€璁剧疆鏁版嵁妯″瀷

瀹氫箟璇剧▼琛ㄧ郴缁熺殑鍏ㄥ眬璁剧疆鏁版嵁缁撴瀯
"""

from dataclasses import dataclass, asdict
from typing import Optional
from datetime import datetime


@dataclass
class ScheduleSettings:
    """
    璇剧▼琛ㄥ叏灞€璁剧疆鏁版嵁缁撴瀯
    
    鍖呭惈瀛︽湡閰嶇疆銆佹樉绀洪€夐」銆佸姛鑳藉紑鍏崇瓑鍏ㄥ眬璁剧疆
    """
    
    # 瀛︽湡閰嶇疆
    semester_weeks: int = 20                    # 瀛︽湡鎬诲懆鏁?
    current_week: int = 1                       # 褰撳墠鍛ㄦ暟
    start_date: str = ""                        # 瀛︽湡寮€濮嬫棩鏈?(YYYY-MM-DD鏍煎紡)
    week_start_day: str = "monday"              # week1 day1: monday..sunday
    holidays: list[int] = None                  # 鑺傚亣鏃?鏀惧亣鍛?
    
    # 鏃堕棿鏄剧ず閫夐」
    start_hour: int = 8                         # 瑙嗗浘寮€濮嬪皬鏃?
    start_minute: int = 0                       # 瑙嗗浘寮€濮嬪垎閽?
    end_hour: int = 22                          # 瑙嗗浘缁撴潫灏忔椂
    use24_hour_format: bool = True              # 鏄惁浣跨敤24灏忔椂鍒?
    
    # 璇炬椂閰嶇疆
    section_duration: int = 45
    break_duration: int = 10
    sections_per_day: int = 12
    section_times: list[dict[str, str]] = None
    time_presets: list[dict] = None
    active_time_preset_id: str = "default-standard"

    show_weekends: bool = True
    time_slot_height: int = 80
    course_opacity: float = 0.9
    schedule_opacity: float = 0.2
    show_non_current_week_courses: bool = False
    show_course_white_border: bool = True
    show_grid_lines: bool = True
    show_time_indicator: bool = True
    highlight_today: bool = True                # 鏄惁楂樹寒浠婂ぉ
    show_teacher: bool = True                   # 鏄惁鏄剧ず鑰佸笀
    show_location: bool = True                  # 鏄惁鏄剧ず鍦扮偣
    font_size: str = "medium"                   # 瀛椾綋澶у皬: small, medium, large
    conflict_mode: str = "overlap"              # 鍐茬獊鏄剧ず妯″紡: overlap, stack
    
    # 鍔熻兘寮€鍏?
    auto_save: bool = True                      # 鏄惁鑷姩淇濆瓨
    auto_color_import: bool = True              # 瀵煎叆鏃惰嚜鍔ㄩ厤鑹?
    enable_course_grouping: bool = True         # 鍚敤璇剧▼鑷姩鍒嗙粍
    ui_animations: bool = True                  # 鍚敤UI鍔ㄧ敾鏁堟灉
    enable_notifications: bool = True           # 鍚敤閫氱煡
    dark_mode: bool = False                     # 娣辫壊妯″紡
    midnight_mode: bool = False                 # 娣遍們澶滆壊妯″紡
    
    # 澶栬璁剧疆
    gpu_acceleration: bool = True               # GPU 纭欢鍔犻€?
    ui_transitions: bool = True                 # UI 杩囨浮鍔ㄧ敾
    background_image: str = ""                  # 鑷畾涔夎儗鏅浘鍍忚矾寰?
    acrylic_opacity: int = 80                   # 浜氬厠鍔涙晥鏋滀笉閫忔槑搴?(0-100)
    
    # 閫氱煡璁剧疆锛堟墿灞曪級
    notification_sound: str = "bell"            # 閫氱煡鎻愮ず闊崇被鍨?
    notification_volume: int = 80               # 閫氱煡闊抽噺 (0-100)
    reminder_lead_minutes: int = 15             # 鎻愰啋鎻愬墠鍒嗛挓鏁?(1-120)
    
    # 鍚姩琛屼负璁剧疆
    auto_start: bool = False                    # 寮€鏈鸿嚜鍚姩
    minimize_to_tray: bool = True               # 鍏抽棴鏃舵渶灏忓寲鍒版墭鐩?
    start_minimized: bool = False               # 鍚姩鏃舵渶灏忓寲
    
    # 澶栭儴鏈嶅姟璁剧疆
    weather_enabled: bool = False               # 鍚敤澶╂皵鏈嶅姟
    weather_api_key: str = ""                   # 鍜岄澶╂皵 API 瀵嗛挜
    weather_host_url: str = ""                  # 鍜岄澶╂皵鏈嶅姟绔偣鍦板潃
    weather_location: str = ""                  # 澶╂皵浣嶇疆锛堝煄甯備唬鐮佹垨缁忕含搴︼級
    shici_enabled: bool = False                 # 鍚敤浠婃棩璇楄瘝
    
    # AI 寮曟搸璁剧疆锛堟墿灞曪級
    ai_learning_enabled: bool = False           # 鍚敤 AI 瀛︿範寤鸿
    ai_task_parsing_enabled: bool = False       # 鍚敤 AI 浠诲姟瑙ｆ瀽
    
    # 楂樼骇璁剧疆
    enable_devtools: bool = False               # 鍚敤寮€鍙戣€呭伐鍏?
    show_python_console: bool = False           # 鏄剧ず Python 鎺у埗鍙?
    performance_overlay: bool = False           # 鏄剧ず鎬ц兘鍙犲姞灞?
    
    # 鏁版嵁绠＄悊
    enable_auto_backup: bool = True             # 鍚敤鑷姩澶囦唤
    backup_freq: str = "daily"                  # 澶囦唤棰戠巼: daily, weekly, manual
    backup_retention_days: int = 30             # 澶囦唤淇濈暀澶╂暟
    
    # 绯荤粺涓庨珮绾?
    enable_debug_mode: bool = False             # 鍚敤璋冭瘯妯″紡
    log_level: str = "warn"                     # 鏃ュ織绾у埆: error, warn, info, debug
    
    # 鐣寗閽熻缃?
    focus_duration: int = 25                    # 涓撴敞鏃堕暱(鍒嗛挓)
    pomodoro_break_duration: int = 5            # 鐣寗閽熶紤鎭椂闀?鍒嗛挓)
    ambient_sound: str = "rain"                 # 鐧藉櫔闊崇被鍨?
    ambient_volume: int = 50                    # 鐧藉櫔闊抽煶閲?0-100)
    auto_play_noise: bool = True                # 鑷姩鎾斁鐧藉櫔闊?
    week_goal_hours: int = 20                   # 姣忓懆鐩爣瀛︿範鏃堕暱(灏忔椂)
    
    # 瀛︿範鏃堕棿缁熻
    week_minutes: int = 0                       # 鏈懆绱Н瀛︿範鏃堕暱(鍒嗛挓)
    study_time_last_updated: Optional[str] = None  # 瀛︿範鏃堕棿鏈€鍚庢洿鏂版椂闂?
    
    # AI 鏅鸿兘瀵煎叆璁剧疆
    ai_provider: str = "openai"                 # AI 鎻愪緵鍟? openai, deepseek
    ai_api_key: str = ""                        # API 瀵嗛挜
    ai_base_url: str = "https://api.openai.com/v1" # API 鍩虹鍦板潃
    ai_model: str = "gpt-3.5-turbo"             # 浣跨敤鐨勬ā鍨嬪悕绉?
    ai_system_prompt: str = "You are a helpful assistant that extracts task information as JSON."
    
    # AI 浠诲姟瑙ｆ瀽寮曟搸璁剧疆锛堢嫭绔嬮厤缃級
    ai_task_base_url: str = "https://api.openai.com/v1"  # 浠诲姟瑙ｆ瀽API鍩虹鍦板潃
    ai_task_api_key: str = ""                   # 浠诲姟瑙ｆ瀽API瀵嗛挜
    ai_task_model: str = "gpt-3.5-turbo"        # 浠诲姟瑙ｆ瀽浣跨敤鐨勬ā鍨?
    ai_task_prompt: str = ""                    # 浠诲姟瑙ｆ瀽绯荤粺鎻愮ず璇?
    
    # AI 瀛︿範寤鸿寮曟搸璁剧疆锛堢嫭绔嬮厤缃級
    ai_learning_base_url: str = "https://api.openai.com/v1"  # 瀛︿範寤鸿API鍩虹鍦板潃
    ai_learning_api_key: str = ""               # 瀛︿範寤鸿API瀵嗛挜
    ai_learning_model: str = "gpt-4o"           # 瀛︿範寤鸿浣跨敤鐨勬ā鍨?
    ai_learning_prompt: str = ""                # 瀛︿範寤鸿绯荤粺鎻愮ず璇?
    
    # 鍏冩暟鎹?
    version: str = "1.0"                        # 璁剧疆鐗堟湰
    last_modified: Optional[str] = None         # 鏈€鍚庝慨鏀规椂闂?
    
    def __post_init__(self):
        """鍒濆鍖栧悗澶勭悊"""
        if self.last_modified is None:
            self.last_modified = datetime.now().isoformat()
        if self.holidays is None:
            self.holidays = []
        if self.section_times is None:
            self.section_times = []
            current_total = self.start_hour * 60 + self.start_minute
            for i in range(self.sections_per_day):
                start_h = current_total // 60
                start_m = current_total % 60
                end_total = current_total + self.section_duration
                end_h = end_total // 60
                end_m = end_total % 60
                
                self.section_times.append({
                    "s": f"{start_h:02d}:{start_m:02d}",
                    "e": f"{end_h:02d}:{end_m:02d}"
                })
                current_total = end_total + self.break_duration
        else:
            self.section_times = self._clone_section_times(self.section_times)

        if not isinstance(self.time_presets, list) or not self.time_presets:
            self.time_presets = [self._build_default_time_preset()]
        else:
            normalized_presets = []
            for i, preset in enumerate(self.time_presets):
                if not isinstance(preset, dict):
                    continue
                preset_times = self._clone_section_times(preset.get("sectionTimes"))
                if not preset_times:
                    preset_times = self._clone_section_times(self.section_times)
                normalized_presets.append({
                    "id": str(preset.get("id") or f"preset-{i + 1}"),
                    "name": str(preset.get("name") or f"鏂规 {i + 1}"),
                    "sectionsPerDay": int(preset.get("sectionsPerDay") or self.sections_per_day),
                    "sectionDuration": int(preset.get("sectionDuration") or self.section_duration),
                    "breakDuration": int(preset.get("breakDuration") or self.break_duration),
                    "sectionTimes": preset_times,
                })

            self.time_presets = normalized_presets or [self._build_default_time_preset()]

        if not isinstance(self.active_time_preset_id, str) or not self.active_time_preset_id.strip():
            self.active_time_preset_id = str(self.time_presets[0].get("id", "default-standard"))
        elif not any(str(preset.get("id")) == self.active_time_preset_id for preset in self.time_presets):
            self.active_time_preset_id = str(self.time_presets[0].get("id", "default-standard"))

    def _clone_section_times(self, section_times: list[dict[str, str]] | None) -> list[dict[str, str]]:
        """Clone and normalize section times into [{s, e}, ...] shape."""
        if not isinstance(section_times, list):
            return []
        normalized = []
        for slot in section_times:
            if not isinstance(slot, dict):
                continue
            start = str(slot.get("s", "")).strip()
            end = str(slot.get("e", "")).strip()
            if not start or not end:
                continue
            normalized.append({"s": start, "e": end})
        return normalized

    def _build_default_time_preset(self) -> dict:
        """Build a default preset from the current section config."""
        return {
            "id": "default-standard",
            "name": "鏍囧噯鏁欏浣滄伅",
            "sectionsPerDay": self.sections_per_day,
            "sectionDuration": self.section_duration,
            "breakDuration": self.break_duration,
            "sectionTimes": self._clone_section_times(self.section_times),
        }
    
    def to_dict(self) -> dict:
        """Convert settings to dict."""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ScheduleSettings':
        """Create settings from dict."""
        # 杩囨护鎺変笉瀛樺湪鐨勫瓧娈?
        valid_fields = {field.name for field in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered_data)
    def validate(self, ignore_key_strength: bool = False) -> tuple[bool, str]:
        """Validate settings integrity."""
        if not isinstance(self.semester_weeks, int) or not (1 <= self.semester_weeks <= 52):
            return False, "学期周数必须是1-52之间的整数"

        if not isinstance(self.current_week, int) or not (1 <= self.current_week <= self.semester_weeks):
            return False, "当前周数超出学期范围"

        if self.start_date:
            try:
                datetime.strptime(self.start_date, "%Y-%m-%d")
            except ValueError:
                return False, "学期开始日期格式必须为YYYY-MM-DD"

        if not isinstance(self.start_hour, int) or not isinstance(self.end_hour, int) or self.start_hour >= self.end_hour:
            return False, "结束时间必须晚于开始时间"

        if not isinstance(self.sections_per_day, int) or not (1 <= self.sections_per_day <= 20):
            return False, "每日课程节数必须是1-20之间的整数"

        if not isinstance(self.section_times, list):
            return False, "section_times must be a list"

        for slot in self.section_times:
            if not isinstance(slot, dict):
                return False, "section_times items must be objects"
            start = slot.get("s")
            end = slot.get("e")
            if not isinstance(start, str) or not isinstance(end, str):
                return False, "section_times values must be strings"
            if len(start) != 5 or len(end) != 5 or start[2] != ":" or end[2] != ":":
                return False, "section_times values must use HH:MM format"

        if not isinstance(self.time_presets, list) or not self.time_presets:
            return False, "time_presets must be a non-empty list"

        if not any(str(preset.get("id")) == str(self.active_time_preset_id) for preset in self.time_presets if isinstance(preset, dict)):
            return False, "active_time_preset_id must exist in time_presets"

        if not isinstance(self.time_slot_height, int) or not (20 <= self.time_slot_height <= 200):
            return False, "时间段高度必须是20-200之间的整数"

        if not isinstance(self.course_opacity, (int, float)) or not (0.0 <= float(self.course_opacity) <= 1.0):
            return False, "课程透明度必须在0到1之间"

        if not isinstance(self.schedule_opacity, (int, float)) or not (0.0 <= float(self.schedule_opacity) <= 1.0):
            return False, "课程表透明度必须在0到1之间"

        if not isinstance(self.show_non_current_week_courses, bool):
            return False, "show_non_current_week_courses must be boolean"

        if not isinstance(self.show_course_white_border, bool):
            return False, "show_course_white_border must be boolean"

        if not isinstance(self.acrylic_opacity, int) or not (0 <= self.acrylic_opacity <= 100):
            return False, "亚克力不透明度必须是0-100之间的整数"

        if not isinstance(self.notification_volume, int) or not (0 <= self.notification_volume <= 100):
            return False, "通知音量必须是0-100之间的整数"

        if not isinstance(self.reminder_lead_minutes, int) or not (1 <= self.reminder_lead_minutes <= 120):
            return False, "提醒提前分钟数必须是1-120之间的整数"

        if not isinstance(self.ambient_volume, int) or not (0 <= self.ambient_volume <= 100):
            return False, "环境音音量必须是0-100之间的整数"

        if not isinstance(self.focus_duration, int) or not (1 <= self.focus_duration <= 120):
            return False, "专注时长必须是1-120之间的整数"

        if not isinstance(self.pomodoro_break_duration, int) or not (1 <= self.pomodoro_break_duration <= 60):
            return False, "番茄钟休息时长必须是1-60之间的整数"

        if not isinstance(self.week_goal_hours, int) or not (1 <= self.week_goal_hours <= 168):
            return False, "每周目标学习时长必须是1-168之间的整数"

        if self.background_image:
            import os
            if not os.path.isfile(self.background_image):
                return False, f"background image does not exist: {self.background_image}"

        if not isinstance(self.backup_retention_days, int) or self.backup_retention_days < 1:
            return False, "备份保留天数必须大于0"

        is_valid, error = self._validate_api_keys(ignore_key_strength=ignore_key_strength)
        if not is_valid:
            return is_valid, error

        is_valid, error = self._validate_enum_values()
        if not is_valid:
            return is_valid, error

        return True, ""

    def _validate_api_keys(self, ignore_key_strength: bool = False) -> tuple[bool, str]:
        """Validate external API-related settings."""
        if self.weather_enabled and self.weather_api_key and not ignore_key_strength:
            if not isinstance(self.weather_api_key, str) or len(self.weather_api_key) < 16:
                return False, "和风天气 API 密钥长度至少16位"

        ai_enabled = self.ai_learning_enabled or self.ai_task_parsing_enabled
        if ai_enabled and self.ai_api_key and not ignore_key_strength:
            if not isinstance(self.ai_api_key, str) or len(self.ai_api_key) < 20:
                return False, "AI API 密钥长度至少20位"
            if self.ai_provider == "openai" and not self.ai_api_key.startswith("sk-"):
                return False, "OpenAI API 密钥必须以sk-开头"

        if self.ai_task_parsing_enabled and self.ai_task_api_key and not ignore_key_strength:
            if not isinstance(self.ai_task_api_key, str) or len(self.ai_task_api_key) < 20:
                return False, "AI 任务 API 密钥长度至少20位"

        if self.ai_base_url and (not isinstance(self.ai_base_url, str) or not (self.ai_base_url.startswith("http://") or self.ai_base_url.startswith("https://"))):
            return False, "AI API 基础地址必须以http://或https://开头"

        if self.ai_task_base_url and (not isinstance(self.ai_task_base_url, str) or not (self.ai_task_base_url.startswith("http://") or self.ai_task_base_url.startswith("https://"))):
            return False, "AI 任务 API 基础地址必须以http://或https://开头"

        if self.ai_learning_base_url and (not isinstance(self.ai_learning_base_url, str) or not (self.ai_learning_base_url.startswith("http://") or self.ai_learning_base_url.startswith("https://"))):
            return False, "AI 学习 API 基础地址必须以http://或https://开头"

        return True, ""

    def _validate_enum_values(self) -> tuple[bool, str]:
        """Validate enum-like fields."""
        if self.font_size not in {"small", "medium", "large"}:
            return False, "字体大小必须是small/medium/large"

        if self.conflict_mode not in {"overlap", "stack"}:
            return False, "冲突显示模式无效"

        if self.notification_sound not in {"bell", "chime", "ding", "none", "digital", "bird", "rain"}:
            return False, "通知提示音类型无效"

        if self.ambient_sound not in {"rain", "ocean", "forest", "cafe", "white_noise", "none", "fire", "night"}:
            return False, "环境音类型无效"

        if self.backup_freq not in {"daily", "weekly", "manual"}:
            return False, "备份频率无效"

        if self.log_level not in {"error", "warn", "info", "debug"}:
            return False, "日志级别无效"

        if self.ai_provider not in {"openai", "deepseek", "custom"}:
            return False, "AI 提供商无效"

        if self.week_start_day not in {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}:
            return False, "week_start_day is invalid"

        return True, ""
    def validate_field(self, field_name: str, value: any) -> tuple[bool, str]:
        """Validate a single setting field."""
        int_ranges = {
            "semester_weeks": (1, 52),
            "current_week": (1, self.semester_weeks),
            "acrylic_opacity": (0, 100),
            "notification_volume": (0, 100),
            "reminder_lead_minutes": (1, 120),
            "ambient_volume": (0, 100),
            "time_slot_height": (20, 200),
            "focus_duration": (1, 120),
            "pomodoro_break_duration": (1, 60),
            "week_goal_hours": (1, 168),
            "backup_retention_days": (1, 3650),
            "sections_per_day": (1, 20),
            "section_duration": (1, 240),
            "break_duration": (0, 120),
        }
        int_labels = {
            "semester_weeks": "学期周数",
            "current_week": "当前周数",
            "acrylic_opacity": "亚克力不透明度",
            "notification_volume": "通知音量",
            "reminder_lead_minutes": "提醒提前分钟数",
            "ambient_volume": "环境音音量",
            "time_slot_height": "时间段高度",
            "focus_duration": "专注时长",
            "pomodoro_break_duration": "番茄钟休息时长",
            "week_goal_hours": "每周目标学习时长",
            "backup_retention_days": "备份保留天数",
            "sections_per_day": "每日课程节数",
            "section_duration": "单节时长",
            "break_duration": "课间时长",
        }

        if field_name in int_ranges:
            lo, hi = int_ranges[field_name]
            if not isinstance(value, int) or isinstance(value, bool) or value < lo or value > hi:
                label = int_labels.get(field_name, field_name)
                return False, f"{label}必须是{lo}-{hi}之间的整数"
            return True, ""

        if field_name in {"course_opacity", "schedule_opacity"}:
            if not isinstance(value, (int, float)) or value < 0.0 or value > 1.0:
                label = "课程透明度" if field_name == "course_opacity" else "课程表透明度"
                return False, f"{label}必须在0到1之间"
            return True, ""

        bool_fields = {
            "show_non_current_week_courses",
            "show_course_white_border",
            "show_grid_lines",
            "show_time_indicator",
            "highlight_today",
            "show_teacher",
            "show_location",
            "show_weekends",
            "auto_save",
            "auto_color_import",
            "enable_course_grouping",
            "ui_animations",
            "enable_notifications",
            "dark_mode",
            "midnight_mode",
            "use24_hour_format",
            "enable_auto_backup",
            "enable_debug_mode",
            "weather_enabled",
            "shici_enabled",
            "ai_learning_enabled",
            "ai_task_parsing_enabled",
            "gpu_acceleration",
            "ui_transitions",
            "auto_start",
            "minimize_to_tray",
            "start_minimized",
            "enable_devtools",
            "show_python_console",
            "performance_overlay",
            "auto_play_noise",
        }
        if field_name in bool_fields:
            if not isinstance(value, bool):
                return False, f"{field_name}必须是布尔值"
            return True, ""

        enum_values = {
            "font_size": {"small", "medium", "large"},
            "conflict_mode": {"overlap", "stack"},
            "notification_sound": {"bell", "chime", "ding", "none", "digital", "bird", "rain"},
            "ambient_sound": {"rain", "ocean", "forest", "cafe", "white_noise", "none", "fire", "night"},
            "backup_freq": {"daily", "weekly", "manual"},
            "log_level": {"error", "warn", "info", "debug"},
            "ai_provider": {"openai", "deepseek", "custom"},
            "week_start_day": {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"},
        }
        enum_labels = {
            "font_size": "字体大小",
            "conflict_mode": "冲突显示模式",
            "notification_sound": "通知提示音",
            "ambient_sound": "环境音类型",
            "backup_freq": "备份频率",
            "log_level": "日志级别",
            "ai_provider": "AI 提供商",
            "week_start_day": "周起始日",
        }
        if field_name in enum_values:
            if value not in enum_values[field_name]:
                return False, f"{enum_labels.get(field_name, field_name)}无效"
            return True, ""

        if field_name == "start_date":
            if value:
                try:
                    datetime.strptime(value, "%Y-%m-%d")
                except ValueError:
                    return False, "学期开始日期格式必须为YYYY-MM-DD"
            return True, ""

        if field_name == "background_image":
            if value:
                import os
                if not os.path.isfile(value):
                    return False, f"background image does not exist: {value}"
            return True, ""

        if field_name in {"ai_base_url", "ai_task_base_url", "ai_learning_base_url"}:
            if value and (not isinstance(value, str) or not (value.startswith("http://") or value.startswith("https://"))):
                label_map = {
                    "ai_base_url": "AI API 基础地址",
                    "ai_task_base_url": "AI 任务 API 基础地址",
                    "ai_learning_base_url": "AI 学习 API 基础地址",
                }
                return False, f"{label_map.get(field_name, field_name)}必须以http://或https://开头"
            return True, ""

        if field_name in {"section_times"}:
            if not isinstance(value, list):
                return False, "section_times must be a list"
            return True, ""

        if field_name in {"time_presets"}:
            if not isinstance(value, list) or not value:
                return False, "time_presets must be a non-empty list"
            return True, ""

        if field_name == "active_time_preset_id":
            if not isinstance(value, str) or not value.strip():
                return False, "active_time_preset_id must be a non-empty string"
            return True, ""

        return True, ""
    def update_modified_time(self):
        """Update last modified timestamp."""
        self.last_modified = datetime.now().isoformat()
    
    def get_week_range(self) -> list[int]:
        """
        鑾峰彇瀛︽湡鍛ㄦ暟鑼冨洿鍒楄〃
        
        Returns:
            鍛ㄦ暟鍒楄〃 [1, 2, ..., semester_weeks]
        """
        return list(range(1, self.semester_weeks + 1))
    
    def is_week_valid(self, week: int) -> bool:
        """
        妫€鏌ュ懆鏁版槸鍚﹀湪鏈夋晥鑼冨洿鍐?
        
        Args:
            week: 瑕佹鏌ョ殑鍛ㄦ暟
            
        Returns:
            鏄惁鏈夋晥
        """
        return 1 <= week <= self.semester_weeks
    def get_display_name(self) -> str:
        """Get a human-readable settings summary."""
        start = self.start_date or "not set"
        return f"Semester settings ({self.semester_weeks} weeks, start: {start})"


