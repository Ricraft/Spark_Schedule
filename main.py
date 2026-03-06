# -*- coding: utf-8 -*-
import sys
import os
import json
import time
import io
import random
import wave
from PyQt6.QtWidgets import QApplication, QMainWindow, QSystemTrayIcon, QMenu, QLabel
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineSettings, QWebEnginePage
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtCore import QUrl, Qt, QTimer
from PyQt6.QtGui import QColor, QIcon, QAction

# Import the Bridge
from bridge import AppBridge
from logger_setup import logger


def get_resource_path(relative_path):
    """Return resource path in dev/frozen mode."""
    if getattr(sys, "frozen", False):
        base_path = sys._MEIPASS  # type: ignore[attr-defined]
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))

    if not getattr(sys, "frozen", False) and relative_path.startswith("react (3)"):
        base_path = os.path.dirname(base_path)

    return os.path.join(base_path, relative_path)

def get_data_path(relative_path=""):
    """Return data path beside script/executable."""
    if getattr(sys, "frozen", False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))

    if relative_path:
        return os.path.join(base_path, "data", relative_path)
    return os.path.join(base_path, "data")


def prepare_webengine_env_from_settings():
    """Set WebEngine env vars before QApplication is created."""
    settings_file = get_data_path('settings.json')
    gpu_acceleration_enabled = True
    enable_devtools = False

    try:
        if os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings_data = json.load(f)
            gpu_acceleration_enabled = settings_data.get('gpu_acceleration', True)
            enable_devtools = settings_data.get('enable_devtools', False)
    except Exception as e:
        print(f"⚠️ [Settings] Preload failed before QApplication: {e}, using defaults")

    if not gpu_acceleration_enabled:
        os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu --disable-software-rasterizer"
    os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "8888"

    return gpu_acceleration_enabled, enable_devtools


class ScholarApp(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # 🔑 确保数据目录存在（打包后在可执行文件旁边）
        data_dir = get_data_path()
        os.makedirs(data_dir, exist_ok=True)
        print(f"鉁?[Data] Data directory: {data_dir}")
        
        self.setWindowTitle("Spark Schedule - Smart Schedule Manager")
        self.resize(1280, 800)
        self.devtools_view = None
        self.devtools_page = None
        self._python_console_opened = False
        
        # 璁剧疆绐楀彛鍥炬爣
        self._set_window_icon()
        
        # Load settings to check GPU acceleration preference and startup behavior
        settings_file = get_data_path('settings.json')
        gpu_acceleration_enabled = True  # Default value
        self.minimize_to_tray = True  # Default value
        self.start_minimized = False  # Default value
        self.enable_devtools = False  # Default value
        self.show_python_console = False  # Default value
        self.performance_overlay = False  # Default value
        self.enable_notifications = True  # Default value
        self.notification_sound = "bell"  # Default value
        self.notification_volume = 80  # Default value
        self._notification_noise_cache = {}
        
        try:
            if os.path.exists(settings_file):
                with open(settings_file, 'r', encoding='utf-8') as f:
                    settings_data = json.load(f)
                    gpu_acceleration_enabled = settings_data.get('gpu_acceleration', True)
                    self.minimize_to_tray = settings_data.get('minimize_to_tray', True)
                    self.start_minimized = settings_data.get('start_minimized', False)
                    self.enable_devtools = settings_data.get('enable_devtools', False)
                    self.show_python_console = settings_data.get('show_python_console', False)
                    self.performance_overlay = settings_data.get('performance_overlay', False)
                    self.enable_notifications = settings_data.get('enable_notifications', True)
                    self.notification_sound = settings_data.get('notification_sound', 'bell')
                    self.notification_volume = int(settings_data.get('notification_volume', 80))
                    print(f"鉁?[Settings] GPU acceleration: {'enabled' if gpu_acceleration_enabled else 'disabled'}")
                    print(f"鉁?[Settings] Minimize to tray: {self.minimize_to_tray}")
                    print(f"鉁?[Settings] Start minimized: {self.start_minimized}")
                    print(f"鉁?[Settings] DevTools: {'enabled' if self.enable_devtools else 'disabled'}")
                    print(f"鉁?[Settings] Python console: {'enabled' if self.show_python_console else 'disabled'}")
                    print(f"鉁?[Settings] Performance overlay: {'enabled' if self.performance_overlay else 'disabled'}")
        except Exception as e:
            print(f"鈿狅笍 [Settings] Failed to load settings: {e}, using defaults")
        
        # Apply GPU acceleration setting
        if not gpu_acceleration_enabled:
            # Disable hardware acceleration
            os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu --disable-software-rasterizer"
            print("馃敡 [WebEngine] Hardware acceleration disabled")
        else:
            print("馃殌 [WebEngine] Hardware acceleration enabled")
        
        # Enable remote debugging (always enabled for DevTools access)
        os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "8888"
        if self.enable_devtools:
            print("馃攳 [DevTools] Remote debugging enabled: http://localhost:8888")
            print("馃攳 [DevTools] You can open Chrome DevTools by visiting chrome://inspect")
        else:
            print("馃敡 [WebEngine] Remote debugging port: 8888 (DevTools disabled in settings)")
        
        # Show Python console window if enabled
        if self.show_python_console:
            self._show_python_console()
        
        # 1. Setup main WebEngine
        self.browser = QWebEngineView()
        self.setCentralWidget(self.browser)
        
        # Enable DevTools if requested
        if self.enable_devtools:
            self._enable_devtools()
            QTimer.singleShot(1200, self.open_frontend_devtools)

        # 2. Setup communication bridge
        self.channel = QWebChannel()
        self.bridge = AppBridge()
        
        # 璁剧疆涓荤獥鍙ｅ紩鐢ㄥ埌bridge锛岀敤浜庢帶鍒跺唴宓屾祻瑙堝櫒
        self.bridge.set_main_window(self)
        
        # Register bridge object (unified name)
        self.channel.registerObject("bridge", self.bridge)
        self.browser.page().setWebChannel(self.channel)
        
        # 3. Setup import browser view (鍐呭祵娴忚鍣?
        self.import_browser_view = QWebEngineView()
        self.import_browser_view.setWindowFlag(Qt.WindowType.FramelessWindowHint)
        self.import_browser_view.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.import_browser_view.page().setBackgroundColor(QColor(0, 0, 0, 0))
        self.import_browser_view.hide()
        
        # Configure import browser settings
        import_settings = self.import_browser_view.page().settings()
        import_settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        import_settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        import_settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        import_settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, True)
        import_settings.setAttribute(QWebEngineSettings.WebAttribute.ShowScrollBars, True)  # 鍚敤婊氬姩鏉?
        
        # 璁剧疆婊氬姩鏉℃牱寮?
        self.import_browser_view.setStyleSheet("""
            QWebEngineView {
                background: transparent;
            }
        """)
        
        # Configure main browser settings
        settings = self.browser.page().settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
        
        # 🔥 关键修复：设置持久化存储路径，使 localStorage 在应用重启后保留
        from PyQt6.QtWebEngineCore import QWebEngineProfile
        profile = self.browser.page().profile()
        
        # 设置持久化存储路径（使用数据目录）
        storage_path = get_data_path('webengine_storage')
        os.makedirs(storage_path, exist_ok=True)
        profile.setPersistentStoragePath(storage_path)
        
        # 设置缓存路径
        cache_path = get_data_path('webengine_cache')
        os.makedirs(cache_path, exist_ok=True)
        profile.setCachePath(cache_path)
        
        print(f"✅ [WebEngine] 持久化存储路径 {storage_path}")
        print(f"✅ [WebEngine] 缓存路径: {cache_path}")
        
        # 清除 HTTP 缓存（但不影响 localStorage 和数据缓存）
        profile.clearHttpCache()
        print("[WebEngine] HTTP cache cleared")

        # 馃攧 澶勭悊鍦扮悊位置鏉冮檺璇锋眰
        self.browser.page().featurePermissionRequested.connect(self._on_feature_permission_requested)
        self.import_browser_view.page().featurePermissionRequested.connect(self._on_feature_permission_requested)

        # 4. Initialize system tray icon
        self._init_system_tray()
        
        # 5. Initialize performance overlay if enabled
        self._init_performance_overlay()
        
        # 5.5. Start async initialization of backend managers
        logger.info("Starting backend initialization...")
        self.bridge.perform_initialization()
        
        # 6. Load main UI
        # 浣跨敤 react (3) 浣滀负涓昏UI婧愮爜
        # 馃敡 淇锛氭敮鎸佹墦鍖呭悗鐨勮矾寰勬煡鎵?
        ui_search_paths = [
            get_resource_path(os.path.join("react (3)", "dist", "index.html")),
            get_resource_path(os.path.join("dist", "index.html")),
            get_resource_path("index.html")
        ]
        
        main_ui_path = None
        for p in ui_search_paths:
            if os.path.exists(p):
                main_ui_path = p
                break
        
        if main_ui_path:
            print(f"鉁?[UI] Loading main UI from: {main_ui_path}")
            self.browser.setUrl(QUrl.fromLocalFile(os.path.abspath(main_ui_path)))
        else:
            print(f"鉂?[UI] Main UI file not found in search paths: {ui_search_paths}")
            if not getattr(sys, 'frozen', False):
                print("馃挕 [UI] Please run 'npm run build' in the 'react (3)' directory first")
            else:
                print("馃挕 [UI] Frontend files may be missing from the package. Check PyInstaller --add-data configuration.")
        
        # 7. Handle start minimized
        if self.start_minimized and self.minimize_to_tray:
            print("馃斀 [Settings] Starting minimized to tray")
            # Don't show window, just show tray icon
    
    def _set_window_icon(self):
        """璁剧疆绐楀彛鍥炬爣"""
        # 灏濊瘯鍔犺浇涓诲浘鏍?
        icon_path = get_resource_path('resources/icon.png')
        if not os.path.exists(icon_path):
            icon_path = get_resource_path('resources/icon.ico')
        
        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))
            print(f"鉁?[Icon] Loaded window icon from: {icon_path}")
        else:
            print("鈿狅笍 [Icon] Window icon not found, using default")
    
    def _enable_devtools(self):
        """鍚敤寮€鍙戣€呭伐鍏"""
        try:
            # 鍚敤 WebEngine 寮€鍙戣€呭伐鍏?
            page = self.browser.page()
            page.settings().setAttribute(
                QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, True
            )
            
            # 娉ㄥ叆 DevTools 蹇嵎閿敮鎸?
            page.loadFinished.connect(self._inject_devtools_shortcut)
            
            print("鉁?[DevTools] Developer tools enabled")
            print("馃挕 [DevTools] Press F12 or Ctrl+Shift+I to open DevTools")
            print("馃挕 [DevTools] Or visit: http://localhost:8888 in Chrome") 
        except Exception as e:
            print(f"鉂?[DevTools] Failed to enable: {e}")
    
    def _inject_devtools_shortcut(self, ok):
        """娉ㄥ叆 DevTools 蹇嵎閿剼鏈"""
        if not ok or not self.enable_devtools:
            return
        
        script = """
        // DevTools 蹇嵎閿敮鎸?
        document.addEventListener('keydown', function(e) {
            // F12 鎴?Ctrl+Shift+I
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault();
                console.log('馃攳 DevTools shortcut triggered. Visit http://localhost:8888 in Chrome to debug.');
                alert('DevTools is available at:\\nhttp://localhost:8888\\n\\nOpen Chrome and visit chrome://inspect to connect.');
            }
        });
        console.log('馃攳 DevTools shortcuts enabled (F12 or Ctrl+Shift+I)');
        """
        
        self.browser.page().runJavaScript(script)
    
    def _show_python_console(self):
        """鏄剧ず Python 鎺у埗鍙扮獥鍙ｏ紙Windows锛"""
        if sys.platform == 'win32':
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                user32 = ctypes.windll.user32

                if self._python_console_opened:
                    console_hwnd = kernel32.GetConsoleWindow()
                    if console_hwnd:
                        user32.ShowWindow(console_hwnd, 9)  # SW_RESTORE
                        user32.SetForegroundWindow(console_hwnd)
                    return
                if kernel32.GetConsoleWindow() == 0:
                    kernel32.AllocConsole()

                sys.stdout = open('CONOUT$', 'w', encoding='utf-8', errors='replace')
                sys.stderr = open('CONOUT$', 'w', encoding='utf-8', errors='replace')
                
                print("=" * 60)
                print("馃悕 Python Backend Console")
                print("=" * 60)
                print("This console shows backend logs and API calls.")
                print("Close the main window to exit.")
                print("=" * 60)
                
                print("鉁?[Console] Python console window opened")
                self._python_console_opened = True
                console_hwnd = kernel32.GetConsoleWindow()
                if console_hwnd:
                    user32.ShowWindow(console_hwnd, 9)  # SW_RESTORE
                    user32.SetForegroundWindow(console_hwnd)
            except Exception as e:
                print(f"鉂?[Console] Failed to open console: {e}")
        else:
            print("鈿狅笍 [Console] Python console is only supported on Windows")

    def open_frontend_devtools(self):
        """Open/focus embedded frontend DevTools window."""
        try:
            if self.devtools_view is None:
                self.devtools_view = QWebEngineView()
                self.devtools_view.setWindowTitle("Spark Schedule - Frontend DevTools")
                self.devtools_view.resize(1200, 800)
                self.devtools_page = QWebEnginePage(self.browser.page().profile(), self.devtools_view)
                self.devtools_view.setPage(self.devtools_page)
                self.browser.page().setDevToolsPage(self.devtools_page)
                self.devtools_page.setInspectedPage(self.browser.page())

            self.devtools_view.show()
            self.devtools_view.raise_()
            self.devtools_view.activateWindow()
            print("鉁?[DevTools] Embedded frontend DevTools opened")
            return True
        except Exception as e:
            print(f"鉂?[DevTools] Failed to open embedded DevTools: {e}")
            return False

    def open_backend_console(self):
        """Open/focus backend Python terminal."""
        try:
            self._show_python_console()
            return True
        except Exception as e:
            print(f"❌ [Console] Failed to open backend console: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _init_performance_overlay(self):
        """鍒濆鍖栨€ц兘鐩戞帶鍙犲姞灞"""
        if not self.performance_overlay:
            return
        
        try:
            from PyQt6.QtWidgets import QLabel
            from PyQt6.QtCore import QTimer
            import psutil
            
            # 鍒涘缓鎬ц兘鍙犲姞灞傛爣绛?
            self.perf_label = QLabel(self)
            self.perf_label.setStyleSheet("""
                QLabel {
                    background-color: rgba(0, 0, 0, 180);
                    color: #00ff00;
                    font-family: 'Consolas', 'Courier New', monospace;
                    font-size: 11px;
                    padding: 8px;
                    border-radius: 4px;
                }
            """)
            self.perf_label.setFixedSize(220, 80)
            self.perf_label.move(10, 10)
            self.perf_label.raise_()
            self.perf_label.show()
            
            # 创建定时器更新性能数据
            self.perf_timer = QTimer(self)
            self.perf_timer.timeout.connect(self._update_performance_overlay)
            self.perf_timer.start(1000)  # 姣忕鏇存柊涓€娆?
            
            # 鍒濆鍖?FPS 璁℃暟鍣?
            self.frame_count = 0
            self.last_fps_time = time.time()
            self.current_fps = 0
            
            print("鉁?[Performance] Performance overlay enabled")
        except ImportError:
            print("鈿狅笍 [Performance] psutil not installed, performance overlay disabled")
        except Exception as e:
            print(f"鉂?[Performance] Failed to initialize overlay: {e}")
    
    def _update_performance_overlay(self):
        """更新性能监控数据"""
        try:
            import psutil
            import time
            
            # 获取内存使用情况
            process = psutil.Process()
            mem_info = process.memory_info()
            mem_mb = mem_info.rss / 1024 / 1024
            
            # 获取 CPU 使用率
            cpu_percent = process.cpu_percent(interval=0.1)
            
            # 璁＄畻 FPS锛堢畝鍖栫増锛屽熀浜庡畾鏃跺櫒锛?
            current_time = time.time()
            if current_time - self.last_fps_time >= 1.0:
                self.current_fps = self.frame_count
                self.frame_count = 0
                self.last_fps_time = current_time
            self.frame_count += 1
            
            # 鏇存柊鏄剧ず
            perf_text = f"""FPS: {self.current_fps}
CPU: {cpu_percent:.1f}%
Memory: {mem_mb:.1f} MB
Threads: {process.num_threads()}"""
            
            self.perf_label.setText(perf_text)
        except Exception as e:
            print(f"鉂?[Performance] Update failed: {e}")
    
    def _destroy_performance_overlay(self):
        """Disable and remove performance overlay immediately."""
        try:
            if hasattr(self, 'perf_timer') and self.perf_timer:
                self.perf_timer.stop()
                self.perf_timer.deleteLater()
                self.perf_timer = None
            if hasattr(self, 'perf_label') and self.perf_label:
                self.perf_label.hide()
                self.perf_label.deleteLater()
                self.perf_label = None
            print("閴?[Performance] Performance overlay disabled")
        except Exception as e:
            print(f"閳跨媴绗?[Performance] Failed to disable overlay: {e}")

    def set_performance_overlay(self, enabled: bool):
        """Apply performance overlay setting immediately without restart."""
        enabled = bool(enabled)
        if enabled == bool(getattr(self, 'performance_overlay', False)):
            return
        self.performance_overlay = enabled
        if enabled:
            self._init_performance_overlay()
        else:
            self._destroy_performance_overlay()

    def set_notification_preferences(self, settings: dict):
        """Apply notification-related settings immediately."""
        if "enable_notifications" in settings:
            self.enable_notifications = bool(settings.get("enable_notifications"))
        if "notification_sound" in settings:
            self.notification_sound = str(settings.get("notification_sound") or "none")
        if "notification_volume" in settings:
            try:
                self.notification_volume = max(0, min(100, int(settings.get("notification_volume"))))
            except Exception:
                pass

    def _build_white_noise_wav(self, volume: int) -> bytes:
        """Generate short, low-intensity white noise WAV bytes for notification."""
        volume = max(0, min(100, int(volume)))
        cache_key = f"noise_{volume}"
        if cache_key in self._notification_noise_cache:
            return self._notification_noise_cache[cache_key]

        sample_rate = 22050
        duration_s = 0.16
        samples = int(sample_rate * duration_s)
        amplitude = int(32767 * (0.015 + 0.18 * (volume / 100.0)))

        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            frames = bytearray()
            for _ in range(samples):
                val = random.randint(-amplitude, amplitude)
                frames += int(val).to_bytes(2, byteorder='little', signed=True)
            wav_file.writeframes(bytes(frames))

        wav_data = buffer.getvalue()
        self._notification_noise_cache[cache_key] = wav_data
        return wav_data

    def _play_notification_sound(self):
        """Play configured low-volume alert sound."""
        if not self.enable_notifications:
            return
        if self.notification_sound == "none":
            return
        if self.notification_volume <= 0:
            return
        if sys.platform != "win32":
            return

        try:
            import winsound
            wav_data = self._build_white_noise_wav(self.notification_volume)
            winsound.PlaySound(wav_data, winsound.SND_MEMORY | winsound.SND_ASYNC | winsound.SND_NODEFAULT)
        except Exception as e:
            print(f"閳跨媴绗?[Notification] Failed to play alert sound: {e}")

    def show_native_notification(self, title: str, message: str, play_sound: bool = True, timeout_ms: int = 5000):
        """Show Windows native tray notification and optional alert sound."""
        if not self.enable_notifications:
            return False
        if not hasattr(self, 'tray_icon'):
            self._init_system_tray()
        try:
            if hasattr(self, 'tray_icon') and self.tray_icon:
                self.tray_icon.showMessage(
                    str(title),
                    str(message),
                    QSystemTrayIcon.MessageIcon.Information,
                    int(timeout_ms)
                )
            if play_sound:
                self._play_notification_sound()
            return True
        except Exception as e:
            print(f"閴?[Notification] Failed to show native notification: {e}")
            return False

    def _init_system_tray(self):
        """初始化系统托盘图标"""
        # 创建系统托盘图标
        self.tray_icon = QSystemTrayIcon(self)
        
        # 设置托盘图标（优先使用 tray_icon，否则使用主图标）
        # 尝试加载托盘图标
        tray_icon_path = get_resource_path('resources/tray_icon.png')
        if not os.path.exists(tray_icon_path):
            tray_icon_path = get_resource_path('resources/tray_icon.ico')
        
        # 如果托盘图标不存在，使用主图标
        if not os.path.exists(tray_icon_path):
            tray_icon_path = get_resource_path('resources/icon.png')
            if not os.path.exists(tray_icon_path):
                tray_icon_path = get_resource_path('resources/icon.ico')
        
        # 加载图标
        if os.path.exists(tray_icon_path):
            self.tray_icon.setIcon(QIcon(tray_icon_path))
            print(f"✅ [Tray] Loaded icon from: {tray_icon_path}")
        else:
            # 使用系统默认图标
            self.tray_icon.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_ComputerIcon))
            print("⚠️ [Tray] Using system default icon")
        
        # 设置托盘提示 - 使用 UTF-8 编码确保中文正确显示
        tooltip_text = "Spark Schedule - 智能课程表助手"
        self.tray_icon.setToolTip(tooltip_text)
        
        # 创建托盘菜单
        tray_menu = QMenu()
        
        # 显示主窗口
        show_action = QAction("显示主窗口", self)
        show_action.triggered.connect(self._show_main_window)
        tray_menu.addAction(show_action)
        
        tray_menu.addSeparator()
        
        # 退出程序
        quit_action = QAction("退出程序", self)
        quit_action.triggered.connect(self._quit_application)
        tray_menu.addAction(quit_action)
        
        self.tray_icon.setContextMenu(tray_menu)
        
        # 鍙屽嚮鎵樼洏鍥炬爣鏄剧ず涓荤獥鍙?
        self.tray_icon.activated.connect(self._on_tray_activated)
        
        if self.minimize_to_tray:
            self.tray_icon.show()
            print("鉁?[Tray] System tray icon initialized (visible)")
        else:
            self.tray_icon.hide()
            print("鉁?[Tray] System tray icon initialized (hidden)")

    def set_minimize_to_tray(self, enabled: bool):
        """Apply minimize-to-tray setting immediately."""
        self.minimize_to_tray = bool(enabled)
        if not hasattr(self, 'tray_icon'):
            self._init_system_tray()
        if hasattr(self, 'tray_icon'):
            if self.minimize_to_tray:
                self.tray_icon.show()
                print("鉁?[Tray] Minimize-to-tray enabled (effective immediately)")
            else:
                self.tray_icon.hide()
                print("鉁?[Tray] Minimize-to-tray disabled (effective immediately)")

    def set_auto_start(self, enabled: bool):
        """Apply auto-start setting immediately on Windows registry."""
        enabled = bool(enabled)
        if sys.platform != 'win32':
            print("鈿狅笍 [AutoStart] Unsupported platform; only Windows is supported")
            return False, "unsupported platform"
        try:
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            app_name = "SparkSchedule"
            if getattr(sys, 'frozen', False):
                cmd = f'"{sys.executable}"'
            else:
                cmd = f'"{sys.executable}" "{os.path.abspath(__file__)}"'
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
            try:
                if enabled:
                    winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, cmd)
                    print(f"鉁?[AutoStart] Enabled: {cmd}")
                else:
                    try:
                        winreg.DeleteValue(key, app_name)
                        print("鉁?[AutoStart] Disabled")
                    except FileNotFoundError:
                        print("鈩癸笍 [AutoStart] Already disabled")
            finally:
                winreg.CloseKey(key)
            return True, ""
        except Exception as e:
            print(f"鉂?[AutoStart] Failed to apply: {e}")
            return False, str(e)

    def apply_runtime_settings(self, settings: dict):
        """Apply selected settings immediately at runtime."""
        if not isinstance(settings, dict):
            return
        if "minimize_to_tray" in settings:
            self.set_minimize_to_tray(settings.get("minimize_to_tray"))
        if "auto_start" in settings:
            self.set_auto_start(settings.get("auto_start"))
        if "start_minimized" in settings:
            self.start_minimized = bool(settings.get("start_minimized"))
        if "performance_overlay" in settings:
            self.set_performance_overlay(settings.get("performance_overlay"))
        if any(k in settings for k in ("enable_notifications", "notification_sound", "notification_volume")):
            self.set_notification_preferences(settings)
    
    def _on_tray_activated(self, reason):
        """澶勭悊鎵樼洏鍥炬爣婵€娲讳簨浠"""
        try:
            # PyQt6 涓?reason 鍙兘鏄?int 绫诲瀷
            if isinstance(reason, int):
                # Trigger = 3, DoubleClick = 2
                if reason in (2, 3):
                    self._show_main_window()
            else:
                if reason == QSystemTrayIcon.ActivationReason.Trigger or reason == QSystemTrayIcon.ActivationReason.DoubleClick:
                    self._show_main_window()
        except Exception as e:
            print(f"鈿狅笍 [Tray] Activation error: {e}")
            # 鍑洪敊鏃朵篃灏濊瘯鏄剧ず绐楀彛
            self._show_main_window()
    
    def _show_main_window(self):
        """鏄剧ず涓荤獥鍙"""
        self.show()
        self.showNormal()
        self.activateWindow()
        self.raise_()
        print("馃敿 [Tray] Main window restored")
    
    def _quit_application(self):
        """閫€鍑哄簲鐢ㄧ▼搴"""
        print("馃憢 [App] Quitting application")
        if hasattr(self, 'tray_icon'):
            self.tray_icon.hide()
        QApplication.quit()
    
    def closeEvent(self, event):
        """澶勭悊绐楀彛鍏抽棴浜嬩欢"""
        if self.minimize_to_tray and hasattr(self, 'tray_icon') and self.tray_icon.isVisible():
            # 鏈€灏忓寲鍒版墭鐩樿€屼笉鏄€€鍑?
            event.ignore()
            self.hide()
            self.tray_icon.showMessage(
                "Spark Schedule",
                "程序已最小化到系统托盘，双击托盘图标可恢复窗口",
                QSystemTrayIcon.MessageIcon.Information,
                2000
            )
            print("馃斀 [Tray] Window minimized to tray")
        else:
            # 姝ｅ父閫€鍑?
            event.accept()
            self._quit_application()
    
    def _on_feature_permission_requested(self, url, feature):
        """澶勭悊缃戦〉鏉冮檺璇锋眰锛堝湴鐞嗕綅缃€侀€氱煡绛夛級"""
        if feature == QWebEnginePage.Feature.Geolocation:
            print(f"馃搷 [WebEngine] 姝ｅ湪涓?{url.toString()} 鎺堟潈鍦扮悊位置鏉冮檺")
            self.sender().setFeaturePermission(
                url, 
                feature, 
                QWebEnginePage.PermissionPolicy.PermissionGrantedByUser
            )

    # ===== 鍐呭祵娴忚鍣ㄦ帶鍒舵柟娉?=====
    
    def open_web_browser_view(self, config_json_str):
        """鏍规嵁鍓嶇浼犳潵鐨勫潗鏍囨樉绀哄鍏ユ祻瑙堝櫒"""
        import json
        from PyQt6.QtCore import QRect
        
        try:
            config = json.loads(config_json_str)
            if config.get('visible'):
                x = int(config.get('x', 0))
                y = int(config.get('y', 0))
                w = int(config.get('width', 800))
                h = int(config.get('height', 600))
                
                # 馃敡 浼樺寲锛氱‘淇濅笉鎸′綇搴曢儴鎸夐挳锛屼繚鐣欒冻澶熺殑搴曢儴绌洪棿
                # 鍑忓皯楂樺害锛岀‘淇濆簳閮ㄦ寜閽彲瑙?
                h = max(400, h - 80)  # 鍑忓皯80px楂樺害锛岀‘淇濆簳閮ㄦ寜閽彲瑙?
                
                # 1. 鍏堣缃綅缃?
                # 璁剧疆涓轰富绐楀彛鐨勫瓙绐楀彛
                self.import_browser_view.setParent(self)
                self.import_browser_view.setWindowFlags(Qt.WindowType.Widget | Qt.WindowType.FramelessWindowHint)
                
                # 璁剧疆鍑犱綍位置
                self.import_browser_view.setGeometry(QRect(x, y, w, h))
                
                # 鏄剧ず娴忚鍣ㄨ鍥?
                self.import_browser_view.show()
                self.import_browser_view.raise_()
                
                # 2. 鍙湁褰?config 閲屾槑纭寘鍚?url 涓斾笉涓虹┖鏃讹紝鎵嶅姞杞界綉椤?
                # 杩欐牱 syncBrowserPosition 鍙戞潵鐨勭函鍧愭爣鍖呭氨涓嶄細瀵艰嚧鍒锋柊
                new_url = config.get('url')
                if new_url:
                    self.import_browser_view.setUrl(QUrl(new_url))
            else:
                self.import_browser_view.hide()
        except Exception as e:
            print(f"鉂?[Python] 璁剧疆娴忚鍣ㄤ綅缃け璐? {e}")

    def hide_web_browser_view(self):
        """闅愯棌鍐呭祵娴忚鍣ㄨ鍥"""
        try:
            if hasattr(self, 'import_browser_view') and self.import_browser_view:
                self.import_browser_view.hide()
        except Exception as e:
            print(f"⚠️ [Python] hide_web_browser_view failed: {e}")

    def load_url_in_browser(self, url):
        """鍦ㄥ唴宓屾祻瑙堝櫒涓姞杞経RL"""
        try:
            if hasattr(self, 'import_browser_view') and self.import_browser_view:
                self.import_browser_view.setUrl(QUrl(url))
        except Exception as e:
            print(f"⚠️ [Python] load_url_in_browser failed: {e}")

if __name__ == '__main__':
    # Enable high DPI support
    os.environ["QT_AUTO_SCREEN_SCALE_FACTOR"] = "1"
    prepare_webengine_env_from_settings()
    app = QApplication(sys.argv)
    
    # 璁剧疆搴旂敤绋嬪簭淇℃伅锛堢敤浜?Windows 浠诲姟鏍忓垎缁勶級
    app.setApplicationName("Spark Schedule")
    app.setApplicationDisplayName("Spark Schedule")
    app.setOrganizationName("Spark")
    
    window = ScholarApp()
    
    # 鏍规嵁璁剧疆鍐冲畾鏄惁鏄剧ず绐楀彛
    if not window.start_minimized or not window.minimize_to_tray:
        window.show()
    
    sys.exit(app.exec())
