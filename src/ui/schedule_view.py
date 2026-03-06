"""
课表视图组件 (Modern UI v2.3 - 修复版)
src/ui/schedule_view.py

修复内容：
1. 优化时间列可读性 - 增加背景不透明度和文字对比度
2. 保持原有功能不受影响
"""

from PyQt6.QtWidgets import (
    QTableWidget, QTableWidgetItem, QHeaderView, QAbstractItemView,
    QWidget, QLabel, QVBoxLayout, QStyledItemDelegate,
    QGraphicsDropShadowEffect
)
from PyQt6.QtCore import Qt, pyqtSignal, QRect, QEvent
from PyQt6.QtGui import QColor, QFont, QMovie, QPainter, QPixmap, QPen
from typing import List
from datetime import date, timedelta
from pathlib import Path as FilePath
import sys
from pathlib import Path

current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from src.models.course_base import CourseBase
from src.models.course_detail import CourseDetail
from src.models.time_slot import TimeSlot
from src.ui.overlay_scrollbar import OverlayScrollBar


class TimeColumnDelegate(QStyledItemDelegate):
    """时间列绘制代理 - 优化可读性"""
    
    def paint(self, painter, option, index):
        painter.save()
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        rect = option.rect
        
        # 绘制背景（增加不透明度以提高可读性）
        bg_color = QColor(255, 255, 255, 230)  # 90% 不透明度
        painter.fillRect(rect, bg_color)
        
        # 画底部分割线
        painter.setPen(QColor(200, 200, 200, 150))
        painter.drawLine(rect.bottomLeft(), rect.bottomRight())

        text = index.data()
        if text:
            parts = text.split('\n')

            if len(parts) >= 1:
                section_num = parts[0]
                font_sec = QFont("Microsoft YaHei", 18, QFont.Weight.Bold)
                painter.setFont(font_sec)
                # 使用更深的颜色确保在背景图上可见
                painter.setPen(QColor(30, 30, 30))
                sec_rect = QRect(rect.left(), rect.top() + 8, rect.width(), 32)
                painter.drawText(sec_rect, Qt.AlignmentFlag.AlignCenter, section_num)

            if len(parts) >= 3:
                start_time = parts[1]
                end_time = parts[2]
                font_time = QFont("Microsoft YaHei", 9)
                painter.setFont(font_time)
                # 使用更深的灰色确保可读性
                painter.setPen(QColor(80, 80, 80))

                t1_rect = QRect(rect.left(), rect.top() + 42, rect.width(), 16)
                painter.drawText(t1_rect, Qt.AlignmentFlag.AlignCenter, start_time)

                t2_rect = QRect(rect.left(), rect.top() + 58, rect.width(), 16)
                painter.drawText(t2_rect, Qt.AlignmentFlag.AlignCenter, end_time)

        painter.restore()


class CourseWidget(QWidget):
    clicked = pyqtSignal()

    def __init__(self, course_name, location, teacher, color, parent=None):
        super().__init__(parent)
        self.base_color = color
        self.is_hovered = False

        # 生成渐变色
        self.grad_color_start = color
        self.grad_color_end = self._adjust_color(color, 0.9) # 稍微暗一点

        self.setObjectName("CourseCard")
        self.setCursor(Qt.CursorShape.PointingHandCursor)

        main = QVBoxLayout(self)
        main.setContentsMargins(4, 4, 4, 4) # 增加外边距
        self.content = QWidget()
        self.content.setObjectName("CardContent")
        main.addWidget(self.content)

        layout = QVBoxLayout(self.content)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(4)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        r, g, b, a = color.red(), color.green(), color.blue(), color.alpha()
        is_dark = (0.299 * r + 0.587 * g + 0.114 * b) < 128
        tc = "white" if is_dark else "#1a1a1a"
        opacity_text = 0.95 if is_dark else 0.85

        self.lbl_n = QLabel(course_name)
        self.lbl_n.setFont(QFont("Microsoft YaHei", 10, QFont.Weight.Bold))
        self.lbl_n.setWordWrap(True)
        self.lbl_n.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.lbl_n.setStyleSheet(f"color: {tc};")

        self.lbl_t = None
        if teacher:
            self.lbl_t = QLabel(teacher)
            self.lbl_t.setFont(QFont("Microsoft YaHei", 8))
            self.lbl_t.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.lbl_t.setStyleSheet(f"color: {tc}; opacity: {opacity_text};")

        self.lbl_l = QLabel(f"@{location}" if location else "")
        self.lbl_l.setFont(QFont("Microsoft YaHei", 8, QFont.Weight.Bold))
        self.lbl_l.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.lbl_l.setStyleSheet(f"color: {tc}; opacity: {opacity_text};")

        layout.addStretch()
        layout.addWidget(self.lbl_n)
        if self.lbl_t: layout.addWidget(self.lbl_t)
        if location: layout.addWidget(self.lbl_l)
        layout.addStretch()

        # 阴影效果
        self.shadow = QGraphicsDropShadowEffect(self)
        self.shadow.setBlurRadius(12)
        self.shadow.setColor(QColor(0, 0, 0, 50))
        self.shadow.setOffset(0, 3)
        self.content.setGraphicsEffect(self.shadow)

        self._update_card_style()

    def _adjust_color(self, color, factor):
        return QColor(
            max(0, int(color.red() * factor)),
            max(0, int(color.green() * factor)),
            max(0, int(color.blue() * factor)),
            color.alpha()
        )

    def _update_card_style(self):
        r1, g1, b1, a1 = self.grad_color_start.red(), self.grad_color_start.green(), self.grad_color_start.blue(), self.grad_color_start.alpha()
        r2, g2, b2, a2 = self.grad_color_end.red(), self.grad_color_end.green(), self.grad_color_end.blue(), self.grad_color_end.alpha()
        
        # 悬浮时增加饱和度和亮度
        if self.is_hovered:
            border = "2px solid rgba(255, 255, 255, 150)"
            scale = 1.02
        else:
            border = "1px solid rgba(255, 255, 255, 80)"
            scale = 1.0

        bg_style = (
            f"background-color: qlineargradient(x1:0, y1:0, x2:1, y2:1, "
            f"stop:0 rgba({r1}, {g1}, {b1}, {a1}), "
            f"stop:1 rgba({r2}, {g2}, {b2}, {a2}));"
        )

        self.content.setStyleSheet(
            f"QWidget#CardContent {{ {bg_style} border-radius: 12px; border: {border}; }} "
            f"QLabel {{ background: transparent; border: none; font-family: 'Microsoft YaHei'; }}"
        )

    def enterEvent(self, event):
        self.is_hovered = True
        self._update_card_style()
        self.shadow.setBlurRadius(18)
        self.shadow.setOffset(0, 5)
        super().enterEvent(event)

    def leaveEvent(self, event):
        self.is_hovered = False
        self._update_card_style()
        self.shadow.setBlurRadius(12)
        self.shadow.setOffset(0, 3)
        super().leaveEvent(event)

    def mousePressEvent(self, e):
        super().mousePressEvent(e)
        self.clicked.emit()

    def update_opacity(self, opacity):
        new_alpha = int(255 * opacity)
        self.grad_color_start.setAlpha(new_alpha)
        self.grad_color_end.setAlpha(int(new_alpha * 0.9))
        self._update_card_style()


class ScheduleView(QTableWidget):
    course_clicked = pyqtSignal(object, object)
    empty_cell_clicked = pyqtSignal(int, int)

    def __init__(self, time_slots: List[TimeSlot], parent=None):
        super().__init__(len(time_slots), 8, parent)
        self.time_slots = time_slots
        self.current_week = 1
        self.semester_start_date = date.today()
        self.background_opacity = 1.0
        self.course_opacity = 0.95
        self.background_movie = None
        self.background_pixmap = None
        self.cell_courses = {}

        self._init_table_ui()
        self.cellClicked.connect(self._on_cell_clicked)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.overlay_scroll = OverlayScrollBar(self)

        # 背景绘制配置
        self.viewport().setAutoFillBackground(False)
        self.setFrameShape(QTableWidget.Shape.NoFrame)
        self.viewport().installEventFilter(self)
        self.horizontalHeader().setAutoFillBackground(False)
        self.horizontalHeader().installEventFilter(self)

    def _init_table_ui(self):
        headers = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        self.setHorizontalHeaderLabels(headers)
        self.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        self.setColumnWidth(0, 75)
        self.verticalHeader().setVisible(False)
        self.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
        self.setShowGrid(False)
        self.setFrameShape(QTableWidget.Shape.NoFrame)

        self.setItemDelegateForColumn(0, TimeColumnDelegate(self))
        self._refresh_time_column()
        for i in range(self.rowCount()): 
            self.setRowHeight(i, 80)
        
        # 设置默认透明样式
        self.set_header_style("transparent")

    def eventFilter(self, obj, event):
        """事件过滤器：在 viewport 和表头上绘制背景"""
        if event.type() == QEvent.Type.Paint:
            pixmap = None
            if self.background_movie:
                pixmap = self.background_movie.currentPixmap()
            elif self.background_pixmap:
                pixmap = self.background_pixmap
            
            if obj == self.viewport():
                painter = QPainter(self.viewport())
                if painter.isActive():
                    self._draw_background(painter, self.viewport().rect(), pixmap, 
                                         offset_y=0)
                    painter.end()
            
            elif obj == self.horizontalHeader():
                painter = QPainter(self.horizontalHeader())
                if painter.isActive():
                    header_rect = self.horizontalHeader().rect()
                    self._draw_background(painter, header_rect, pixmap, 
                                         offset_y=0, is_header=True)
                    painter.end()
        
        return super().eventFilter(obj, event)
    
    def _draw_background(self, painter, rect, pixmap, offset_y=0, is_header=False):
        """绘制背景图片"""
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        
        if pixmap and not pixmap.isNull():
            painter.setOpacity(self.background_opacity)
            
            header_height = self.horizontalHeader().height()
            total_height = self.viewport().height() + header_height
            total_width = self.viewport().width()
            
            from PyQt6.QtCore import QSize
            total_size = QSize(total_width, total_height)
            scaled = pixmap.scaled(
                total_size,
                Qt.AspectRatioMode.KeepAspectRatioByExpanding,
                Qt.TransformationMode.SmoothTransformation
            )
            
            x = (total_width - scaled.width()) // 2
            y = (total_height - scaled.height()) // 2
            
            if is_header:
                painter.drawPixmap(x, y, scaled)
            else:
                painter.drawPixmap(x, y - header_height, scaled)
        else:
            # 默认绘制白底
            painter.fillRect(rect, Qt.GlobalColor.white)

    def _refresh_time_column(self):
        """刷新时间列内容"""
        for i, time_slot in enumerate(self.time_slots):
            start_str = time_slot.start_time.strftime('%H:%M')
            end_str = time_slot.end_time.strftime('%H:%M')
            time_text = f"{time_slot.section_number}\n{start_str}\n{end_str}"
            item = QTableWidgetItem(time_text)
            item.setFlags(Qt.ItemFlag.ItemIsEnabled)
            self.setItem(i, 0, item)
    
    def _update_time_column_style(self, style_mode):
        """更新时间列样式以匹配表头"""
        if style_mode == "translucent":
            bg_color = QColor(255, 255, 255, 200)  # 提高不透明度
            fg_color = QColor("#2c3e50")
        elif style_mode == "transparent":
            bg_color = QColor(255, 255, 255, 230)  # 90% 不透明度
            fg_color = QColor("#1a1a1a")  # 更深的文字
        else:
            bg_color = QColor(248, 249, 250, 255)
            fg_color = QColor("#333333")
        
        # 更新所有时间列单元格
        for row in range(self.rowCount()):
            item = self.item(row, 0)
            if item:
                item.setBackground(bg_color)
                item.setForeground(fg_color)

    def update_courses(self, courses):
        self._clear_course_cells()
        self.cell_courses.clear()
        course_grid = {}

        for base, detail in courses:
            if not (detail.start_week <= self.current_week <= detail.end_week): 
                continue
            if not detail.week_type.matches_week(self.current_week): 
                continue

            day = detail.day_of_week
            for section in range(detail.start_section, detail.end_section + 1):
                key = (day, section)
                if key not in course_grid: 
                    course_grid[key] = []
                course_grid[key].append((base, detail))

        for (day, section), course_list in course_grid.items():
            row = self._get_row_for_section(section)
            if row is not None and course_list:
                base, detail = course_list[0]
                if section == detail.start_section:
                    self._set_course_cell(row, day, base, detail)

    def _get_row_for_section(self, section):
        for i, ts in enumerate(self.time_slots):
            if ts.section_number == section: 
                return i
        return None

    def _set_course_cell(self, row, col, base, detail):
        try:
            base_color = QColor(base.color)
        except:
            base_color = QColor("#E3F2FD")

        current_alpha = int(255 * self.course_opacity)
        final_color = QColor(
            base_color.red(), 
            base_color.green(), 
            base_color.blue(), 
            current_alpha
        )

        course_widget = CourseWidget(
            base.name, 
            detail.location, 
            detail.teacher, 
            final_color
        )
        course_widget.clicked.connect(
            lambda: self._on_course_widget_clicked(row, col)
        )

        self.setCellWidget(row, col, course_widget)
        if detail.step > 1: 
            self.setSpan(row, col, detail.step, 1)
        self.cell_courses[(row, col)] = (base, detail)

    def _on_course_widget_clicked(self, row, col):
        if (row, col) in self.cell_courses: 
            self.course_clicked.emit(*self.cell_courses[(row, col)])

    def _clear_course_cells(self):
        self.clearSpans()
        for row in range(self.rowCount()):
            for col in range(1, self.columnCount()): 
                self.removeCellWidget(row, col)
                self.setItem(row, col, QTableWidgetItem(""))

    def _on_cell_clicked(self, row, col):
        if col == 0: 
            return
        if not self.cellWidget(row, col):
            if row < len(self.time_slots): 
                self.empty_cell_clicked.emit(col, self.time_slots[row].section_number)

    def set_semester_start_date(self, start_date: date):
        self.semester_start_date = start_date
        self.update_header_dates()

    def update_header_dates(self):
        week_start = self.semester_start_date + timedelta(weeks=self.current_week - 1)
        current_month = date.today().month
        item_0 = QTableWidgetItem(f"{current_month}\n月")
        item_0.setFont(QFont("Microsoft YaHei", 12, QFont.Weight.Bold))
        item_0.setForeground(QColor("#2d8cf0"))
        self.setHorizontalHeaderItem(0, item_0)

        week_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        today = date.today()
        for i in range(7):
            current_date = week_start + timedelta(days=i)
            text = f"{week_names[i]}\n{current_date.strftime('%m/%d')}"
            item = QTableWidgetItem(text)
            font = QFont("Microsoft YaHei")
            font.setPixelSize(13)
            col_index = i + 1
            if current_date == today:
                font.setBold(True)
                font.setPixelSize(14)
                item.setForeground(QColor("#2d8cf0"))
            else:
                font.setBold(False)
                item.setForeground(QColor("#5f6368"))
            item.setFont(font)
            self.setHorizontalHeaderItem(col_index, item)

    def set_week(self, week):
        self.current_week = week
        self.update_header_dates()

    def set_background_opacity(self, opacity: float):
        self.background_opacity = opacity
        self.viewport().update()
        self.horizontalHeader().update()

    def set_course_opacity(self, opacity: float):
        self.course_opacity = opacity
        for row in range(self.rowCount()):
            for col in range(self.columnCount()):
                widget = self.cellWidget(row, col)
                if isinstance(widget, CourseWidget): 
                    widget.update_opacity(opacity)

    def set_background(self, image_path: str, opacity: float):
        self.background_opacity = opacity
        if self.background_movie: 
            self.background_movie.stop()
            self.background_movie = None
        
        if not image_path or not FilePath(image_path).exists():
            self.background_pixmap = None
        elif image_path.lower().endswith('.gif'):
            self.background_movie = QMovie(image_path)
            self.background_movie.frameChanged.connect(self.viewport().update)
            self.background_movie.frameChanged.connect(self.horizontalHeader().update)
            self.background_movie.start()
            self.background_pixmap = None
        else:
            self.background_pixmap = QPixmap(image_path)
        
        self.viewport().update()
        self.horizontalHeader().update()

    def update_time_slots(self, time_slots: List[TimeSlot]):
        self.time_slots = time_slots
        self.setRowCount(len(time_slots))
        for i in range(self.rowCount()): 
            self.setRowHeight(i, 80)
        self._refresh_time_column()
        self.viewport().update()

    def set_header_style(self, style_mode):
        """
        设置表头样式
        
        Args:
            style_mode: 样式模式
                - "translucent": 半透明毛玻璃效果
                - "transparent": 完全透明
                - 其他: 默认不透明样式
        """
        if style_mode == "translucent":
            bg_color = "rgba(255, 255, 255, 200)"  # 提高不透明度
            border_color = "rgba(0, 0, 0, 15)"
            text_color = "#2c3e50"
        elif style_mode == "transparent":
            bg_color = "rgba(255, 255, 255, 230)"  # 90% 不透明度
            border_color = "rgba(255, 255, 255, 100)"
            text_color = "#1a1a1a"  # 更深的文字
        else:
            bg_color = "rgba(248, 249, 250, 255)"
            border_color = "#E0E0E0"
            text_color = "#5f6368"

        style = f"""
            QHeaderView::section {{
                background-color: {bg_color};
                color: {text_color};
                border: none;
                border-bottom: 1px solid {border_color};
                border-right: 1px solid {border_color};
                padding: 6px;
                font-weight: bold;
            }}
            QTableCornerButton::section {{
                background-color: {bg_color};
                border: none;
                border-bottom: 1px solid {border_color};
                border-right: 1px solid {border_color};
            }}
        """
        self.horizontalHeader().setStyleSheet(style)
        
        # 更新角落按钮样式
        if self.findChild(QWidget):
            corner = self.findChild(QWidget)
            if corner: 
                corner.setStyleSheet(
                    f"background-color: {bg_color}; "
                    f"border-bottom: 1px solid {border_color};"
                )
        
        # 更新时间列样式以匹配表头
        self._update_time_column_style(style_mode)

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self.viewport().update()
        self.horizontalHeader().update()
        if hasattr(self, 'overlay_scroll'):
            self.overlay_scroll.update_position()
