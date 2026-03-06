"""
悬浮自动隐藏滚动条组件 (Modern UI v2.1)
src/ui/overlay_scrollbar.py
"""

from PyQt6.QtWidgets import QWidget
from PyQt6.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, QEvent
from PyQt6.QtGui import QPainter, QColor, QBrush, QPen


class OverlayScrollBar(QWidget):
    """
    一个绘制在内容上方的自定义滚动条
    - 滚动时显示
    - 静止时淡出
    - 不占用布局空间
    """

    def __init__(self, target_widget):
        super().__init__(target_widget)
        self.target = target_widget

        # 绑定目标组件的滚动条
        self.scroll_bar = self.target.verticalScrollBar()
        self.scroll_bar.valueChanged.connect(self.update_position)
        self.scroll_bar.rangeChanged.connect(self.update_position)

        # 安装事件过滤器以捕获父组件的 Resize 和 Wheel 事件
        self.target.installEventFilter(self)
        self.target.viewport().installEventFilter(self)

        # 样式配置
        self.bar_width = 6
        self.padding_right = 4
        self.min_handle_height = 30
        self.color = QColor(0, 0, 0, 100)  # 半透明黑色

        # 动画配置
        self.opacity = 0.0
        self.fade_timer = QTimer(self)
        self.fade_timer.setSingleShot(True)
        self.fade_timer.setInterval(800)  # 800ms 后开始消失
        self.fade_timer.timeout.connect(self.fade_out)

        self.anim = QPropertyAnimation(self, b"opacity_prop")
        self.anim.setDuration(200)

        # 初始化状态
        self.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)  # 鼠标穿透（可选，看需求）
        self.hide()  # 初始隐藏

    # --- 动画属性 ---
    def get_opacity(self):
        return self.opacity

    def set_opacity(self, val):
        self.opacity = val
        self.update()

    from PyQt6.QtCore import pyqtProperty
    opacity_prop = pyqtProperty(float, get_opacity, set_opacity)

    # --- 逻辑控制 ---
    def show_scroll(self):
        """显示滚动条（重置消失计时器）"""
        self.show()
        self.raise_()

        if self.opacity < 1.0:
            self.anim.stop()
            self.anim.setStartValue(self.opacity)
            self.anim.setEndValue(1.0)
            self.anim.setEasingCurve(QEasingCurve.Type.OutQuad)
            self.anim.start()

        self.fade_timer.start()

    def fade_out(self):
        """淡出动画"""
        self.anim.stop()
        self.anim.setStartValue(self.opacity)
        self.anim.setEndValue(0.0)
        self.anim.setEasingCurve(QEasingCurve.Type.OutQuad)
        self.anim.start()

    def update_position(self):
        """当内容滚动或改变大小时，重绘"""
        self.show_scroll()
        self.update()

    # --- 绘制逻辑 ---
    def paintEvent(self, event):
        if self.opacity <= 0:
            return

        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setOpacity(self.opacity)

        # 计算滑块位置和高度
        v_bar = self.scroll_bar
        if v_bar.maximum() <= v_bar.minimum():
            return  # 不需要滚动条

        viewport_h = self.target.viewport().height()
        content_h = v_bar.maximum() - v_bar.minimum() + v_bar.pageStep()

        # 比例
        ratio = viewport_h / content_h
        handle_h = max(self.min_handle_height, int(viewport_h * ratio))

        # 滚动进度
        if v_bar.maximum() > v_bar.minimum():
            progress = (v_bar.value() - v_bar.minimum()) / (v_bar.maximum() - v_bar.minimum())
            handle_y = int(progress * (viewport_h - handle_h))
        else:
            handle_y = 0

        # 绘制胶囊形状的滑块
        rect_x = self.width() - self.bar_width - self.padding_right

        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(self.color))
        painter.drawRoundedRect(rect_x, handle_y, self.bar_width, handle_h, 3, 3)

    # --- 事件拦截 ---
    def eventFilter(self, source, event):
        if event.type() == QEvent.Type.Resize:
            # 调整自身大小以覆盖父组件右侧
            self.setGeometry(0, 0, self.target.width(), self.target.height())
            self.update_position()

        elif event.type() == QEvent.Type.Wheel:
            # 滚轮滚动时显示
            self.show_scroll()

        return super().eventFilter(source, event)