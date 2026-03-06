"""
UI 样式定义 (Modern UI v2.3 - 修复版)
src/ui/styles.py

修复内容：
1. 优化时间列可读性 - 增加背景不透明度和文字对比度
2. 修复下拉菜单箭头显示问题
3. 优化整体配色
"""

class ModernStyles:
    # --- 核心配色 ---
    COLOR_FRAME_BG = "rgba(255, 255, 255, 180)" # 更透明以展示 Mica
    COLOR_TEXT_PRIMARY = "#1a1a1a"
    COLOR_TEXT_SECONDARY = "#4a4a4a"
    COLOR_ACCENT = "#0078d4" # Windows 11 Blue
    COLOR_BORDER = "rgba(0, 0, 0, 0.1)"
    
    # --- 时间列专用配色 ---
    COLOR_TIME_BG = "rgba(255, 255, 255, 150)"
    COLOR_TIME_TEXT = "#1a1a1a"
    COLOR_TIME_SUBTEXT = "#6a6a6a"

    # --- 全局字体 ---
    FONT_FAMILY = "'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei', sans-serif"

    # --- 滚动条美化 (Windows 11 风格) ---
    SCROLLBAR = f"""
        QScrollBar:vertical {{
            border: none;
            background: transparent;
            width: 10px;
            margin: 0px;
        }}
        QScrollBar::handle:vertical {{
            background: rgba(0, 0, 0, 0.2);
            min-height: 30px;
            border-radius: 5px;
            margin: 2px;
        }}
        QScrollBar::handle:vertical:hover {{
            background: rgba(0, 0, 0, 0.3);
        }}
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
            height: 0px;
        }}
        QScrollBar:horizontal {{
            border: none;
            background: transparent;
            height: 10px;
            margin: 0px;
        }}
        QScrollBar::handle:horizontal {{
            background: rgba(0, 0, 0, 0.2);
            min-width: 30px;
            border-radius: 5px;
            margin: 2px;
        }}
    """

    # --- 全局默认样式 ---
    GLOBAL = f"""
        QWidget {{
            font-family: "{FONT_FAMILY}";
            color: {COLOR_TEXT_PRIMARY};
            outline: none;
        }}
        {SCROLLBAR}
    """

    # --- 对话框样式 ---
    DIALOG = f"""
        QDialog {{ 
            background-color: #f3f3f3; 
            border-radius: 12px;
        }}
    """

    # --- 主窗口工具栏 ---
    TOOLBAR = f"""
        QToolBar {{
            background-color: {COLOR_FRAME_BG};
            border-bottom: 1px solid {COLOR_BORDER};
            spacing: 12px;
            padding: 10px 16px;
        }}
        QToolButton {{
            background-color: transparent;
            border: 1px solid transparent;
            border-radius: 8px;
            padding: 8px 16px;
            font-weight: 600;
            color: {COLOR_TEXT_PRIMARY};
        }}
        QToolButton:hover {{
            background-color: rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(0, 0, 0, 0.05);
        }}
        QToolButton:pressed {{
            background-color: rgba(0, 0, 0, 0.1);
        }}
        /* 菜单样式 */
        QMenu {{
            background-color: rgba(255, 255, 255, 230);
            border: 1px solid {COLOR_BORDER};
            border-radius: 12px;
            padding: 8px;
        }}
        QMenu::item {{
            padding: 10px 24px;
            border-radius: 6px;
            margin: 2px 4px;
        }}
        QMenu::item:selected {{
            background-color: rgba(0, 120, 212, 0.1);
            color: {COLOR_ACCENT};
        }}
    """

    # --- 组合框样式 ---
    COMBOBOX = f"""
        QComboBox {{
            background-color: #ffffff;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-bottom: 2px solid rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 8px 12px;
            min-width: 100px;
        }}
        QComboBox:hover {{
            background-color: #f9f9f9;
        }}
        QComboBox:focus {{
            border-bottom: 2px solid {COLOR_ACCENT};
        }}
        QComboBox::drop-down {{
            border: none;
            width: 30px;
        }}
    """

    # --- 输入框样式 ---
    INPUT = f"""
        QLineEdit {{
            background-color: #ffffff;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-bottom: 2px solid rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 10px 14px;
        }}
        QLineEdit:focus {{
            border-bottom: 2px solid {COLOR_ACCENT};
        }}
    """

    # --- 按钮样式 ---
    BUTTON = f"""
        QPushButton {{
            background-color: #ffffff;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-bottom: 2px solid rgba(0, 0, 0, 0.15);
            border-radius: 8px;
            padding: 10px 20px;
            font-weight: 600;
        }}
        QPushButton:hover {{
            background-color: #f9f9f9;
        }}
        QPushButton:pressed {{
            background-color: #f3f3f3;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }}
    """

    # --- 主要按钮样式 ---
    BUTTON_PRIMARY = f"""
        QPushButton#PrimaryButton {{
            background-color: {COLOR_ACCENT};
            color: white;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-bottom: 2px solid rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 10px 24px;
            font-weight: bold;
        }}
        QPushButton#PrimaryButton:hover {{
            background-color: #0067b8;
        }}
    """

    # --- 分组框样式 ---
    GROUP_BOX = """
        QGroupBox {
            font-weight: 700;
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 12px;
            margin-top: 16px;
            padding: 20px;
            background-color: rgba(255, 255, 255, 0.4);
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 15px;
            padding: 0 8px;
            color: #1a1a1a;
        }
    """

    # --- 表头样式 ---
    TABLE_HEADER = """
        QHeaderView::section {
            background-color: rgba(255, 255, 255, 0.6);
            color: #1a1a1a;
            border: none;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
            padding: 12px;
            font-weight: 700;
            font-size: 14px;
        }
    """


    # --- 滑块样式 ---
    SLIDER = f"""
        QSlider::groove:horizontal {{
            height: 4px;
            background-color: #e0e0e0;
            border-radius: 2px;
        }}
        QSlider::sub-page:horizontal {{
            background-color: {COLOR_ACCENT};
            border-radius: 2px;
        }}
        QSlider::handle:horizontal {{
            background-color: white;
            border: 2px solid {COLOR_ACCENT};
            width: 16px;
            height: 16px;
            margin: -7px 0;
            border-radius: 8px;
        }}
    """

    # --- 复选框样式 ---
    CHECKBOX = """
        QCheckBox {
            spacing: 8px;
        }
        QCheckBox::indicator {
            width: 18px;
            height: 18px;
            border: 2px solid #d0d0d0;
            border-radius: 4px;
        }
        QCheckBox::indicator:checked {
            background-color: #3498db;
            border-color: #3498db;
        }
    """

    # --- 单选框样式 ---
    RADIO = """
        QRadioButton {
            spacing: 8px;
        }
        QRadioButton::indicator {
            width: 18px;
            height: 18px;
            border: 2px solid #d0d0d0;
            border-radius: 9px;
        }
        QRadioButton::indicator:checked {
            border: 5px solid #3498db;
            background-color: white;
        }
    """

    # --- 日期选择器样式 ---
    DATE_EDIT = """
        QDateEdit {
            background-color: #ffffff;
            border: 1px solid #d0d0d0;
            border-radius: 6px;
            padding: 6px 10px;
        }
        QDateEdit:focus {
            border: 2px solid #3498db;
            padding: 5px 9px;
        }
    """
