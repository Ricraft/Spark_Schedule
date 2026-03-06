"""
应用程序全局设置数据模型

定义应用程序的全局设置数据结构,包括外观、通知、数据管理、外部服务等
"""

from dataclasses import dataclass, asdict, field
from typing import Optional
from datetime import datetime
import base64


@dataclass
class AppSettings:
    """
    应用程序全局设置数据结构
    
    包含外观、通知、数据管理、启动行为、外部服务、AI引擎等全局设置
    """
    
    # ========== 外观与性能 ==========
    dark_mode: str = "light"                    # 深色模式: light, dark, auto
    gpu_acceleration: bool = True               # GPU硬件加速
    ui_transitions: bool = True                 # UI动画过渡效果
    midnight_mode: bool = False                 # 深邃夜色模式
    custom_background: str = ""                 # 自定义背景图片路径
    acrylic_opacity: float = 0.7                # 毛玻璃透明度 (0-1)
    
    # ========== 通知系统 ==========
    enable_notifications: bool = True           # 启用桌面通知
    notification_sound: bool = True             # 通知提示音
    notification_volume: int = 80               # 通知音量 (0-100)
    
    # ========== 数据与隐私 ==========
    auto_save: bool = True                      # 实时自动保存
    auto_backup: bool = True                    # 自动本地备份
    backup_frequency: str = "daily"             # 备份频率: daily, weekly, manual
    backup_retention_days: int = 30             # 备份保留天数
    
    # ========== 启动与行为 ==========
    auto_start: bool = False                    # 开机自启动
    minimize_to_tray: bool = True               # 最小化到系统托盘
    
    # ========== 外部服务 ==========
    # 和风天气
    weather_enabled: bool = False               # 启用天气服务
    weather_api_key: str = ""                   # 和风天气API密钥
    weather_location: str = ""                  # 天气位置
    
    # 今日诗词
    shici_enabled: bool = True                  # 启用诗词展示
    
    # ========== AI 引擎配置 ==========
    # AI 学习建议
    ai_learning_enabled: bool = False           # 启用AI学习建议
    ai_learning_provider: str = "openai"        # AI提供商: openai, deepseek, local
    ai_learning_api_key: str = ""               # AI API密钥
    ai_learning_endpoint: str = ""              # 自定义API端点
    ai_learning_model: str = "gpt-4o"           # 使用的模型
    
    # AI 任务解析
    ai_task_parsing_enabled: bool = False       # 启用AI任务解析
    ai_task_parsing_endpoint: str = ""          # 任务解析API端点
    ai_task_parsing_api_key: str = ""           # 任务解析API密钥
    
    # ========== 高级选项 ==========
    enable_devtools: bool = False               # 启用前端开发者工具
    show_python_console: bool = False           # 显示Python后端控制台
    performance_overlay: bool = False           # 性能监控叠加层
    debug_mode: bool = False                    # 调试模式
    log_level: str = "warn"                     # 日志级别: error, warn, info, debug
    
    # ========== 关于信息 ==========
    app_version: str = "2.4.0"                  # 应用版本
    
    # ========== 元数据 ==========
    version: str = "1.0"                        # 设置版本
    last_modified: Optional[str] = None         # 最后修改时间
    
    def __post_init__(self):
        """初始化后处理"""
        if self.last_modified is None:
            self.last_modified = datetime.now().isoformat()
    
    def to_dict(self) -> dict:
        """转换为字典"""
        data = asdict(self)
        # 对敏感信息进行加密
        if self.weather_api_key:
            data['weather_api_key'] = self._encode_key(self.weather_api_key)
        if self.ai_learning_api_key:
            data['ai_learning_api_key'] = self._encode_key(self.ai_learning_api_key)
        if self.ai_task_parsing_api_key:
            data['ai_task_parsing_api_key'] = self._encode_key(self.ai_task_parsing_api_key)
        return data
    
    @classmethod
    def from_dict(cls, data: dict) -> 'AppSettings':
        """从字典创建实例"""
        # 过滤掉不存在的字段
        valid_fields = {field.name for field in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        
        # 解密敏感信息
        if 'weather_api_key' in filtered_data and filtered_data['weather_api_key']:
            filtered_data['weather_api_key'] = cls._decode_key(filtered_data['weather_api_key'])
        if 'ai_learning_api_key' in filtered_data and filtered_data['ai_learning_api_key']:
            filtered_data['ai_learning_api_key'] = cls._decode_key(filtered_data['ai_learning_api_key'])
        if 'ai_task_parsing_api_key' in filtered_data and filtered_data['ai_task_parsing_api_key']:
            filtered_data['ai_task_parsing_api_key'] = cls._decode_key(filtered_data['ai_task_parsing_api_key'])
        
        return cls(**filtered_data)
    
    @staticmethod
    def _encode_key(key: str) -> str:
        """编码API密钥"""
        try:
            return base64.b64encode(key.encode()).decode()
        except:
            return key
    
    @staticmethod
    def _decode_key(encoded_key: str) -> str:
        """解码API密钥"""
        try:
            return base64.b64decode(encoded_key.encode()).decode()
        except:
            return encoded_key
    
    def validate(self) -> tuple[bool, str]:
        """
        验证设置的有效性
        
        Returns:
            (是否有效, 错误消息)
        """
        # 验证透明度
        if not (0.0 <= self.acrylic_opacity <= 1.0):
            return False, "毛玻璃透明度必须在0-1之间"
        
        # 验证音量
        if not (0 <= self.notification_volume <= 100):
            return False, "通知音量必须在0-100之间"
        
        # 验证备份保留天数
        if not isinstance(self.backup_retention_days, int) or self.backup_retention_days < 1:
            return False, "备份保留天数必须是正整数"
        
        # 验证深色模式选项
        if self.dark_mode not in ["light", "dark", "auto"]:
            return False, "深色模式必须是 light, dark 或 auto"
        
        # 验证备份频率
        if self.backup_frequency not in ["daily", "weekly", "manual"]:
            return False, "备份频率必须是 daily, weekly 或 manual"
        
        # 验证日志级别
        if self.log_level not in ["error", "warn", "info", "debug"]:
            return False, "日志级别必须是 error, warn, info 或 debug"
        
        # 验证AI提供商
        if self.ai_learning_provider not in ["openai", "deepseek", "local"]:
            return False, "AI提供商必须是 openai, deepseek 或 local"
        
        return True, ""
    
    def update_modified_time(self):
        """更新最后修改时间"""
        self.last_modified = datetime.now().isoformat()
    
    def get_display_name(self) -> str:
        """
        获取设置的显示名称
        
        Returns:
            设置描述字符串
        """
        return f"应用设置 v{self.app_version} (最后修改: {self.last_modified})"
    
    def mask_api_key(self, key: str) -> str:
        """
        屏蔽API密钥,只显示最后4个字符
        
        Args:
            key: 原始密钥
            
        Returns:
            屏蔽后的密钥
        """
        if not key or len(key) < 4:
            return "****"
        return "*" * (len(key) - 4) + key[-4:]
    
    def get_masked_keys(self) -> dict:
        """
        获取所有屏蔽后的API密钥
        
        Returns:
            屏蔽后的密钥字典
        """
        return {
            'weather_api_key': self.mask_api_key(self.weather_api_key),
            'ai_learning_api_key': self.mask_api_key(self.ai_learning_api_key),
            'ai_task_parsing_api_key': self.mask_api_key(self.ai_task_parsing_api_key)
        }
