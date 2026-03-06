"""
导入预览对话框 (UI 补充)
src/ui/import_preview_dialog.py
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLabel, QHeaderView
)
from PyQt6.QtCore import Qt
import uuid

# 引入模型以构造真实数据
from src.models.course_base import CourseBase
from src.models.course_detail import CourseDetail
from src.models.week_type import WeekType
from src.utils.color_manager import ColorManager
from src.ui.styles import ModernStyles

class ImportPreviewDialog(QDialog):
    def __init__(self, filename, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"导入预览 - {filename}")
        self.resize(800, 500)
        self.imported_courses = [] # 用于存储解析后的对象
        self._init_ui()
        self._generate_mock_data() # 模拟解析过程

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(15)
        layout.setContentsMargins(20, 20, 20, 20)

        header = QLabel("解析结果预览")
        header.setStyleSheet("font-size: 16px; font-weight: bold; color: #2c3e50;")
        layout.addWidget(header)

        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(["课程名称", "教师", "地点", "时间", "周次"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.table)

        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        btn_cancel = QPushButton("取消")
        btn_cancel.clicked.connect(self.reject)

        btn_import = QPushButton("确认导入")
        btn_import.clicked.connect(self.accept)
        btn_import.setStyleSheet(f"background: {ModernStyles.COLOR_ACCENT}; color: white; border-radius: 4px; padding: 6px 15px; font-weight: bold;")

        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_import)
        layout.addLayout(btn_layout)

    def _generate_mock_data(self):
        """模拟解析文件并生成 CourseBase/Detail 对象"""
        # 这里模拟从 HTML/Excel 解析出的原始数据
        raw_data = [
            ("高等数学", "张教授", "A-101", 1, 1, 2, 1, 16), # 周一 1-2节
            ("大学物理", "李教授", "B-205", 3, 3, 2, 1, 16), # 周三 3-4节
            ("Python程序设计", "王老师", "机房4", 5, 5, 2, 1, 12), # 周五 5-6节
        ]

        self.table.setRowCount(len(raw_data))

        for i, (name, teacher, loc, day, start, step, w_start, w_end) in enumerate(raw_data):
            # 1. 显示在表格上
            self.table.setItem(i, 0, QTableWidgetItem(name))
            self.table.setItem(i, 1, QTableWidgetItem(teacher))
            self.table.setItem(i, 2, QTableWidgetItem(loc))
            self.table.setItem(i, 3, QTableWidgetItem(f"周{day} {start}-{start+step-1}节"))
            self.table.setItem(i, 4, QTableWidgetItem(f"{w_start}-{w_end}周"))

            # 2. 构造真实对象
            c_id = str(uuid.uuid4())
            color = ColorManager.get_color_for_course(name)

            base = CourseBase(name=name, color=color, note="导入课程", course_id=c_id)
            detail = CourseDetail(
                course_id=c_id, teacher=teacher, location=loc,
                day_of_week=day, start_section=start, step=step,
                start_week=w_start, end_week=w_end, week_type=WeekType.EVERY_WEEK
            )
            self.imported_courses.append((base, detail))

    def get_imported_data(self):
        """返回主窗口需要的格式"""
        return self.imported_courses