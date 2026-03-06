"""
南华大学教务系统导入器

针对南华大学强智教务系统 (jsxsd) 的专用解析器
继承自 QiangZhiImporter，仅配置南华大学特有参数
"""

try:
    from .qiangzhi_importer import QiangZhiImporter
except ImportError:
    from importers.qiangzhi_importer import QiangZhiImporter


class USCImporter(QiangZhiImporter):
    """
    南华大学教务系统导入器
    
    解析南华大学强智教务系统导出的 HTML 课表文件
    支持多周次范围、多课程共存等复杂场景
    """

    # usc_importer.py
    def __init__(self):
        super().__init__(
            school_name="南华大学",
            sunday_first=True,  # 1. 南华 HTML 第一列确实是周日
            first_col_is_header=False,  # 2. 关键！强制跳过第一个 td（节次列）
            split_pattern=r'-{10,}',
            table_id='kbtable',             # 标准强智系统表格 ID
            cell_class='kbcontent',         # 标准强智系统单元格 class
            week_pattern=r'([\d\-,]+)\(周\)',  # 标准周次格式
            section_pattern=r'\[(\d+)-(\d+)节\]',  # 标准节次格式
            teacher_title='老师',           # 标准教师字段
            location_title='教室',          # 标准教室字段
            week_section_title='周次(节次)',  # 标准周次节次字段
            odd_week_keyword='单周',        # 标准单周关键字
            even_week_keyword='双周',       # 标准双周关键字
            exclude_courses=["教学资料", "", "&nbsp;"]  # 排除 HTML 空格
        )
    
    def get_importer_name(self) -> str:
        """获取导入器名称"""
        return "南华大学教务系统"
