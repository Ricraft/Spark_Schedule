"""
作息时间编辑对话框
src/ui/time_table_dialog.py
"""
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QHeaderView, QTimeEdit, QMessageBox, QLabel, QCheckBox, QSpinBox
)
from PyQt6.QtCore import Qt, QTime
from src.models.time_slot import TimeSlot


class TimeTableDialog(QDialog):
    def __init__(self, parent=None, time_slots=None):
        super().__init__(parent)
        self.setWindowTitle("编辑作息时间")
        self.resize(500, 700)
        self.time_slots = time_slots or []
        self.result_slots = []
        self._updating = False  # 防止递归更新

        self._init_ui()
        self._load_data()

    def _init_ui(self):
        layout = QVBoxLayout(self)

        # 说明
        lbl_hint = QLabel("请设置每一节课的开始和结束时间：")
        lbl_hint.setStyleSheet("color: #666; font-weight: bold; margin-bottom: 5px;")
        layout.addWidget(lbl_hint)

        # 智能调整选项
        options_layout = QHBoxLayout()
        self.chk_auto_adjust = QCheckBox("智能调整后续时间")
        self.chk_auto_adjust.setChecked(True)
        self.chk_auto_adjust.setToolTip("修改某节课时间后，自动调整后续课程时间")
        options_layout.addWidget(self.chk_auto_adjust)
        
        options_layout.addWidget(QLabel("课间休息:"))
        self.spin_break_time = QSpinBox()
        self.spin_break_time.setRange(0, 60)
        self.spin_break_time.setValue(10)
        self.spin_break_time.setSuffix(" 分钟")
        self.spin_break_time.setToolTip("每节课之间的休息时间")
        options_layout.addWidget(self.spin_break_time)
        options_layout.addStretch()
        layout.addLayout(options_layout)

        # 表格
        self.table = QTableWidget()
        self.table.setColumnCount(3)
        self.table.setHorizontalHeaderLabels(["节次", "开始时间", "结束时间"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionMode(QTableWidget.SelectionMode.NoSelection)
        layout.addWidget(self.table)

        # 按钮
        btn_layout = QHBoxLayout()
        btn_reset = QPushButton("↺ 恢复默认")
        btn_reset.clicked.connect(self._reset_default)

        btn_cancel = QPushButton("取消")
        btn_cancel.clicked.connect(self.reject)

        btn_save = QPushButton("保存")
        btn_save.setStyleSheet("background-color: #2d8cf0; color: white; font-weight: bold;")
        btn_save.clicked.connect(self._save_data)

        btn_layout.addWidget(btn_reset)
        btn_layout.addStretch()
        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_save)
        layout.addLayout(btn_layout)

    def _load_data(self):
        self.table.setRowCount(len(self.time_slots))

        for i, slot in enumerate(self.time_slots):
            # 节次 (只读)
            item_idx = QTableWidgetItem(f"第 {slot.section_number} 节")
            item_idx.setFlags(Qt.ItemFlag.ItemIsEnabled)
            item_idx.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.table.setItem(i, 0, item_idx)

            # 开始时间
            t_start = QTimeEdit()
            t_start.setDisplayFormat("HH:mm")
            t_start.setTime(QTime(slot.start_time.hour, slot.start_time.minute))
            t_start.timeChanged.connect(lambda time, row=i: self._on_start_time_changed(row, time))
            self.table.setCellWidget(i, 1, t_start)

            # 结束时间
            t_end = QTimeEdit()
            t_end.setDisplayFormat("HH:mm")
            t_end.setTime(QTime(slot.end_time.hour, slot.end_time.minute))
            t_end.timeChanged.connect(lambda time, row=i: self._on_end_time_changed(row, time))
            self.table.setCellWidget(i, 2, t_end)
    
    def _on_start_time_changed(self, row, new_time):
        """开始时间改变时的处理"""
        if self._updating or not self.chk_auto_adjust.isChecked():
            return
        
        self._updating = True
        try:
            # 获取当前行的结束时间
            end_widget = self.table.cellWidget(row, 2)
            if end_widget:
                end_time = end_widget.time()
                
                # 如果开始时间晚于结束时间，自动调整结束时间
                if new_time >= end_time:
                    # 保持课程时长为45分钟
                    new_end_time = new_time.addSecs(45 * 60)
                    end_widget.setTime(new_end_time)
                    
                    # 调整后续课程
                    self._adjust_following_courses(row, new_end_time)
        finally:
            self._updating = False
    
    def _on_end_time_changed(self, row, new_time):
        """结束时间改变时的处理"""
        if self._updating or not self.chk_auto_adjust.isChecked():
            return
        
        self._updating = True
        try:
            # 调整后续课程
            self._adjust_following_courses(row, new_time)
        finally:
            self._updating = False
    
    def _adjust_following_courses(self, from_row, last_end_time):
        """调整后续课程的时间"""
        break_minutes = self.spin_break_time.value()
        
        # 从下一行开始调整
        for i in range(from_row + 1, self.table.rowCount()):
            start_widget = self.table.cellWidget(i, 1)
            end_widget = self.table.cellWidget(i, 2)
            
            if start_widget and end_widget:
                # 计算新的开始时间（上一节结束时间 + 课间休息）
                new_start = last_end_time.addSecs(break_minutes * 60)
                
                # 获取当前课程时长
                old_start = start_widget.time()
                old_end = end_widget.time()
                duration_secs = old_start.secsTo(old_end)
                
                # 设置新的开始和结束时间
                start_widget.setTime(new_start)
                new_end = new_start.addSecs(duration_secs)
                end_widget.setTime(new_end)
                
                # 更新 last_end_time 为当前行的结束时间
                last_end_time = new_end

    def _reset_default(self):
        # 恢复简单的默认逻辑 (8:00开始, 45分钟一节, 课间10分钟)
        current = QTime(8, 0)
        for i in range(self.table.rowCount()):
            start_widget = self.table.cellWidget(i, 1)
            end_widget = self.table.cellWidget(i, 2)

            start_widget.setTime(current)
            end_time = current.addSecs(45 * 60)
            end_widget.setTime(end_time)

            # 准备下一节 (加10分钟)
            current = end_time.addSecs(10 * 60)

    def _save_data(self):
        new_slots = []
        for i in range(self.table.rowCount()):
            sec_num = i + 1
            t_start = self.table.cellWidget(i, 1).time().toPyTime()
            t_end = self.table.cellWidget(i, 2).time().toPyTime()

            if t_start >= t_end:
                QMessageBox.warning(self, "时间错误", f"第 {sec_num} 节的结束时间必须晚于开始时间")
                return

            new_slots.append(TimeSlot(sec_num, t_start, t_end))

        self.result_slots = new_slots
        self.accept()

    def get_data(self):
        return self.result_slots