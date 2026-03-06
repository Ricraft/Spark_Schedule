"""
常规设置页面
src/ui/general_settings_tab.py
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QFormLayout, QDateEdit,
    QCheckBox, QLabel, QGroupBox, QPushButton, QMessageBox
)
from PyQt6.QtCore import QDate, Qt
from src.models.config import Config

class GeneralSettingsTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.config = Config.load()
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        # 标题
        title = QLabel("常规设置")
        title.setStyleSheet("font-size: 18px; font-weight: bold; color: #2c3e50;")
        layout.addWidget(title)

        # --- 学期设置组 ---
        group_semester = QGroupBox("学期设置")
        group_semester.setStyleSheet("""
            QGroupBox { border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 10px; padding-top: 15px; font-weight: bold; }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 5px; color: #7f8c8d; }
        """)
        form_layout = QFormLayout(group_semester)
        form_layout.setSpacing(15)

        # 开学日期选择器
        self.date_edit = QDateEdit()
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("yyyy-MM-dd")

        # 加载当前配置的日期
        try:
            current_date = QDate.fromString(self.config.semester_start_date, "yyyy-MM-dd")
            self.date_edit.setDate(current_date)
        except:
            self.date_edit.setDate(QDate.currentDate())

        form_layout.addRow("当前学期开始日期:", self.date_edit)
        layout.addWidget(group_semester)

        # --- 其他设置组 ---
        group_other = QGroupBox("启动选项")
        group_other.setStyleSheet(group_semester.styleSheet())
        vbox_other = QVBoxLayout(group_other)

        self.check_startup = QCheckBox("开机自动启动 (仅 Windows)")
        self.check_startup.setChecked(self.config.auto_start)
        self.check_startup.clicked.connect(self._handle_auto_start)
        vbox_other.addWidget(self.check_startup)
        
        self.check_minimize_tray = QCheckBox("关闭窗口时最小化到系统托盘")
        self.check_minimize_tray.setChecked(self.config.minimize_to_tray)
        vbox_other.addWidget(self.check_minimize_tray)

        layout.addWidget(group_other)

        layout.addStretch()

        # 保存按钮
        btn_save = QPushButton("💾 保存常规设置")
        btn_save.setObjectName("PrimaryButton")
        btn_save.setStyleSheet("""
            QPushButton { background-color: #3498db; color: white; border-radius: 6px; padding: 8px 15px; font-weight: bold; }
            QPushButton:hover { background-color: #2980b9; }
        """)
        btn_save.clicked.connect(self._on_save)
        layout.addWidget(btn_save)

    def _handle_auto_start(self):
        """处理开机自启动设置"""
        import sys
        if sys.platform != 'win32':
            QMessageBox.warning(self, "不支持", "开机自启动功能仅支持 Windows 系统")
            self.check_startup.setChecked(False)
            return
        
        import winreg
        import os
        
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
        app_name = "SparkSchedule"
        
        # 获取当前可执行文件的完整路径
        if getattr(sys, 'frozen', False):
            # 如果是打包后的 exe
            exe_path = sys.executable
        else:
            # 如果是 Python 脚本，使用 pythonw.exe 启动 main.py
            python_exe = sys.executable.replace('python.exe', 'pythonw.exe')
            main_script = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'main.py'))
            exe_path = f'"{python_exe}" "{main_script}"'
        
        checked = self.check_startup.isChecked()
        
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
            
            if checked:
                # 添加到启动项
                winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, exe_path)
                print(f"✅ [AutoStart] Added to startup: {exe_path}")
                QMessageBox.information(self, "成功", "已添加到开机自启动")
            else:
                # 从启动项移除
                try:
                    winreg.DeleteValue(key, app_name)
                    print(f"✅ [AutoStart] Removed from startup")
                    QMessageBox.information(self, "成功", "已从开机自启动中移除")
                except FileNotFoundError:
                    pass
            
            winreg.CloseKey(key)
            
            # 更新配置
            self.config.auto_start = checked
            
        except Exception as e:
            print(f"❌ [AutoStart] Failed to modify registry: {e}")
            QMessageBox.critical(self, "失败", f"修改开机自启动失败：{str(e)}\n\n可能需要管理员权限")
            # 恢复复选框状态
            self.check_startup.setChecked(not checked)
    
    def _on_save(self):
        """保存配置"""
        try:
            # 更新配置对象
            new_date = self.date_edit.date().toString("yyyy-MM-dd")
            self.config.semester_start_date = new_date
            self.config.minimize_to_tray = self.check_minimize_tray.isChecked()

            # 保存到文件
            self.config.save()

            QMessageBox.information(self, "成功", "常规设置已保存，重启或刷新后生效。")

        except Exception as e:
            QMessageBox.warning(self, "错误", f"保存失败: {str(e)}")