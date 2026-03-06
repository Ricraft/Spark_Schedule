"""
WebView 导入向导 (Modern UI v2.1)
src/ui/webview_import_dialog.py

更新：集成 HTMLImporter，实现"所见即所得"的导入
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLineEdit, QPushButton,
    QLabel, QFrame, QMessageBox
)
from PyQt6.QtCore import QUrl, Qt
from pathlib import Path

# --- 引入数据模型与导入器 ---
from src.importers.html_importer import HTMLImporter
from src.ui.styles import ModernStyles

# WebEngine 兼容处理
try:
    from PyQt6.QtWebEngineWidgets import QWebEngineView

    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False


    class QWebEngineView(QLabel):
        def setUrl(self, url): pass

        def load(self, url): pass

        def url(self): return QUrl("")

        def page(self): return None


class WebviewImportDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("🌐 导入向导 - 智能识别")
        self.resize(1000, 700)

        # 默认地址，可改为你学校教务系统
        self.default_url = "https://jwxt.univ.edu.cn/"

        # 存储解析结果 (bases, details)
        self.parsed_result = ([], [])

        self._init_ui()

        if HAS_WEBENGINE:
            self.webview.load(QUrl(self.default_url))
        else:
            self.webview.setText("⚠️ 未检测到 PyQt6-WebEngine，无法使用内置浏览器。")
            self.webview.setAlignment(Qt.AlignmentFlag.AlignCenter)

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0);
        layout.setSpacing(0)

        # 1. 导航栏
        nav_bar = QFrame()
        nav_bar.setStyleSheet(
            f"QFrame {{ background-color: {ModernStyles.COLOR_FRAME_BG}; border-bottom: 1px solid #E0E0E0; }}")
        nav_layout = QHBoxLayout(nav_bar);
        nav_layout.setContentsMargins(10, 8, 10, 8)

        self.btn_back = QPushButton("←");
        self.btn_forward = QPushButton("→");
        self.btn_refresh = QPushButton("↻")
        self.url_bar = QLineEdit();
        self.url_bar.setText(self.default_url);
        self.url_bar.returnPressed.connect(self._on_navigate)
        btn_go = QPushButton("转到");
        btn_go.clicked.connect(self._on_navigate)

        for btn in [self.btn_back, self.btn_forward, self.btn_refresh, btn_go]:
            btn.setStyleSheet("border:none; background:transparent; font-weight:bold; padding:5px;")

        nav_layout.addWidget(self.btn_back);
        nav_layout.addWidget(self.btn_forward);
        nav_layout.addWidget(self.btn_refresh)
        nav_layout.addWidget(self.url_bar, 1);
        nav_layout.addWidget(btn_go)
        layout.addWidget(nav_bar)

        # 2. WebView
        self.webview = QWebEngineView()
        if HAS_WEBENGINE:
            self.webview.urlChanged.connect(lambda u: self.url_bar.setText(u.toString()))
            self.btn_back.clicked.connect(self.webview.back)
            self.btn_forward.clicked.connect(self.webview.forward)
            self.btn_refresh.clicked.connect(self.webview.reload)
        layout.addWidget(self.webview, 1)

        # 3. 底部操作栏
        action_bar = QFrame();
        action_bar.setStyleSheet("background:white; border-top:1px solid #E0E0E0;")
        act_layout = QHBoxLayout(action_bar);
        act_layout.setContentsMargins(20, 15, 20, 15)

        self.status_label = QLabel("💡 请登录并进入【课表页面】，确保课表已显示")
        self.btn_extract = QPushButton("📥 提取当前页课表")
        self.btn_extract.setStyleSheet(
            f"background-color:{ModernStyles.COLOR_ACCENT}; color:white; border-radius:18px; padding:8px 25px; font-weight:bold;")
        self.btn_extract.clicked.connect(self._on_extract)

        act_layout.addWidget(self.status_label, 1);
        act_layout.addWidget(self.btn_extract)
        layout.addWidget(action_bar)

    def _on_navigate(self):
        url = self.url_bar.text().strip()
        if HAS_WEBENGINE: self.webview.load(QUrl(url if url.startswith("http") else f"http://{url}"))

    def _on_extract(self):
        """核心：通过注入 JS 穿透 Iframe 获取 HTML，并调用 Importer 解析"""
        if not HAS_WEBENGINE:
            QMessageBox.warning(self, "错误", "缺少 WebEngine 组件。")
            return

        self.btn_extract.setText("正在分析页面...")
        self.btn_extract.setEnabled(False)

        # 定义 JavaScript 提取脚本
        # 逻辑：优先找 ID 为 Frame1 的框架（南华/强智特征），其次找 src 包含 'kb' 的框架，最后兜底用主页面
        js_code = """
        (function() {
            function getFrameContent() {
                // 1. 尝试直接获取 ID 为 Frame1 的 iframe (强智/南华常用)
                var targetFrame = document.getElementById('Frame1');

                // 2. 如果没找到，遍历所有 iframe 查找 URL 中包含 'xskb'(学生课表) 或 'kb' 的
                if (!targetFrame) {
                    var frames = document.getElementsByTagName('iframe');
                    for (var i = 0; i < frames.length; i++) {
                        var src = frames[i].src || "";
                        if (src.indexOf('xskb') > -1 || src.indexOf('kb') > -1) {
                            targetFrame = frames[i];
                            break;
                        }
                    }
                }

                // 3. 如果找到了 iframe，尝试提取其内部 HTML
                if (targetFrame) {
                    try {
                        var doc = targetFrame.contentDocument || targetFrame.contentWindow.document;
                        if (doc && doc.documentElement) {
                            console.log("Python 提取: 成功定位到 Iframe");
                            return doc.documentElement.outerHTML;
                        }
                    } catch(e) {
                        console.log("Python 提取: 跨域或无法访问 Iframe, " + e);
                    }
                }

                // 4. 兜底：返回当前主页面的 HTML
                console.log("Python 提取: 使用主页面内容");
                return document.documentElement.outerHTML;
            }
            return getFrameContent();
        })();
        """

        # 使用 runJavaScript 执行脚本，结果会回调给 self._process_html
        self.webview.page().runJavaScript(js_code, self._process_html)

    def _process_html(self, html_content):
        """调用 HTMLImporter 解析 HTML"""
        try:
            # 1. 初始化导入器
            importer = HTMLImporter()

            # 2. 尝试验证
            valid, msg = importer.validate(html_content)
            if not valid:
                raise ValueError(f"页面格式无法识别: {msg}")

            # 3. 执行解析 (返回 bases, details)
            self.parsed_result = importer.parse(html_content)

            count = len(self.parsed_result[0])
            if count == 0:
                raise ValueError("未解析到任何课程，请确认当前页面是课表页。")

            # 4. 成功
            QMessageBox.information(self, "提取成功", f"成功识别出 {count} 门课程！\n点击确定导入到主界面。")
            self.accept()  # 关闭对话框，返回 True

        except Exception as e:
            QMessageBox.warning(self, "提取失败", str(e))
            self.btn_extract.setText("📥 提取当前页课表")
            self.btn_extract.setEnabled(True)

    def get_imported_data(self):
        """返回 (bases, details)"""
        return self.parsed_result