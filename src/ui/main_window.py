"""
主窗口 (Modern UI v2.3 - 修复版)
src/ui/main_window.py

修复内容：
1. 修复工具栏按钮样式
2. 修复下拉菜单显示问题
3. 优化整体布局
"""
from src.models.config import Config
import sys
from pathlib import Path
from datetime import datetime, date, timedelta
import json
import os
from src.ui.settings_dialog import SettingsDialog

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QToolBar,
    QSizePolicy, QFileDialog, QMessageBox, QMenu, QToolButton, QLabel,
    QSystemTrayIcon, QApplication
)
from PyQt6.QtGui import QAction, QIcon
from PyQt6.QtCore import Qt, QSize, QDate, QTimer

# 导入自定义模块
current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent.parent
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

from src.ui.schedule_view import ScheduleView
from src.ui.course_dialog import CourseDialog
from src.ui.styles import ModernStyles
from src.models.time_slot import TimeSlot
from src.models.config import Config
from src.ui.webview_import_dialog import WebviewImportDialog
from src.ui.import_preview_dialog import ImportPreviewDialog
# 这里的 StorageManager 会在上面的 try-except 块中正确导入

# 尝试导入导入器，防止文件缺失导致 crash
try:
    # 调整路径以包含 backend
    backend_dir = project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    from backend.importers.html_importer import HTMLImporter
    from backend.importers.excel_importer import ExcelImporter
    from backend.importers.text_importer import TextImporter
    from backend.core.storage_manager import StorageManager
except ImportError as e:
    print(f"Warning: Importer modules missing: {e}")
    import traceback
    traceback.print_exc()

import ctypes
from ctypes import wintypes

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("WakeUp 课表 - Modern UI v3.0")
        self.resize(1200, 850)
        
        # 设置应用图标
        self._set_app_icon()

        self.config = Config.load()
        self.storage = StorageManager()

        # 生成时间轴
        self.time_slots = self._generate_time_slots()

        self.courses = []

        self._init_ui()
        self._apply_mica_effect()
        self._init_tray_icon()
        self._init_reminder_timer()

        self.load_saved_data()
        self._setup_connections()
        self._init_semester_week()

        # 启动时自动加载本地数据
        self._load_data_on_startup()

        # 应用表头风格
        self.schedule_view.set_header_style(self.config.header_style)

        # 应用全局样式
        self.setStyleSheet(ModernStyles.GLOBAL + ModernStyles.TOOLBAR)

    def _generate_time_slots(self):
        """根据 Config 生成时间轴 (优先读取自定义时间)"""
        # 1. 尝试读取自定义时间
        if self.config.custom_time_slots:
            slots = []
            try:
                for item in self.config.custom_time_slots:
                    if item["section"] > self.config.total_courses_per_day: continue
                    s = datetime.strptime(item["start"], "%H:%M").time()
                    e = datetime.strptime(item["end"], "%H:%M").time()
                    slots.append(TimeSlot(item["section"], s, e))

                # 补全不足的节数
                if len(slots) < self.config.total_courses_per_day:
                    last_end = datetime.combine(date.today(), slots[-1].end_time)
                    start_idx = len(slots) + 1
                    current_dt = last_end + timedelta(minutes=10)
                    for i in range(start_idx, self.config.total_courses_per_day + 1):
                        end_dt = current_dt + timedelta(minutes=45)
                        slots.append(TimeSlot(i, current_dt.time(), end_dt.time()))
                        current_dt = end_dt + timedelta(minutes=10)
                return slots
            except Exception as e:
                print(f"自定义时间解析失败，回退默认: {e}")

        # 2. 默认生成逻辑
        slots = []
        total = self.config.total_courses_per_day
        current_dt = datetime.combine(date.today(), datetime.strptime("08:00", "%H:%M").time())
        for i in range(1, total + 1):
            end_dt = current_dt + timedelta(minutes=45)
            slots.append(TimeSlot(i, current_dt.time(), end_dt.time()))
            break_time = 120 if i == 4 else (30 if i == 8 else 10)
            current_dt = end_dt + timedelta(minutes=break_time)
        return slots

    def _init_tray_icon(self):
        self.tray_icon = QSystemTrayIcon(self)
        # 使用托盘专用图标，如果没有则使用系统默认图标
        if self.tray_app_icon:
            self.tray_icon.setIcon(self.tray_app_icon)
        else:
            self.tray_icon.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_ComputerIcon))
        tray_menu = QMenu()
        action_show = QAction("显示主界面", self)
        action_show.triggered.connect(self.showNormal)
        action_quit = QAction("退出程序", self)
        action_quit.triggered.connect(QApplication.instance().quit)
        tray_menu.addAction(action_show); tray_menu.addSeparator(); tray_menu.addAction(action_quit)
        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.activated.connect(self._on_tray_activated)
        if self.config.minimize_to_tray: self.tray_icon.show()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.Trigger:
            if self.isHidden(): self.showNormal(); self.activateWindow()
            else: self.hide()

    def _set_app_icon(self):
        """设置应用图标（窗口图标和托盘图标分开）"""
        resources_dir = Path(__file__).parent.parent.parent / "resources"
        
        # 1. 软件图标 (窗口标题栏) - icon.png 或 icon.ico
        app_icon_path = resources_dir / "icon.png"
        if not app_icon_path.exists():
            app_icon_path = resources_dir / "icon.ico"
        
        if app_icon_path.exists():
            self.app_icon = QIcon(str(app_icon_path))
            self.setWindowIcon(self.app_icon)
        else:
            self.app_icon = None
        
        # 2. 托盘图标 - tray_icon.png 或 tray_icon.ico
        tray_icon_path = resources_dir / "tray_icon.png"
        if not tray_icon_path.exists():
            tray_icon_path = resources_dir / "tray_icon.ico"
        
        if tray_icon_path.exists():
            self.tray_app_icon = QIcon(str(tray_icon_path))
        else:
            # 如果没有专门的托盘图标，使用软件图标
            self.tray_app_icon = self.app_icon

    def _init_reminder_timer(self):
        self.reminder_timer = QTimer(self)
        self.reminder_timer.timeout.connect(self._check_course_reminders)
        self.reminder_timer.start(60000)

    def _check_course_reminders(self):
        if not self.config.enable_notification: return
        now = datetime.now()
        current_weekday = now.isoweekday()
        todays_courses = []
        for base, detail in self.courses:
            if detail.day_of_week == current_weekday:
                if detail.start_week <= self.schedule_view.current_week <= detail.end_week:
                    if detail.week_type.matches_week(self.schedule_view.current_week):
                        todays_courses.append((base, detail))

        remind_min = self.config.remind_minutes
        for base, detail in todays_courses:
            idx = detail.start_section - 1
            if 0 <= idx < len(self.time_slots):
                start_t = self.time_slots[idx].start_time
                course_dt = datetime.combine(date.today(), start_t)
                diff = (course_dt - now).total_seconds() / 60
                if abs(diff - remind_min) < 1.0:
                    self._show_notification(f"课程提醒: {base.name}", f"还有 {remind_min} 分钟上课\n地点: {detail.location}")

    def _show_notification(self, title, msg):
        if self.tray_icon.isVisible():
            self.tray_icon.showMessage(title, msg, QSystemTrayIcon.MessageIcon.Information, 3000)

    def closeEvent(self, event):
        self._action_save()
        if self.config.exit_on_close: event.accept()
        else:
            if self.tray_icon.isVisible():
                self.hide()
                self.tray_icon.showMessage("WakeUp 课表", "程序已最小化到托盘", QSystemTrayIcon.MessageIcon.Information, 2000)
                event.ignore()
            else: event.accept()

    def _init_ui(self):
        self.setWindowTitle("WakeUp 课程表")
        self.resize(1200, 800)
        self._init_toolbar()
        self._init_central_widget()

    def _init_toolbar(self):
        self.toolbar = QToolBar()
        self.toolbar.setMovable(False)
        self.toolbar.setIconSize(QSize(20, 20))
        self.toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        self.addToolBar(self.toolbar)

        self.action_add = QAction("添加课程", self)
        self.toolbar.addAction(self.action_add)

        # --- 导入菜单 ---
        self.import_btn = QToolButton()
        self.import_btn.setText("课程导入")
        self.import_btn.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        self.import_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        
        btn_style = """
            QToolButton { 
                padding: 8px 16px; 
                font-weight: bold; 
                color: #1a1a1a; 
                border: 1px solid rgba(0,0,0,0.1); 
                border-radius: 8px;
                background: rgba(255,255,255,0.6);
            } 
            QToolButton:hover { 
                background-color: rgba(0,120,212,0.1); 
                border-color: #0078d4;
            }
        """
        self.import_btn.setStyleSheet(btn_style)

        import_menu = QMenu(self)
        
        action_webview = QAction("🌐 从教务系统自动导入", self)
        action_webview.triggered.connect(self._on_import_webview)
        import_menu.addAction(action_webview)
        
        import_menu.addSeparator()

        action_excel = QAction("📊 Excel 文件导入 (.xls/.xlsx)", self)
        action_excel.triggered.connect(lambda: self._on_import_file("Excel"))
        import_menu.addAction(action_excel)

        action_html = QAction("📄 HTML 网页文件导入", self)
        action_html.triggered.connect(lambda: self._on_import_file("HTML"))
        import_menu.addAction(action_html)

        action_json = QAction("📦 JSON 数据导入", self)
        action_json.triggered.connect(self._on_import_json)
        import_menu.addAction(action_json)

        self.import_btn.setMenu(import_menu)
        self.toolbar.addWidget(self.import_btn)

        # --- 文件菜单 ---
        self.file_btn = QToolButton()
        self.file_btn.setText("文件")
        self.file_btn.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        self.file_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        self.file_btn.setStyleSheet(btn_style)

        file_menu = QMenu(self)
        action_new = QAction("新建课表", self)
        action_new.triggered.connect(self._action_new)
        file_menu.addAction(action_new)
        
        action_save = QAction("保存课表", self)
        action_save.triggered.connect(self._action_save)
        file_menu.addAction(action_save)
        
        file_menu.addSeparator()
        
        action_export_json = QAction("导出为 JSON 备份", self)
        action_export_json.triggered.connect(self._on_export_json)
        file_menu.addAction(action_export_json)

        self.file_btn.setMenu(file_menu)
        self.toolbar.addWidget(self.file_btn)

        self.toolbar.addSeparator()
        self.action_refresh = QAction("刷新", self)
        self.toolbar.addAction(self.action_refresh)
        
        self.toolbar.addSeparator()
        self.action_prev_week = QAction("上一周", self)
        self.toolbar.addAction(self.action_prev_week)
        self.action_current_week = QAction("第 1 周", self)
        self.toolbar.addAction(self.action_current_week)
        self.action_next_week = QAction("下一周", self)
        self.toolbar.addAction(self.action_next_week)

        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.toolbar.addWidget(spacer)

        self.action_appearance = QAction("外观", self)
        self.toolbar.addAction(self.action_appearance)
        
        self.action_settings = QAction("设置", self)
        self.toolbar.addAction(self.action_settings)

    def _on_import_json(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "选择 JSON 备份文件", "", "JSON Files (*.json)")
        if not file_path: return
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # 这里简单复用 load_saved_data 的逻辑思路，但从指定文件读取
            # 为了安全，先询问
            reply = QMessageBox.question(self, "导入确认", "导入将覆盖当前课表，确定吗？", 
                                         QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
            if reply == QMessageBox.StandardButton.No: return
            
            # 执行导入逻辑...
            # 这里我们通过临时修改 storage 的路径或者直接解析
            self.courses = self._parse_json_data(data)
            self.schedule_view.update_courses(self.courses)
            self._action_save()
            QMessageBox.information(self, "成功", "JSON 数据已导入")
        except Exception as e:
            QMessageBox.critical(self, "失败", f"无效的 JSON 文件: {e}")

    def _on_export_json(self):
        file_path, _ = QFileDialog.getSaveFileName(self, "导出 JSON 备份", "schedule_backup.json", "JSON Files (*.json)")
        if not file_path: return
        try:
            # 构造导出数据
            bases = [c[0] for c in self.courses]
            details = [c[1] for c in self.courses]
            # 这里直接复用 storage 的构造逻辑
            export_data = {
                "version": "3.0",
                "export_time": str(date.today()),
                "courses": []
            }
            for base, detail in self.courses:
                export_data["courses"].append({
                    "name": base.name, "id": base.id, "color": base.color,
                    "teacher": detail.teacher, "location": detail.location,
                    "day": detail.day_of_week, "start": detail.start_section, "step": detail.step,
                    "weeks": f"{detail.start_week}-{detail.end_week}",
                    "type": detail.week_type.value
                })
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(export_data, f, ensure_ascii=False, indent=4)
            QMessageBox.information(self, "成功", f"课表已导出至: {file_path}")
        except Exception as e:
            QMessageBox.critical(self, "失败", f"导出失败: {e}")

    def _action_save(self):
        if not hasattr(self, 'courses'): return
        bases = [c[0] for c in self.courses]
        details = [c[1] for c in self.courses]
        success = self.storage.save(bases, details, self.schedule_view.current_week)
        if success:
            self.statusBar().showMessage("课表已自动保存", 2000)
        else:
            self.statusBar().showMessage("⚠️ 保存失败", 3000)

    def _parse_json_data(self, data):
        """通用解析 JSON 数据并返回课程列表"""
        from src.models.course_base import CourseBase
        from src.models.course_detail import CourseDetail
        from src.models.week_type import WeekType
        from PyQt6.QtGui import QColor
        
        parsed = []
        # 支持多种 JSON 格式（旧版和新版）
        courses_data = data.get("courses", [])
        if not courses_data and "details" in data:
            # 这种是 StorageManager 的格式
            base_map = {b["course_id"]: b for b in data.get("bases", [])}
            for d in data["details"]:
                b = base_map.get(d["course_id"])
                if b:
                    base = CourseBase(course_id=b["course_id"], name=b["name"], color=b["color"])
                    w_type = WeekType(d["week_type"])
                    detail = CourseDetail(
                        course_id=d["course_id"], teacher=d["teacher"], location=d["location"],
                        day_of_week=d["day_of_week"], start_section=d["start_section"],
                        step=d["step"], start_week=d["start_week"], end_week=d["end_week"],
                        week_type=w_type
                    )
                    parsed.append((base, detail))
            return parsed

        for c in courses_data:
            base = CourseBase(course_id=c.get("id", str(uuid.uuid4())), name=c["name"], color=c.get("color", "#3498db"))
            weeks = str(c.get("weeks", "1-18")).split('-')
            start_w = int(weeks[0]); end_w = int(weeks[1]) if len(weeks) > 1 else start_w
            w_type = WeekType(c.get("type", "every"))
            detail = CourseDetail(
                course_id=base.id, teacher=c.get("teacher", ""), location=c.get("location", ""),
                day_of_week=c.get("day", 1), start_section=c.get("start", 1),
                step=c.get("step", 2), start_week=start_w, end_week=end_w, week_type=w_type
            )
            parsed.append((base, detail))
        return parsed

    def _apply_mica_effect(self):
        """为 Windows 11 应用 Mica/Acrylic 效果"""
        if sys.platform != "win32":
            return

        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # 获取窗口句柄
        hWnd = self.winId()
        if not hWnd:
            return
            
        hWnd = int(hWnd)
        
        try:
            # DWMWA_SYSTEMBACKDROP_TYPE = 38
            # 2 = Mica, 3 = Acrylic, 4 = Mica Alt
            DWMWA_SYSTEMBACKDROP_TYPE = 38
            backdrop_type = ctypes.c_int(3 if self.config.header_style == "translucent" else 2)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hWnd, DWMWA_SYSTEMBACKDROP_TYPE, ctypes.byref(backdrop_type), ctypes.sizeof(backdrop_type)
            )
            
            # DWMWA_USE_IMMERSIVE_DARK_MODE = 20
            dark_mode = ctypes.c_int(0) 
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hWnd, 20, ctypes.byref(dark_mode), ctypes.sizeof(dark_mode)
            )
        except Exception as e:
            print(f"应用 Mica 效果失败: {e}")

    def _init_central_widget(self):
        central_widget = QWidget()
        # 设置中心组件背景为透明，以便材质透出
        central_widget.setAutoFillBackground(False)
        central_widget.setStyleSheet("background: transparent;")
        
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.schedule_view = ScheduleView(self.time_slots)
        layout.addWidget(self.schedule_view)
        self.setCentralWidget(central_widget)

    def _setup_connections(self):
        self.action_add.triggered.connect(lambda: self._on_add_course())
        self.action_refresh.triggered.connect(self._on_refresh)
        self.action_prev_week.triggered.connect(lambda: self._change_week(-1))
        self.action_next_week.triggered.connect(lambda: self._change_week(1))
        self.action_current_week.triggered.connect(self._reset_to_current_week)
        self.action_appearance.triggered.connect(self.open_appearance_settings)
        self.action_settings.triggered.connect(self._on_open_settings)
        self.schedule_view.course_clicked.connect(self._on_edit_course)
        self.schedule_view.empty_cell_clicked.connect(self._on_empty_cell_clicked)

    def _init_semester_week(self):
        try:
            start_str = self.config.semester_start_date
            start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
            today = date.today()
            calculated_week = ((today - start_date).days // 7) + 1
            if calculated_week < 1: calculated_week = 1
            self.schedule_view.set_semester_start_date(start_date)
            self.schedule_view.set_week(calculated_week)
            self.action_current_week.setText(f"第 {calculated_week} 周 (当前)")
        except:
            self.schedule_view.set_week(1)

    def _reset_to_current_week(self):
        self.config = Config.load()
        self._init_semester_week()
        self.schedule_view.update_courses(self.courses)

    def _on_refresh(self):
        self.schedule_view.update_courses(self.courses)
        self.schedule_view.viewport().update()
        self.statusBar().showMessage("课表已刷新", 2000)

    def _load_data_on_startup(self):
        bases, details, week = self.storage.load()
        if bases and details:
            self.courses = self._process_imported_data(bases, details)
            self.schedule_view.set_week(week)
            self.action_current_week.setText(f"第 {week} 周 (当前)")
            self.schedule_view.update_courses(self.courses)
            self.statusBar().showMessage(f"已加载本地课表，共 {len(self.courses)} 个课程块", 3000)

    def open_appearance_settings(self):
        self._on_open_settings()

    def _on_open_settings(self):
        from src.ui.settings_dialog import SettingsDialog
        current_bg = getattr(self, 'current_bg_path', "")
        bg_op = self.schedule_view.background_opacity
        card_op = self.schedule_view.course_opacity
        dlg = SettingsDialog(self, self.config, current_bg, bg_op, card_op)
        dlg.bg_opacity_changed.connect(self.schedule_view.set_background_opacity)
        dlg.card_opacity_changed.connect(self.schedule_view.set_course_opacity)
        dlg.background_changed.connect(self.update_background)
        dlg.header_style_changed.connect(self.schedule_view.set_header_style)
        dlg.config_updated.connect(self._on_config_updated)
        dlg.exec()

    def _on_config_updated(self):
        if self.config.minimize_to_tray: self.tray_icon.show()
        else: self.tray_icon.hide()

        new_slots = self._generate_time_slots()
        self.time_slots = new_slots
        self.schedule_view.update_time_slots(new_slots)
        self._init_semester_week()
        self.schedule_view.update_courses(self.courses)

    def update_background(self, path):
        self.current_bg_path = path
        if not path:
            self.schedule_view.background_pixmap = None
            self.schedule_view.background_movie = None
            self.schedule_view.viewport().update()
        else:
            self.schedule_view.set_background(path, self.schedule_view.background_opacity)

    def _action_save(self):
        data_to_save = {
            "version": "2.0",
            "bg_path": getattr(self, 'current_bg_path', ""),
            "bg_opacity": self.schedule_view.background_opacity,
            "card_opacity": self.schedule_view.course_opacity,
            "courses": []
        }
        if hasattr(self, 'courses'):
            for base, detail in self.courses:
                color_str = base.color
                if hasattr(color_str, 'name'): color_str = color_str.name()
                course_dict = {
                    "id": base.id,
                    "name": base.name,
                    "teacher": detail.teacher,
                    "location": detail.location,
                    "day": detail.day_of_week,
                    "start": detail.start_section,
                    "step": detail.step,
                    "weeks": f"{detail.start_week}-{detail.end_week}",
                    "type": getattr(detail.week_type, 'value', 0),
                    "color": color_str,
                    "note": getattr(base, 'note', "")
                }
                data_to_save["courses"].append(course_dict)
        try:
            file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../schedule_data.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data_to_save, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"保存失败: {e}")

    def load_saved_data(self):
        """从 StorageManager 加载本地数据"""
        try:
            bases, details, week = self.storage.load()
            if bases and details:
                # 转换为 (base, detail) 列表
                self.courses = self._process_imported_data(bases, details)
                self.schedule_view.set_week(week)
                self.action_current_week.setText(f"第 {week} 周")
                self.schedule_view.update_courses(self.courses)
                self.statusBar().showMessage(f"已加载本地课表，共 {len(self.courses)} 个课程块", 3000)
        except Exception as e:
            print(f"从存储加载失败: {e}")
            import traceback
            traceback.print_exc()

    def _action_new(self):
        reply = QMessageBox.question(self, "新建确认", "确定要新建课表吗？", QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if reply == QMessageBox.StandardButton.Yes:
            self.courses = []; self.schedule_view.update_courses([]); self._action_save(); self.statusBar().showMessage("已新建空课表", 2000)

    def _on_import_webview(self):
        dialog = WebviewImportDialog(self)
        if dialog.exec():
            bases, details = dialog.get_imported_data()
            new_courses = self._process_imported_data(bases, details)
            if new_courses:
                self.courses.extend(new_courses)
                self.schedule_view.update_courses(self.courses)
                self._action_save()
                QMessageBox.information(self, "导入成功", f"成功导入 {len(new_courses)} 门课程")

    def _on_import_file(self, file_type):
        filters = {
            "HTML": "HTML Files (*.html *.htm)",
            "Excel": "Excel Files (*.xlsx *.xls)",
            "Text": "Text Files (*.txt)"
        }
        file_path, _ = QFileDialog.getOpenFileName(self, f"选择 {file_type} 文件", "", filters.get(file_type, ""))
        if not file_path: return

        try:
            bases, details = [], []
            if file_type == "Excel":
                importer = ExcelImporter()
                bases, details = importer.parse(file_path)
            elif file_type == "HTML":
                with open(file_path, 'r', encoding='utf-8') as f: content = f.read()
                importer = HTMLImporter()
                bases, details = importer.parse(content)
            elif file_type == "Text":
                with open(file_path, 'r', encoding='utf-8') as f: content = f.read()
                importer = TextImporter()
                bases, details = importer.parse(content)

            new_courses = self._process_imported_data(bases, details)
            if not new_courses:
                QMessageBox.warning(self, "提示", "未解析到有效课程")
                return

            self.courses.extend(new_courses)
            self.schedule_view.update_courses(self.courses)
            self._action_save()
            QMessageBox.information(self, "成功", f"成功导入 {len(new_courses)} 个课程节点")

        except Exception as e:
            QMessageBox.critical(self, "导入失败", f"错误详情:\n{str(e)}")
            import traceback
            traceback.print_exc()

    def _process_imported_data(self, bases, details):
        if not bases or not details: return []
        combined = []
        base_map = {b.course_id: b for b in bases}
        for d in details:
            if d.course_id in base_map: combined.append((base_map[d.course_id], d))
        return combined

    def _change_week(self, delta):
        new_week = self.schedule_view.current_week + delta
        if new_week < 1: new_week = 1
        self.schedule_view.set_week(new_week)
        self.action_current_week.setText(f"第 {new_week} 周")
        self.schedule_view.update_courses(self.courses)

    def _on_add_course(self, day=1, section=1):
        dialog = CourseDialog(self)
        dialog.day_combo.setCurrentIndex(day - 1)
        dialog.start_section_spin.setValue(section)
        if dialog.exec():
            base, detail = dialog.get_course_data()
            if base and detail:
                self.courses.append((base, detail))
                self.schedule_view.update_courses(self.courses)
                self._action_save()

    def _on_edit_course(self, base, detail):
        dialog = CourseDialog(self, base, detail)
        if dialog.exec():
            self._remove_course(base.id)
            new_base, new_detail = dialog.get_course_data()
            if new_base and new_detail:
                self.courses.append((new_base, new_detail))
                self.schedule_view.update_courses(self.courses)
                self._action_save()

    def _remove_course(self, course_id):
        self.courses = [c for c in self.courses if c[0].id != course_id]

    def _on_empty_cell_clicked(self, day, section):
        self._on_add_course(day, section)
