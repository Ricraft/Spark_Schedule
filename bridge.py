# cleaned comment

import sys

import os

import json

import uuid

import webbrowser

import traceback

import time
import shutil
import subprocess
import base64
import hashlib

from datetime import date, datetime

from PyQt6.QtCore import QObject, pyqtSlot, pyqtSignal, QThread, QTimer

import threading

from concurrent.futures import ThreadPoolExecutor

import asyncio

# 导入日志系统
from logger_setup import logger



# cleaned comment
source_dir = os.path.dirname(os.path.abspath(__file__))
runtime_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else source_dir
# Backward-compatible alias used by existing code paths.
current_dir = source_dir



# cleaned comment

paths_to_add = [
    source_dir,
    os.path.join(source_dir, 'backend'),
    os.path.join(source_dir, 'src'),

]



for p in paths_to_add:

    if os.path.exists(p) and p not in sys.path:

        sys.path.insert(0, p)



# cleaned comment

try:

    # cleaned comment

    from backend.importers.qiangzhi_importer import QiangZhiImporter

    from backend.core.course_group_manager import CourseGroupManager

    from backend.core.settings_manager import SettingsManager

    from backend.core.task_manager import TaskManager

    from backend.models.course_base import CourseBase

    from backend.models.course_detail import CourseDetail

    from backend.utils.color_manager import ColorManager

    # IntegrationManager removed - has dependency issues, using fallback managers instead

    # from backend.importers.usc_importer import USCImporter

    logger.info("[Bridge] Successfully imported backend modules")

except ImportError as e:

    logger.warning(f"[Bridge] Import failed: {e} (trying relative imports)")

    try:

        from importers.qiangzhi_importer import QiangZhiImporter

        from core.course_group_manager import CourseGroupManager

        from core.settings_manager import SettingsManager

        from models.course_base import CourseBase

        from models.course_detail import CourseDetail

        from utils.color_manager import ColorManager

    except ImportError:

        logger.error("[Bridge] Failed to import modules, using cached data")



class AppBridge(QObject):

    # (comment)

    importProgress = pyqtSignal(str)  # cleaned comment

    scheduleLoaded = pyqtSignal(str)  # cleaned comment

    dataStateChanged = pyqtSignal(str)  # cleaned comment

    cacheUpdated = pyqtSignal(str)      # (comment)

    settingsChanged = pyqtSignal(str)   # (comment)

    

    # (comment)

    settingsUpdated = pyqtSignal(str)      # (comment)

    scheduleDataUpdated = pyqtSignal()     # (comment)

    

    # (comment)

    asyncOperationCompleted = pyqtSignal(str, str)  # (operation_id, result_json)

    asyncOperationFailed = pyqtSignal(str, str)     # (operation_id, error_message)

    asyncOperationProgress = pyqtSignal(str, int)   # (operation_id, percent)

    

    # (comment)

    loadingProgress = pyqtSignal(int, str)  # (progress_percent, status_message)

    
    # 澶╂皵鍜岃瘲璇嶆暟鎹洿鏂颁俊鍙?
    weatherDataUpdated = pyqtSignal(str)  # 天气数据更新 (JSON鏍煎紡)
    shiciDataUpdated = pyqtSignal(str)    # 诗词数据更新 (JSON鏍煎紡)
    

    _main_window_instance = None  # cleaned comment



    def __init__(self):

        super().__init__()

        # (comment)

        # Use writable runtime directory for packaged builds.
        self.data_dir = os.path.join(runtime_dir, 'data')

        if not os.path.exists(self.data_dir):

            os.makedirs(self.data_dir, exist_ok=True)

        self.courses_file = os.path.join(self.data_dir, 'courses.json')

        self.groups_file = os.path.join(self.data_dir, 'course_groups.json')

        self.settings_file = os.path.join(self.data_dir, 'settings.json')

        self.tasks_file = os.path.join(self.data_dir, 'tasks.json')



        # (comment)

        self.thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="BridgeWorker")

        self._operation_cache = {}  # (comment)
        self._cache_lock = threading.Lock()  # 馃敀 缂撳瓨閿佷繚鎶?



        # cleaned comment

        self.settings = {}

        self.integration_manager = None

        self.task_manager = None
        self.settings_manager = None
        self.course_group_manager = None
        self.color_manager = None
        self.backup_dir = os.path.join(self.data_dir, 'backups')
        os.makedirs(self.backup_dir, exist_ok=True)
        self._last_auto_backup_ts = 0.0
        self._auto_backup_timer = QTimer(self)
        self._auto_backup_timer.setInterval(15 * 60 * 1000)
        self._auto_backup_timer.timeout.connect(self._run_auto_backup_if_needed)
        self._auto_backup_timer.start()
        self._init_state_lock = threading.Lock()
        self._initialization_in_progress = False
        self._initialization_completed = False
        self._task_manager_init_lock = threading.Lock()
        self._task_manager_init_in_progress = False

        # Synchronous fallback init so settings APIs are available immediately.
        try:
            self.settings_manager = SettingsManager(self.settings_file)
            self.settings = self.settings_manager.get_settings_dict()
        except Exception as e:
            logger.warning(f"Synchronous settings init failed: {e}")
            self.settings = self.load_settings()

    def _success_response(self, message: str, data: dict | None = None, **extra) -> str:
        """Unified success response."""
        payload = {"status": "success", "message": message, "data": data or {}}
        payload.update(extra)
        return json.dumps(payload, ensure_ascii=False)

    def _error_response(self, message: str, error_code: str, **extra) -> str:
        """Unified error response."""
        payload = {"status": "error", "message": message, "error_code": error_code}
        payload.update(extra)
        return json.dumps(payload, ensure_ascii=False)

    def __del__(self):
        """Release thread pool resources."""
        try:
            if hasattr(self, 'thread_pool'):
                self.thread_pool.shutdown(wait=False, cancel_futures=True)
                logger.info("ThreadPool closed")
        except Exception as e:
            logger.info(f"娓呯悊璧勬簮澶辫触: {e}")

    def _submit_to_thread_pool(self, func, *args, context: str = "unknown", **kwargs):
        """Safely submit a task to the thread pool without raising to Qt caller."""
        try:
            return self.thread_pool.submit(func, *args, **kwargs)
        except RuntimeError as e:
            logger.error(f"[Bridge] ThreadPool rejected task ({context}): {e}")
            return None
        except Exception as e:
            logger.error(f"[Bridge] ThreadPool submit failed ({context}): {e}", exc_info=True)
            return None



    def _create_task_manager_instance(self):
        """Create a TaskManager instance."""
        from backend.core.task_manager import TaskManager
        return TaskManager(self.data_dir)

    def _task_manager_init_done(self, future, source: str):
        """Callback for async TaskManager initialization."""
        try:
            tm = future.result()
            self.task_manager = tm
            task_count = len(tm.tasks) if hasattr(tm, "tasks") else 0
            logger.info(f"[Bridge] TaskManager ready from {source} (tasks={task_count})")
        except Exception as e:
            logger.error(f"[Bridge] Async TaskManager init failed ({source}): {e}", exc_info=True)
        finally:
            with self._task_manager_init_lock:
                self._task_manager_init_in_progress = False

    def _start_task_manager_init_async(self, source: str) -> bool:
        """
        Start TaskManager initialization in background if needed.
        Returns True when task_manager is already available.
        """
        if self.task_manager is not None:
            return True

        with self._task_manager_init_lock:
            if self.task_manager is not None:
                return True
            if self._task_manager_init_in_progress:
                logger.info(f"[Bridge] TaskManager init already in progress ({source})")
                return False
            self._task_manager_init_in_progress = True

        logger.info(f"[Bridge] Task manager not ready, initializing asynchronously ({source})...")
        future = self._submit_to_thread_pool(
            self._create_task_manager_instance,
            context=f"task-manager-init:{source}"
        )
        if future is None:
            with self._task_manager_init_lock:
                self._task_manager_init_in_progress = False
            return False
        future.add_done_callback(lambda f: self._task_manager_init_done(f, source))
        return False

    def _init_task_manager_blocking(self, source: str) -> bool:
        """Initialize TaskManager in current thread (used inside worker threads)."""
        if self.task_manager is not None:
            return True

        with self._task_manager_init_lock:
            if self.task_manager is not None:
                return True
            if self._task_manager_init_in_progress:
                logger.info(f"[Bridge] TaskManager init already in progress ({source})")
                return False
            self._task_manager_init_in_progress = True

        try:
            tm = self._create_task_manager_instance()
            self.task_manager = tm
            task_count = len(tm.tasks) if hasattr(tm, "tasks") else 0
            logger.info(f"[Bridge] TaskManager initialized ({source}), tasks={task_count}")
            return True
        except Exception as e:
            logger.error(f"[Bridge] TaskManager init failed ({source}): {e}", exc_info=True)
            return False
        finally:
            with self._task_manager_init_lock:
                self._task_manager_init_in_progress = False

    def _task_manager_unavailable_response(self, include_tasks: bool = False) -> str:
        """Unified response when task manager is not ready yet."""
        payload = {
            "status": "error",
            "message": "Task manager is initializing, please retry in a moment"
        }
        if include_tasks:
            payload["tasks"] = []
        return json.dumps(payload, ensure_ascii=False)

    def _is_realtime_save_enabled(self) -> bool:
        """Read realtime-save switch from current settings; default enabled."""
        try:
            if hasattr(self, 'settings_manager') and self.settings_manager:
                cfg = self.settings_manager.get_settings_dict()
                return bool(cfg.get('auto_save', True))
        except Exception:
            pass
        return bool(self.settings.get('auto_save', True)) if isinstance(self.settings, dict) else True

    def _atomic_write_json(self, file_path: str, data_obj):
        """Durable write to disk using temp file + replace + fsync."""
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        temp_file = f"{file_path}.tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data_obj, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_file, file_path)
        if self._is_realtime_save_enabled():
            try:
                with open(file_path, 'r+b') as f:
                    os.fsync(f.fileno())
            except Exception:
                pass

    def _collect_data_snapshot(self) -> dict:
        """Collect main application data snapshot for backup/export."""
        try:
            snapshot = {
                "created_at": datetime.now().isoformat(),
                "schema": "spark_schedule_backup_v1",
                "data": {}
            }
            files = {
                "courses": self.courses_file,
                "tasks": self.tasks_file,
                "settings": self.settings_file,
                "course_groups": self.groups_file,
                "gpa_records": os.path.join(self.data_dir, 'gpa_records.json'),
                "daily_notes": os.path.join(self.data_dir, 'daily_notes.json'),
            }
            for key, path in files.items():
                try:
                    if os.path.exists(path):
                        with open(path, 'r', encoding='utf-8') as f:
                            snapshot["data"][key] = json.load(f)
                    else:
                        snapshot["data"][key] = [] if key in ("courses", "tasks", "course_groups", "gpa_records") else {}
                except Exception as e:
                    logger.info(f"Failed to collect {key} data: {e}")
                    snapshot["data"][key] = [] if key in ("courses", "tasks", "course_groups", "gpa_records") else {}
            return snapshot
        except Exception as e:
            logger.info(f"Critical error in _collect_data_snapshot: {e}")
            # Return minimal valid snapshot
            return {
                "created_at": datetime.now().isoformat(),
                "schema": "spark_schedule_backup_v1",
                "data": {}
            }

    def _encrypt_backup_payload(self, raw_bytes: bytes) -> bytes:
        """Encrypt bytes for .bak file. Prefer Fernet, fallback to xor stream."""
        try:
            from cryptography.fernet import Fernet
            key_file = os.path.join(self.backup_dir, 'backup.key')
            if os.path.exists(key_file):
                with open(key_file, 'rb') as f:
                    key = f.read().strip()
            else:
                key = Fernet.generate_key()
                with open(key_file, 'wb') as f:
                    f.write(key)
            return Fernet(key).encrypt(raw_bytes)
        except Exception:
            secret = hashlib.sha256((self.settings_file + self.data_dir).encode('utf-8')).digest()
            xored = bytes(b ^ secret[i % len(secret)] for i, b in enumerate(raw_bytes))
            return base64.b64encode(xored)

    def _create_encrypted_backup(self, reason: str = "auto") -> str:
        """Create encrypted .bak mirror file and return path."""
        try:
            snapshot = self._collect_data_snapshot()
            payload = json.dumps(snapshot, ensure_ascii=False).encode('utf-8')
            encrypted = self._encrypt_backup_payload(payload)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(self.backup_dir, f"snapshot_{reason}_{timestamp}.bak")
            
            # Ensure backup directory exists
            os.makedirs(self.backup_dir, exist_ok=True)
            
            with open(backup_path, 'wb') as f:
                f.write(encrypted)
                f.flush()
                os.fsync(f.fileno())
            
            logger.info(f"Backup created successfully: {backup_path}")
            return backup_path
        except Exception as e:
            logger.info(f"Failed to create encrypted backup: {e}")
            import traceback
            traceback.print_exc()
            # Return empty string to indicate failure
            return ""

    def _cleanup_backup_files(self, retention_days: int):
        """Cleanup old .bak backup files by retention days."""
        try:
            retention_days = max(1, int(retention_days))
            cutoff = time.time() - retention_days * 24 * 60 * 60
            for name in os.listdir(self.backup_dir):
                if not name.endswith('.bak'):
                    continue
                path = os.path.join(self.backup_dir, name)
                try:
                    if os.path.getmtime(path) < cutoff:
                        os.remove(path)
                except Exception:
                    pass
        except Exception:
            pass

    def _run_auto_backup_if_needed(self, force: bool = False):
        """Run periodic backup according to settings."""
        try:
            settings = self.settings_manager.get_settings_dict() if hasattr(self, 'settings_manager') and self.settings_manager else self.settings
            if not isinstance(settings, dict):
                logger.info("Invalid settings object, skipping backup")
                return
            if not settings.get('enable_auto_backup', True):
                return

            freq = settings.get('backup_freq', 'daily')
            if freq == 'manual' and not force:
                return

            now = datetime.now()
            marker_path = os.path.join(self.backup_dir, '.auto_backup_meta.json')
            last = {}
            if os.path.exists(marker_path):
                try:
                    with open(marker_path, 'r', encoding='utf-8') as f:
                        last = json.load(f)
                except Exception as e:
                    logger.info(f"Failed to read backup marker: {e}")
                    last = {}

            should_backup = force
            last_iso = str(last.get('last_backup_at', '')).strip()
            if not should_backup:
                if not last_iso:
                    should_backup = True
                else:
                    try:
                        last_dt = datetime.fromisoformat(last_iso)
                        if freq == 'daily':
                            should_backup = last_dt.date() != now.date()
                        elif freq == 'weekly':
                            should_backup = not (
                                last_dt.isocalendar()[0] == now.isocalendar()[0]
                                and last_dt.isocalendar()[1] == now.isocalendar()[1]
                            )
                        else:
                            should_backup = False
                    except Exception as e:
                        logger.info(f"Failed to parse last backup date: {e}")
                        should_backup = True

            if not should_backup:
                return

            backup_path = self._create_encrypted_backup("auto")
            
            # Only update marker if backup was successful
            if backup_path:
                try:
                    self._atomic_write_json(marker_path, {"last_backup_at": now.isoformat(), "last_backup_file": backup_path})
                    self._cleanup_backup_files(int(settings.get('backup_retention_days', 30)))
                    logger.info(f"Auto backup completed: {backup_path}")
                except Exception as e:
                    logger.info(f"Failed to update backup marker: {e}")
            else:
                logger.info("Backup creation failed, skipping marker update")
                
        except Exception as e:
            logger.info(f"Auto backup failed with exception: {e}")
            import traceback
            traceback.print_exc()

    @pyqtSlot()

    def perform_initialization(self):
        """Execute async initialization and emit progress signals."""
        with self._init_state_lock:
            if self._initialization_in_progress:
                logger.info("Initialization request ignored: already in progress")
                return
            if self._initialization_completed:
                logger.info("Initialization request ignored: already completed")
                self.loadingProgress.emit(100, "Initialization already complete")
                return
            self._initialization_in_progress = True

        def run_init():
            init_ok = False
            try:
                logger.info("========== INITIALIZATION START ==========")
                self.loadingProgress.emit(10, "Loading user configuration...")
                self.settings = self.load_settings()
                logger.info("Settings loaded")

                os.makedirs(self.data_dir, exist_ok=True)
                logger.info(f"Data directory: {self.data_dir}")

                self.loadingProgress.emit(30, "Initializing managers...")

                # Integration manager is intentionally disabled in runtime path.
                self.integration_manager = None

                try:
                    logger.info("Initializing standalone managers...")
                    from backend.core.course_group_manager import CourseGroupManager
                    from backend.utils.color_manager import ColorManager
                    from backend.core.settings_manager import SettingsManager

                    self.color_manager = ColorManager()
                    logger.info("? ColorManager initialized")

                    self.course_group_manager = CourseGroupManager()
                    logger.info("? CourseGroupManager initialized")

                    self.settings_manager = SettingsManager(self.settings_file)
                    logger.info("? SettingsManager initialized")

                    if not self._init_task_manager_blocking("startup"):
                        logger.warning("TaskManager startup init failed; scheduling async retry")
                        self._start_task_manager_init_async("startup-fallback")

                except Exception as e:
                    logger.error(f"Manager initialization failed: {e}", exc_info=True)

                    if self.color_manager is None:
                        try:
                            from backend.utils.color_manager import ColorManager
                            self.color_manager = ColorManager()
                            logger.info("Emergency ColorManager created")
                        except Exception as cm_error:
                            logger.critical(f"Failed to create ColorManager: {cm_error}")

                    if self.course_group_manager is None:
                        try:
                            from backend.core.course_group_manager import CourseGroupManager
                            self.course_group_manager = CourseGroupManager()
                            logger.info("Emergency CourseGroupManager created")
                        except Exception as cgm_error:
                            logger.critical(f"Failed to create CourseGroupManager: {cgm_error}")

                    if self.task_manager is None:
                        self._start_task_manager_init_async("startup-emergency")

                logger.info("========== MANAGER STATUS ==========")
                logger.info(f"task_manager: {'ready' if self.task_manager else 'missing'}")
                logger.info(f"course_group_manager: {'ready' if self.course_group_manager else 'missing'}")
                logger.info(f"color_manager: {'ready' if self.color_manager else 'missing'}")
                logger.info(f"settings_manager: {'ready' if self.settings_manager else 'missing'}")
                logger.info("====================================")

                self.loadingProgress.emit(80, "Loading course groups...")
                try:
                    self._load_groups_from_file()
                    logger.info("Course groups loaded")
                except Exception as e:
                    logger.error(f"Failed to load groups: {e}")

                logger.info("Running auto backup check...")
                try:
                    self._run_auto_backup_if_needed()
                    logger.info("Auto backup check complete")
                except Exception as e:
                    logger.error(f"Auto backup failed: {e}")

                self.loadingProgress.emit(100, "Initialization complete")
                logger.info("========== INITIALIZATION COMPLETE ==========")
                init_ok = True

            except Exception as e:
                logger.critical(f"Initialization crashed: {e}", exc_info=True)
                self.loadingProgress.emit(100, "Load error, attempting recovery...")
            finally:
                with self._init_state_lock:
                    self._initialization_in_progress = False
                    if init_ok:
                        self._initialization_completed = True

        logger.info("Submitting initialization to thread pool...")
        future = self._submit_to_thread_pool(run_init, context="perform_initialization")
        if future is None:
            with self._init_state_lock:
                self._initialization_in_progress = False
            self.loadingProgress.emit(100, "Initialization unavailable: background worker is closed")


    def _run_async_operation(self, operation_id: str, operation_func, *args, **kwargs):

        """Run time-consuming operations in background thread"""

        def progress(p: int):

            """Run time-consuming operations in background thread"""

            p = max(0, min(100, int(p)))

            self.asyncOperationProgress.emit(operation_id, p)



        def worker():

            try:

                logger.info(f"Start background operation: {operation_id}")

                # cleaned comment

                result = operation_func(*args, progress_callback=progress, **kwargs)



                # 馃敀 浣跨敤閿佷繚鎶ょ紦瀛樺啓鍏?
                with self._cache_lock:
                    self._operation_cache[operation_id] = {

                        'result': result,

                        'timestamp': datetime.now().isoformat(),

                        'status': 'success'

                    }



                # cleaned comment

                self.asyncOperationCompleted.emit(operation_id, json.dumps(result, ensure_ascii=False))

                logger.info(f"Background operation complete: {operation_id}")



            except Exception as e:

                error_msg = f"Background operation failed: {str(e)}"

                logger.info(f"{operation_id} - {error_msg}")



                # 馃敀 浣跨敤閿佷繚鎶ょ紦瀛樺啓鍏?
                with self._cache_lock:
                    self._operation_cache[operation_id] = {

                        'error': error_msg,

                        'timestamp': datetime.now().isoformat(),

                        'status': 'error'

                    }



                # cleaned comment

                self.asyncOperationFailed.emit(operation_id, error_msg)



        # (comment)

        future = self._submit_to_thread_pool(worker, context=f"async-op:{operation_id}")
        if future is None:
            error_msg = "Background worker unavailable (thread pool is closed)"
            with self._cache_lock:
                self._operation_cache[operation_id] = {
                    'error': error_msg,
                    'timestamp': datetime.now().isoformat(),
                    'status': 'error'
                }
            self.asyncOperationFailed.emit(operation_id, error_msg)

        return operation_id



    def load_settings(self):

        """Load settings from storage."""

        try:

            if os.path.exists(self.settings_file):

                with open(self.settings_file, 'r', encoding='utf-8') as f:

                    return json.load(f)

            else:

                # (comment)

                from backend.models.schedule_settings import ScheduleSettings

                default_settings = ScheduleSettings()

                return default_settings.to_dict()

        except Exception as e:

            logger.info(f"Failed to load settings: {e}")

            # (comment)

            from backend.models.schedule_settings import ScheduleSettings

            default_settings = ScheduleSettings()

            return default_settings.to_dict()



    def set_main_window(self, window):

        """Set main window instance for embedded browser control."""

        self._main_window_instance = window

    @pyqtSlot(result=str)
    def open_frontend_devtools(self):
        """Open/focus embedded frontend DevTools window."""
        try:
            if not self._main_window_instance:
                return self._error_response("鏈娴嬪埌涓荤獥鍙ｅ疄渚嬶紝鏃犳硶鎵撳紑 DevTools", "MAIN_WINDOW_NOT_READY")
            ok = self._main_window_instance.open_frontend_devtools()
            if ok:
                return self._success_response("鍓嶇寮€鍙戣€呭伐鍏峰凡鎵撳紑", data={"target": "frontend_devtools"})
            return self._error_response("Open frontend devtools failed", "DEVTOOLS_OPEN_FAILED")
        except Exception as e:
            return self._error_response(f"鎵撳紑鍓嶇寮€鍙戣€呭伐鍏峰け璐? {str(e)}", "DEVTOOLS_OPEN_EXCEPTION")

    @pyqtSlot(result=str)
    def open_python_console(self):
        """Open/focus backend Python console window."""
        try:
            if not self._main_window_instance:
                return self._error_response("鏈娴嬪埌涓荤獥鍙ｅ疄渚嬶紝鏃犳硶鎵撳紑 Python 缁堢", "MAIN_WINDOW_NOT_READY")
            ok = self._main_window_instance.open_backend_console()
            if ok:
                return self._success_response("鍚庣 Python 缁堢宸叉墦寮€", data={"target": "python_console"})
            return self._error_response("鎵撳紑鍚庣 Python 缁堢澶辫触", "PY_CONSOLE_OPEN_FAILED")
        except Exception as e:
            return self._error_response(f"鎵撳紑鍚庣 Python 缁堢澶辫触: {str(e)}", "PY_CONSOLE_OPEN_EXCEPTION")



    @pyqtSlot(str, str, bool, int, result=str)
    def send_desktop_notification(self, title, message, play_sound=True, timeout_ms=5000):
        """Send native desktop notification through main window tray."""
        try:
            if not self._main_window_instance:
                return self._error_response("Main window not ready", "MAIN_WINDOW_NOT_READY")
            ok = self._main_window_instance.show_native_notification(
                str(title),
                str(message),
                bool(play_sound),
                int(timeout_ms)
            )
            if ok:
                return self._success_response("Notification sent")
            return self._error_response("Failed to show desktop notification", "NOTIFICATION_FAILED")
        except Exception as e:
            return self._error_response(f"Failed to show desktop notification: {str(e)}", "NOTIFICATION_EXCEPTION")

    @pyqtSlot(str, result=str)
    def open_external_url(self, url):
        """Open URL in system default external browser."""
        try:
            target = str(url or "").strip()
            if not target:
                return self._error_response("URL 不能为空", "INVALID_URL")
            if not (target.startswith("http://") or target.startswith("https://")):
                return self._error_response("仅支持 http/https 链接", "INVALID_URL_SCHEME")

            opened = False
            try:
                opened = bool(webbrowser.open(target, new=2))
            except Exception as e:
                logger.warning(f"[Bridge] webbrowser.open failed: {e}")

            if not opened and sys.platform == "win32":
                try:
                    os.startfile(target)  # type: ignore[attr-defined]
                    opened = True
                except Exception as e:
                    logger.warning(f"[Bridge] os.startfile failed: {e}")

            if opened:
                return self._success_response("已在外部浏览器打开", data={"url": target})
            return self._error_response("无法打开外部浏览器", "OPEN_EXTERNAL_URL_FAILED")
        except Exception as e:
            return self._error_response(f"打开外部链接失败: {str(e)}", "OPEN_EXTERNAL_URL_EXCEPTION")

    @pyqtSlot(result=str)
    def check_updates(self):
        """
        Check update availability from local manifest files.
        Manifest format example:
        {
          "available": true,
          "version": "v1.2.6",
          "changelog": ["item1", "item2"]
        }
        """
        try:
            manifest_paths = [
                os.path.join(runtime_dir, "update_manifest.json"),
                os.path.join(self.data_dir, "update_manifest.json"),
            ]
            manifest = None
            source_path = None

            for path in manifest_paths:
                if os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as f:
                        manifest = json.load(f)
                    source_path = path
                    break

            if isinstance(manifest, dict):
                available = bool(manifest.get("available", False))
                version = str(manifest.get("version") or "")
                raw_changelog = manifest.get("changelog", [])
                changelog = raw_changelog if isinstance(raw_changelog, list) else []
                return json.dumps(
                    {
                        "status": "success",
                        "available": available,
                        "version": version,
                        "changelog": changelog,
                        "source": source_path,
                    },
                    ensure_ascii=False,
                )

            return json.dumps(
                {
                    "status": "success",
                    "available": False,
                    "version": "",
                    "changelog": [],
                    "message": "No update manifest found",
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps(
                {
                    "status": "error",
                    "available": False,
                    "message": f"检查更新失败: {str(e)}",
                },
                ensure_ascii=False,
            )

    @pyqtSlot(result=str)
    def restart_app(self):
        """Spawn a new app process and quit current process."""
        try:
            if getattr(sys, "frozen", False):
                cmd = [sys.executable] + list(sys.argv[1:])
                cwd = os.path.dirname(sys.executable)
            else:
                main_script = os.path.join(source_dir, "main.py")
                if os.path.exists(main_script):
                    cmd = [sys.executable, main_script] + list(sys.argv[1:])
                else:
                    cmd = [sys.executable] + list(sys.argv)
                cwd = source_dir

            subprocess.Popen(cmd, cwd=cwd)
            logger.info(f"[Bridge] Restart command spawned: {cmd}")

            def _quit_current():
                try:
                    if self._main_window_instance and hasattr(self._main_window_instance, "_quit_application"):
                        self._main_window_instance._quit_application()
                        return
                except Exception:
                    pass

                try:
                    from PyQt6.QtWidgets import QApplication
                    QApplication.quit()
                except Exception:
                    os._exit(0)

            QTimer.singleShot(200, _quit_current)
            return self._success_response("应用即将自动重启")
        except Exception as e:
            logger.error(f"[Bridge] Restart failed: {e}", exc_info=True)
            return self._error_response(f"重启失败: {str(e)}", "RESTART_FAILED")

    # =========================================================================

    # (comment)

    # =========================================================================

    

    def _ensure_course_group_manager(self) -> bool:
        """Make sure course_group_manager exists before group operations."""
        if self.course_group_manager is not None:
            return True
        try:
            from backend.core.course_group_manager import CourseGroupManager
        except Exception:
            try:
                from core.course_group_manager import CourseGroupManager
            except Exception as e:
                logger.info(f"CourseGroupManager import failed: {e}")
                return False
        try:
            self.course_group_manager = CourseGroupManager()
            return True
        except Exception as e:
            logger.info(f"CourseGroupManager init failed: {e}")
            return False

    def _load_groups_from_file(self):

        """Load course groups from file."""

        if not self._ensure_course_group_manager():
            return

        if os.path.exists(self.groups_file):

            try:

                with open(self.groups_file, 'r', encoding='utf-8') as f:

                    groups_data = json.load(f)

                

                # (comment)

                for group_data in groups_data:

                    from backend.models.course_group import CourseGroup

                    from datetime import datetime

                    

                    group = CourseGroup(

                        id=group_data['id'],

                        name=group_data['name'],

                        teacher=group_data['teacher'],

                        location=group_data['location'],

                        color=group_data['color'],

                        course_ids=set(group_data['course_ids']),

                        created_at=datetime.fromisoformat(group_data['created_at']),

                        updated_at=datetime.fromisoformat(group_data['updated_at'])

                    )

                    self.course_group_manager.groups[group.id] = group

                    

                logger.info(f"Loaded {len(groups_data)} course groups")

            except Exception as e:

                logger.info(f"Failed to load settings: {e}")

    

    def _save_groups_to_file(self):

        """Save course groups to file."""

        if not self._ensure_course_group_manager():
            logger.info("Save skipped: course_group_manager unavailable")
            return False

        try:

            groups_data = []

            for group in self.course_group_manager.groups.values():

                group_dict = {

                    'id': group.id,

                    'name': group.name,

                    'teacher': group.teacher,

                    'location': group.location,

                    'color': group.color,

                    'course_ids': list(group.course_ids),

                    'created_at': group.created_at.isoformat(),

                    'updated_at': group.updated_at.isoformat()

                }

                groups_data.append(group_dict)

            

            self._atomic_write_json(self.groups_file, groups_data)

                

            logger.info(f"Saved {len(groups_data)} course groups")

            return True

        except Exception as e:

            logger.info(f"Save failed: {e}")

            return False

    

    @pyqtSlot(result=str)

    def get_courses_with_metadata(self):

        """Return courses with metadata (optimized, with cache)."""

        try:

            # cleaned comment

            cache_key = 'courses_with_metadata'

            if cache_key in self._operation_cache:

                cached = self._operation_cache[cache_key]

                cache_time = datetime.fromisoformat(cached['timestamp'])

                

                # cleaned comment

                if (datetime.now() - cache_time).total_seconds() < 300:

                    if cached['status'] == 'success':

                        logger.info("Using cached data")

                        return json.dumps(cached['result'], ensure_ascii=False)

            

            # (comment)

            return self._get_courses_with_metadata_sync()

            

        except Exception as e:

            error_msg = f"Failed to get course metadata: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"error": error_msg}, ensure_ascii=False)

    

    @pyqtSlot(result=str)

    def get_courses_with_metadata_async(self):

        """Run time-consuming operations in background thread"""

        try:
            operation_id = f"courses_metadata_{int(datetime.now().timestamp())}"
            self._run_async_operation(operation_id, self._get_courses_with_metadata_heavy)
            return json.dumps({"operation_id": operation_id, "status": "processing"}, ensure_ascii=False)
        except Exception as e:
            logger.error(f"get_courses_with_metadata_async failed: {e}", exc_info=True)
            return json.dumps({
                "status": "error",
                "message": "Background worker unavailable"
            }, ensure_ascii=False)

    

    def _get_courses_with_metadata_sync(self):

        """Run time-consuming operations in background thread"""

        # (comment)

        courses_data = self.get_courses()

        if not courses_data or courses_data == "[]":

            return json.dumps({

                "courses": [],

                "groups": [],

                "metadata": {

                    "version": "1.0",

                    "timestamp": datetime.now().isoformat(),

                    "total_courses": 0,

                    "total_groups": 0

                }

            }, ensure_ascii=False)

        

        courses = json.loads(courses_data)

        

        # (comment)

        groups_data = []

        for group in list(self.course_group_manager.groups.values())[:10]:  # (comment)

            group_dict = {

                'id': group.id,

                'name': group.name,

                'teacher': group.teacher,

                'location': group.location,

                'color': group.color,

                'course_count': len(group.course_ids)

            }

            groups_data.append(group_dict)

        

        # (comment)

        course_group_map = {}

        for group in self.course_group_manager.groups.values():

            for course_id in group.course_ids:

                course_group_map[course_id] = group.id

        

        for course in courses:

            course_id = course.get('id')

            course['groupId'] = course_group_map.get(course_id)

        

        result = {

            "courses": courses,

            "groups": groups_data,

            "metadata": {

                "version": "1.0",

                "timestamp": datetime.now().isoformat(),

                "total_courses": len(courses),

                "total_groups": len(groups_data),

                "is_partial": len(self.course_group_manager.groups) > 10

            }

        }

        

        return json.dumps(result, ensure_ascii=False)

    

    def _get_courses_with_metadata_heavy(self):

        """Heavy metadata fetch in background thread."""

        # (comment)

        courses_data = self.get_courses()

        if not courses_data or courses_data == "[]":

            return {

                "courses": [],

                "groups": [],

                "metadata": {

                    "version": "1.0",

                    "timestamp": datetime.now().isoformat(),

                    "total_courses": 0,

                    "total_groups": 0

                }

            }

        

        courses = json.loads(courses_data)

        

        # (comment)

        groups_data = []

        for group in self.course_group_manager.groups.values():

            group_dict = {

                'id': group.id,

                'name': group.name,

                'teacher': group.teacher,

                'location': group.location,

                'color': group.color,

                'course_count': len(group.course_ids),

                'created_at': group.created_at.isoformat(),

                'updated_at': group.updated_at.isoformat()

            }

            groups_data.append(group_dict)

        

        # cleaned comment

        for course in courses:

            course_id = course.get('id')

            if course_id:

                group_id = self.course_group_manager.get_course_group_id(course_id)

                course['groupId'] = group_id

        

        result = {

            "courses": courses,

            "groups": groups_data,

            "metadata": {

                "version": "1.0",

                "timestamp": datetime.now().isoformat(),

                "total_courses": len(courses),

                "total_groups": len(groups_data),

                "is_complete": True

            }

        }

        

        return result

    

    @pyqtSlot(str, result=str)
    def analyze_task_with_ai(self, user_input):
        """Use AI to parse user input into structured tasks with robust categorization and context awareness."""
        try:
            if not user_input or not str(user_input).strip():
                return json.dumps({"status": "error", "message": "杈撳叆鍐呭涓嶈兘涓虹┖"}, ensure_ascii=False)

            # 1. 鍔犺浇閰嶇疆
            try:
                settings = self.settings_manager.get_settings_dict() if self.settings_manager else self.load_settings()
            except Exception:
                settings = self.load_settings()

            # 优先使用任务解析专用配置，兼容历史通用字段
            task_parsing_enabled = settings.get('ai_task_parsing_enabled', True)
            if task_parsing_enabled is False:
                logger.info("[AI] ai_task_parsing_enabled is false, but analyze_task_with_ai was called; continue for compatibility")

            api_key = str(settings.get('ai_task_api_key') or settings.get('ai_api_key') or '').strip()
            if not api_key:
                return json.dumps({"status": "error", "message": "请先在设置中配置 AI 任务解析 API Key"}, ensure_ascii=False)

            base_url = str(settings.get('ai_task_base_url') or settings.get('ai_base_url') or 'https://api.openai.com/v1').strip()
            model = str(settings.get('ai_task_model') or settings.get('ai_model') or 'gpt-3.5-turbo').strip()
            
            # 2. 鏋勯€犲寮哄瀷涓婁笅鏂?
            now = datetime.now()
            weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            context_info = {
                "current_time": now.strftime("%Y-%m-%d %H:%M"),
                "day_of_week": weekdays[now.weekday()],
                "courses": [],
                "semester_info": {}
            }
            
            try:
                courses_data = self.get_courses()
                if courses_data and courses_data != "[]":
                    courses = json.loads(courses_data)
                    course_names = list(set([c.get('name', '') for c in courses if c.get('name')]))
                    context_info["courses"] = sorted(course_names)[:30] 
            except Exception as e:
                logger.warning(f"[AI] Failed to collect course context: {e}")

            # 3. 鏋勯€犵簿缁嗗寲 System Prompt
            system_prompt = str(settings.get('ai_task_prompt') or settings.get('ai_system_prompt') or '').strip()
            if not system_prompt:
                system_prompt = (
                    "浣犳槸涓€涓笓涓氱殑鏃ョ▼浠诲姟鎻愬彇鍔╂墜銆傝灏嗙敤鎴风殑鑷劧璇█杈撳叆杞崲涓烘爣鍑嗙殑 JSON 浠诲姟鏁扮粍銆俓n"
                    "銆愪弗鏍煎瓧娈靛畾涔夈€戯細\n"
                    "- title: 浠诲姟绠€鐭爣棰榎n"
                    "- course_name: 濡傛灉鏄绋嬬浉鍏充换鍔★紝蹇呴』浠?'Available courses' 涓€夋嫨鏈€鍖归厤鐨勫悕绉帮紱鍚﹀垯濉?'Personal'銆俓n"
                    "- deadline: 鎴鏃堕棿锛屾牸寮忎负 'YYYY-MM-DD HH:mm'銆傚埄鐢?current_time 瑙ｆ瀽鐩稿鏃堕棿锛堝'鏄庡ぉ'銆?涓嬪懆浜?锛夈€俓n"
                    "- priority: 浼樺厛绾э紝浠?[normal, high, urgent] 涓€夋嫨銆傜揣鎬ユ垨蹇呴』瀹屾垚鐨勪换鍔¤涓?high/urgent銆俓n"
                    "- is_exam: 甯冨皵鍊硷紝鏄惁涓鸿€冭瘯銆佹祴璇曟垨鏋侀噸瑕佺殑鎴鏃ユ湡銆俓n"
                    "- tags: 瀛楃涓叉暟缁勶紝鐢ㄤ簬褰掔被銆備緥濡?['鐢熸椿'], ['杩愬姩'], ['瀛︿範'], ['宸ヤ綔'], ['绀句氦'] 绛夈€俓n"
                    "- description: 浠诲姟璇︾粏鎻忚堪鎴栧娉ㄣ€俓n"
                    "銆愰€昏緫瑕佹眰銆戯細\n"
                    "1. 蹇呴』杩斿洖 JSON 鏁扮粍鏍煎紡锛歔{...}]\n"
                    "2. 鍗充娇鍙湁涓€涓换鍔′篃蹇呴¶鍖呰鍦ㄦ暟缁勪腑銆俓n"
                    "3. 濡傛灉杈撳叆鍖呭惈澶氫釜浠诲姟锛岃鍑嗙‘鎷嗗垎銆俓n"
                    "4. 浠呰緭鍑?JSON锛屼笉瑕佸寘鍚换浣曡В閲婃€ф枃瀛椼€俓n"
                )

            # 4. API URL 褰掍竴鍖?
            api_url = base_url.rstrip('/')
            if not any(endpoint in api_url.lower() for endpoint in ['/chat/completions', '/v1/chat', '/api/chat']):
                if not api_url.endswith('/v1'): api_url = f"{api_url}/v1"
                api_url = f"{api_url}/chat/completions"

            # 5. 鍑嗗璇锋眰 Payload
            user_message = (
                f"User Input: \"{user_input}\"\n\n"
                f"Context:\n"
                f"- Current Time: {context_info['current_time']} ({context_info['day_of_week']})\n"
                f"- Available Courses: {', '.join(context_info['courses']) if context_info['courses'] else 'None'}\n"
            )
            
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "temperature": 0.1,
            }

            # 6. 璋冪敤 API
            import requests
            import re
            
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            response = requests.post(api_url, headers=headers, json=payload, timeout=30)
            
            if response.status_code != 200:
                return json.dumps({"status": "error", "message": f"AI鏈嶅姟璇锋眰澶辫触({response.status_code})"}, ensure_ascii=False)

            ai_content = response.json().get('choices', [{}])[0].get('message', {}).get('content', '').strip()
            
            # 7. 鍋ュ．鐨?JSON 鎻愬彇
            json_str = ai_content
            if "```json" in ai_content:
                json_str = ai_content.split("```json", 1)[1].split("```", 1)[0].strip()
            elif "```" in ai_content:
                json_str = ai_content.split("```", 1)[1].split("```", 1)[0].strip()
            else:
                # 灏濊瘯鐢ㄦ鍒欏尮閰嶆暟缁勮竟鐣?
                match = re.search(r'(\[[\s\S]*\])', ai_content)
                if match: json_str = match.group(1)

            try:
                task_data = json.loads(json_str)
                if isinstance(task_data, dict): task_data = [task_data]
            except Exception:
                return json.dumps({"status": "error", "message": "AI 返回格式异常，解析失败"}, ensure_ascii=False)

            # 8. 规范化与数据补全
            normalized_tasks = []
            for idx, task in enumerate(task_data):
                # 琛ュ叏 deadline 鏍煎紡
                deadline = str(task.get("deadline", "")).strip()
                if deadline and len(deadline) == 10:  # 鍙湁鏃ユ湡 YYYY-MM-DD
                    deadline += " 23:59"
                
                # 澶勭悊璇剧▼鍚嶇О閫昏緫
                course_name = str(task.get("course_name", "Personal")).strip()
                if course_name.lower() == "personal" or not course_name:
                    course_name = ""
                
                normalized = {
                    "id": str(uuid.uuid4()),
                    "title": str(task.get("title", "")).strip() or f"鏂颁换鍔?{idx+1}",
                    "course_name": course_name,
                    "deadline": deadline,
                    "priority": str(task.get("priority", "normal")).lower(),
                    "is_exam": bool(task.get("is_exam", False)),
                    "tags": task.get("tags", []),
                    "description": str(task.get("description", "")).strip(),
                    "status": "todo"
                }
                normalized_tasks.append(normalized)

            return json.dumps({
                "status": "success", 
                "data": normalized_tasks,
                "ai_info": {
                    "model": model,
                    "count": len(normalized_tasks),
                    "context_time": context_info['current_time'],
                    "context_used": context_info,
                    "raw_response": ai_content[:2000],
                }
            }, ensure_ascii=False)

        except Exception as e:
            logger.info(f"[AI] Task parse error: {e}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": f"绯荤粺寮傚父: {str(e)}"}, ensure_ascii=False)


    @pyqtSlot(str, result=str)
    def get_learning_suggestions_with_ai(self, context_json):
        """Use AI to generate 1-3 learning suggestions based on runtime context."""
        try:
            # 1) Parse runtime context from frontend (best effort).
            context_data = {}
            if context_json and str(context_json).strip():
                try:
                    context_data = json.loads(context_json)
                except Exception:
                    context_data = {}
            if not isinstance(context_data, dict):
                context_data = {}

            # 2) Load settings.
            try:
                settings = self.settings_manager.get_settings_dict() if self.settings_manager else self.load_settings()
            except Exception:
                settings = self.load_settings()

            learning_enabled = bool(settings.get('ai_learning_enabled', False))
            if not learning_enabled:
                logger.info("[AI] ai_learning_enabled is false, but get_learning_suggestions_with_ai was called; continue for compatibility")

            api_key = str(settings.get('ai_learning_api_key') or settings.get('ai_api_key') or '').strip()
            if not api_key:
                return json.dumps({"status": "error", "message": "请先在设置中配置 AI 学习助手 API Key"}, ensure_ascii=False)

            base_url = str(settings.get('ai_learning_base_url') or settings.get('ai_base_url') or 'https://api.openai.com/v1').strip()
            model = str(settings.get('ai_learning_model') or settings.get('ai_model') or 'gpt-4o-mini').strip()
            system_prompt = str(settings.get('ai_learning_prompt') or '').strip()
            if not system_prompt:
                system_prompt = (
                    "你是一个学习规划顾问。请基于输入上下文给出 1-3 条可执行、简短、可落地的学习建议。"
                    "必须只输出 JSON 数组。每个元素包含字段："
                    "title, content, tag, icon_type, tone。"
                    "icon_type 仅允许：Target, AlertCircle, Cloud, CheckCircle2, Sparkles。"
                    "tone 仅允许：focus, risk, environment, progress, neutral。"
                    "禁止输出 Markdown 或解释文本。"
                )

            # 3) Normalize endpoint.
            api_url = base_url.rstrip('/')
            if not any(endpoint in api_url.lower() for endpoint in ['/chat/completions', '/v1/chat', '/api/chat']):
                if not api_url.endswith('/v1'):
                    api_url = f"{api_url}/v1"
                api_url = f"{api_url}/chat/completions"

            # 4) Build payload.
            now = datetime.now().strftime("%Y-%m-%d %H:%M")
            compact_context = {
                "current_time": now,
                "week_hours": context_data.get("week_hours"),
                "week_goal_hours": context_data.get("week_goal_hours"),
                "task_stats": context_data.get("task_stats", {}),
                "this_week_courses": context_data.get("this_week_courses"),
                "weather": context_data.get("weather", {}),
                "next_class": context_data.get("next_class", {}),
                "focus_state": context_data.get("focus_state", {}),
            }

            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(compact_context, ensure_ascii=False)},
                ],
                "temperature": 0.3,
            }

            # 5) Request AI service.
            import requests
            import re

            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            response = requests.post(api_url, headers=headers, json=payload, timeout=30)
            if response.status_code != 200:
                return json.dumps({"status": "error", "message": f"AI学习建议请求失败({response.status_code})"}, ensure_ascii=False)

            ai_content = response.json().get('choices', [{}])[0].get('message', {}).get('content', '')
            ai_content = str(ai_content or '').strip()
            if not ai_content:
                return json.dumps({"status": "error", "message": "AI 返回为空"}, ensure_ascii=False)

            # 6) Extract JSON.
            json_str = ai_content
            if "```json" in ai_content:
                json_str = ai_content.split("```json", 1)[1].split("```", 1)[0].strip()
            elif "```" in ai_content:
                json_str = ai_content.split("```", 1)[1].split("```", 1)[0].strip()
            else:
                match = re.search(r'(\[[\s\S]*\])', ai_content)
                if match:
                    json_str = match.group(1)

            try:
                parsed = json.loads(json_str)
                if isinstance(parsed, dict):
                    parsed = [parsed]
            except Exception:
                return json.dumps({"status": "error", "message": "AI 返回格式异常，解析失败"}, ensure_ascii=False)

            if not isinstance(parsed, list):
                return json.dumps({"status": "error", "message": "AI 返回格式异常，非数组"}, ensure_ascii=False)

            # 7) Normalize items for frontend.
            allowed_icons = {"Target", "AlertCircle", "Cloud", "CheckCircle2", "Sparkles"}
            icon_color_map = {
                "Target": "text-indigo-600",
                "AlertCircle": "text-rose-600",
                "Cloud": "text-blue-600",
                "CheckCircle2": "text-emerald-600",
                "Sparkles": "text-amber-500",
            }
            tone_style_map = {
                "focus": ("bg-indigo-50/50", "border-indigo-100"),
                "risk": ("bg-rose-50/50", "border-rose-100"),
                "environment": ("bg-blue-50/50", "border-blue-100"),
                "progress": ("bg-emerald-50/50", "border-emerald-100"),
                "neutral": ("bg-white", "border-slate-100"),
            }

            normalized = []
            for item in parsed[:3]:
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title") or "").strip()
                content = str(item.get("content") or item.get("description") or "").strip()
                if not title or not content:
                    continue
                icon_type = str(item.get("iconType") or item.get("icon_type") or "Sparkles").strip()
                if icon_type not in allowed_icons:
                    icon_type = "Sparkles"

                tone = str(item.get("tone") or "neutral").strip().lower()
                bg, border = tone_style_map.get(tone, tone_style_map["neutral"])
                tag = str(item.get("tag") or "AI Suggestion").strip()[:32]

                normalized.append({
                    "iconType": icon_type,
                    "iconColor": icon_color_map.get(icon_type, "text-amber-500"),
                    "title": title[:48],
                    "content": content[:240],
                    "tag": tag,
                    "bg": bg,
                    "border": border,
                })

            if not normalized:
                return json.dumps({"status": "error", "message": "AI 返回内容不符合建议格式"}, ensure_ascii=False)

            return json.dumps({
                "status": "success",
                "data": normalized,
                "ai_info": {
                    "model": model,
                    "count": len(normalized),
                    "context_time": now,
                    "source": "remote",
                    "raw_response": ai_content[:2000],
                }
            }, ensure_ascii=False)

        except Exception as e:
            logger.info(f"[AI] Learning suggestion error: {e}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": f"系统异常: {str(e)}"}, ensure_ascii=False)



    @pyqtSlot(str, result=str)

    def save_course_with_grouping(self, course_json):

        """Run time-consuming operations in background thread"""

        try:

            course_data = json.loads(course_json)

            

            # (comment)

            if not course_data.get('id'):

                course_data['id'] = str(uuid.uuid4())

            

            # cleaned comment

            if self.integration_manager:

                success, message, course_id = self.integration_manager.create_course_with_integration(course_data)

                

                if success:

                    # cleaned comment

                    self._save_course_to_file(course_data)

                    return json.dumps({"status": "success", "message": message, "id": course_id}, ensure_ascii=False)

                else:

                    return json.dumps({"status": "error", "message": message}, ensure_ascii=False)

            else:

                # (comment)

                return self._save_course_legacy(course_data)

            

        except Exception as e:

            error_msg = f"Failed to save courses and groups: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

    

    @pyqtSlot(str, result=str)

    def get_async_operation_result(self, operation_id):

        """Run time-consuming operations in background thread"""

        try:

            if operation_id in self._operation_cache:

                cached = self._operation_cache[operation_id]

                return json.dumps({

                    "operation_id": operation_id,

                    "status": cached['status'],

                    "timestamp": cached['timestamp'],

                    "result": cached.get('result'),

                    "error": cached.get('error')

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "operation_id": operation_id,

                    "status": "not_found",

                    "message": "Operation not found or expired"

                }, ensure_ascii=False)

        except Exception as e:

            return json.dumps({

                "operation_id": operation_id,

                "status": "error",

                "message": f"Operation failed: {str(e)}"

            }, ensure_ascii=False)

    

    @pyqtSlot(result=str)

    def clear_operation_cache(self):

        """Run time-consuming operations in background thread"""

        try:

            cleared_count = len(self._operation_cache)

            self._operation_cache.clear()

            return json.dumps({

                "status": "success",

                "message": f"Cleared {cleared_count} cached operations"

            }, ensure_ascii=False)

        except Exception as e:

            return json.dumps({

                "status": "error",

                "message": f"Operation failed: {str(e)}"

            }, ensure_ascii=False)



    @pyqtSlot(result=str)

    def reset_bridge_state(self):

        """Reset Bridge state and clear locks"""

        try:

            # (comment)

            self._operation_cache.clear()

            

            # (comment)

            if hasattr(self, '_loading_locks'):

                self._loading_locks.clear()

            

            # cleaned comment

            self.dataStateChanged.emit("bridge_state_reset")

            

            return json.dumps({

                "status": "success",

                "message": "Bridge state reset complete",

                "timestamp": datetime.now().isoformat()

            }, ensure_ascii=False)

            

        except Exception as e:

            error_msg = f"Failed to reset Bridge state: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)



    @pyqtSlot(result=str)

    def check_bridge_health(self):

        """Get Bridge health status."""

        try:

            health_info = {

                "status": "healthy",

                "timestamp": datetime.now().isoformat(),

                "last_init_time": getattr(self, '_last_init_time', None),

                "operation_cache_size": len(self._operation_cache),

                "thread_pool_active": not self.thread_pool._shutdown if hasattr(self, 'thread_pool') else False,

                "courses_file_exists": os.path.exists(self.courses_file),

                "groups_file_exists": os.path.exists(self.groups_file),

                "settings_file_exists": os.path.exists(self.settings_file)

            }

            

            # cleaned comment

            if os.path.exists(self.courses_file):

                health_info["courses_file_size"] = os.path.getsize(self.courses_file)

            

            # cleaned comment

            if hasattr(self, '_loading_locks'):

                health_info["active_locks"] = list(self._loading_locks.keys())

            

            return json.dumps(health_info, ensure_ascii=False, default=str)

            

        except Exception as e:

            return json.dumps({

                "status": "error",

                "message": f"Health check failed: {str(e)}",

                "timestamp": datetime.now().isoformat()

            }, ensure_ascii=False)



    def _on_settings_changed(self, new_settings, changes):

        """

        (text)

        

        Args:

            new_settings: See implementation
            changes: See implementation
        """

        try:

            settings_dict = new_settings.to_dict()

            # cleaned comment

            change_info = {

                'timestamp': datetime.now().isoformat(),

                'changes': changes,

                'settings': settings_dict

            }

            self.settingsChanged.emit(json.dumps(change_info, ensure_ascii=False))

            

            # cleaned comment

            self.settingsUpdated.emit(json.dumps(settings_dict, ensure_ascii=False))

            

            # cleaned comment

            critical_keys = {'semester_weeks', 'current_week', 'start_date', 'show_weekends', 'week_start_day'}

            if any(k in changes for k in critical_keys) or "reset" in changes:

                self.scheduleDataUpdated.emit()

                self._check_and_notify_week_conflicts()

                

            logger.info(f"Settings synced: {list(changes.keys())}")

            

        except Exception as e:

            logger.info(f"Failed to load settings: {e}")

    

    def _on_settings_changed_integrated(self, event):

        """

        (text)

        

        Args:

            event: Event payload from data stream

        """

        try:

            changes = event.data.get('updates', {})

            settings_dict = self.settings_manager.get_settings_dict()

            

            # cleaned comment

            change_info = {

                'timestamp': event.timestamp.isoformat(),

                'changes': changes,

                'source': 'integration_manager',

                'settings': settings_dict

            }

            self.settingsChanged.emit(json.dumps(change_info, ensure_ascii=False))

            

            # (comment)

            self.settingsUpdated.emit(json.dumps(settings_dict, ensure_ascii=False))

            

            # cleaned comment

            if any(k in changes for k in ('semester_weeks', 'current_week', 'start_date', 'show_weekends', 'week_start_day')):

                self.scheduleDataUpdated.emit()

                self._check_and_notify_week_conflicts()

                

            logger.info(f"Integrated settings synced: {list(changes.keys())}")

            

        except Exception as e:

            logger.info(f"Failed to load settings: {e}")

    

    def _on_course_added(self, event):

        """

        Handle course-added event

        

        Args:

            event: Event payload from data stream

        """

        try:

            course_id = event.data.get('course_id')

            group_id = event.data.get('group_id')

            is_new_group = event.data.get('is_new_group', False)

            

            # cleaned comment

            status_info = {

                'type': 'course_added',

                'course_id': course_id,

                'group_id': group_id,

                'is_new_group': is_new_group,

                'timestamp': event.timestamp.isoformat()

            }

            self.dataStateChanged.emit(json.dumps(status_info, ensure_ascii=False))

            

            logger.info(f"Course event handled: {course_id}")

            

        except Exception as e:

            logger.info(f"Save failed: {e}")

    

    def _on_course_updated(self, event):

        """

        Handle course-updated event

        

        Args:

            event: Event payload from data stream

        """

        try:

            course_id = event.data.get('course_id')

            updates = event.data.get('updates', {})

            

            # cleaned comment

            status_info = {

                'type': 'course_updated',

                'course_id': course_id,

                'updates': list(updates.keys()),

                'timestamp': event.timestamp.isoformat()

            }

            self.dataStateChanged.emit(json.dumps(status_info, ensure_ascii=False))

            

            logger.info(f"Course event handled: {course_id}")

            

        except Exception as e:

            logger.info(f"Save failed: {e}")

    

    def _on_course_deleted(self, event):

        """

        Handle course-deleted event

        

        Args:

            event: Event payload from data stream

        """

        try:

            course_id = event.data.get('course_id')

            affected_groups = event.data.get('affected_groups', [])

            

            # cleaned comment

            status_info = {

                'type': 'course_deleted',

                'course_id': course_id,

                'affected_groups': affected_groups,

                'timestamp': event.timestamp.isoformat()

            }

            self.dataStateChanged.emit(json.dumps(status_info, ensure_ascii=False))

            

            logger.info(f"Course event handled: {course_id}")

            

        except Exception as e:

            logger.info(f"Save failed: {e}")

    

    def _save_course_to_file(self, course_data):

        """Save courses to file system."""

        try:

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            # cleaned comment

            course_id = course_data.get('id')

            found = False

            for i, existing_course in enumerate(existing_courses):

                if existing_course.get('id') == course_id:

                    existing_courses[i] = course_data

                    found = True

                    break

            

            # cleaned comment

            if not found:

                existing_courses.append(course_data)

            

            # cleaned comment

            self._atomic_write_json(self.courses_file, existing_courses)

            

            logger.info(f"Course saved to file: {course_data.get('name', 'Unknown')}")

            

        except Exception as e:

            logger.info(f"Failed to save course file: {e}")

            raise

    

    def _save_course_legacy(self, course_data):

        """Legacy save path (fallback)."""

        try:

            # cleaned comment

            course_base = CourseBase(

                course_id=course_data['id'],

                name=course_data.get('name', ''),

                color=course_data.get('color', ''),

                note=course_data.get('note', '')

            )

            

            course_detail = CourseDetail(

                course_id=course_data['id'],

                teacher=course_data.get('teacher', ''),

                location=course_data.get('location', ''),

                day_of_week=course_data.get('day', 1),

                start_section=course_data.get('start', 1),

                step=course_data.get('duration', 1),

                start_week=1,  # cleaned comment

                end_week=16,  # cleaned comment

                week_type=1  # cleaned comment

            )

            

            # 处理自动分组 - 添加空值检查
            if self.course_group_manager is not None:
                group, is_new_group = self.course_group_manager.create_or_update_group(course_base, course_detail)
            else:
                logger.warning("course_group_manager is None, skipping group creation")
                group = None
                is_new_group = False

            

            # cleaned comment

            if group:

                course_data['color'] = group.color

                course_data['groupId'] = group.id

                

                if is_new_group:

                    logger.info(f"Created new group: {group.name} (Teacher: {group.teacher})")

                else:

                    logger.info(f"Joined existing group: {group.name} (Teacher: {group.teacher})")

            

            # (comment)

            result = self.save_course(json.dumps(course_data, ensure_ascii=False))

            

            # (comment)

            if group:

                self._save_groups_to_file()

            

            # cleaned comment

            self.dataStateChanged.emit("course_saved_with_grouping")

            

            return result

            

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)



    # =========================================================================

    # (comment)

    # =========================================================================

    

    @pyqtSlot(result=str)

    def get_global_settings(self):

        """Run time-consuming operations in background thread"""

        try:

            # cleaned comment

            if not hasattr(self, 'settings_manager') or self.settings_manager is None:
                logger.warning("settings_manager not initialized, returning defaults")
                from backend.models.schedule_settings import ScheduleSettings
                settings_dict = ScheduleSettings().to_dict()
                return self._success_response("获取设置成功", data=settings_dict, **settings_dict)

            

            settings_dict = self.settings_manager.get_settings_dict()
            return self._success_response("获取设置成功", data=settings_dict, **settings_dict)

        except Exception as e:

            error_msg = f"获取全局设置失败: {str(e)}"
            logger.info(f"{error_msg}")
            from backend.models.schedule_settings import ScheduleSettings
            settings_dict = ScheduleSettings().to_dict()
            return self._error_response(
                "获取全局设置失败，已回退到默认设置",
                "SETTINGS_GET_FAILED",
                data=settings_dict,
                **settings_dict
            )

    

    @pyqtSlot(str, result=str)

    def update_global_settings(self, settings_json):

        """Run time-consuming operations in background thread"""

        try:

            try:
                updates = json.loads(settings_json)
            except json.JSONDecodeError:
                return self._error_response("更新全局设置失败：JSON 格式无效", "INVALID_JSON")

            if not isinstance(updates, dict):
                return self._error_response("更新全局设置失败：参数类型错误，需传入对象", "INVALID_PAYLOAD")

            if "global_settings" in updates and isinstance(updates.get("global_settings"), dict):
                updates = updates["global_settings"]
            elif "settings" in updates and isinstance(updates.get("settings"), dict):
                updates = updates["settings"]

            success, error_msg = self.settings_manager.update_settings(updates)

            

            if success:

                settings_dict = self.settings_manager.get_settings_dict()
                return self._success_response("设置更新成功", data=settings_dict, settings=settings_dict)

            else:
                return self._error_response(f"更新全局设置失败：{error_msg}", "SETTINGS_VALIDATION_FAILED")

                

        except Exception as e:

            error_msg = f"更新全局设置失败: {str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "SETTINGS_UPDATE_EXCEPTION")

    

    @pyqtSlot(str, result=str)

    def update_settings(self, settings_json):

        """Robust settings update endpoint (core)."""

        try:

            new_settings = json.loads(settings_json)

            old_settings = self.settings_manager.get_settings_dict().copy()

            

            # cleaned comment

            success, error_msg = self.settings_manager.update_settings(new_settings)

            

            if not success:

                return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

            

            # cleaned comment

            conflict_msg = self._check_and_notify_week_conflicts(old_settings, new_settings)

            

            # cleaned comment

            self._apply_global_settings(new_settings)

            
            # 检测天气位置变化，自动刷新天气和诗词数据
            logger.info(f"检查天气位置变化: old={old_settings.get('weather_location')}, new={new_settings.get('weather_location')}")
            if 'weather_location' in new_settings:
                old_location = old_settings.get('weather_location', '')
                new_location = new_settings['weather_location']
                logger.info(f"位置对比: '{old_location}' vs '{new_location}' (相同={old_location == new_location})")
                
                if old_location != new_location:
                    logger.info(f"检测到天气位置变化: {old_location} -> {new_location}")
                    self._refresh_weather_and_shici_async(new_location)
                else:
                    logger.info("天气位置未变化，跳过刷新")
            
            # Get updated settings
            updated_settings = self.settings_manager.get_settings_dict()
            
            # Emit settingsUpdated signal for realtime frontend updates
            self.settingsUpdated.emit(json.dumps(updated_settings, ensure_ascii=False))
            
            # (comment)

            self.dataStateChanged.emit("settings_updated")
            self._run_auto_backup_if_needed()

            

            logger.info(f"Settings updated successfully: {list(new_settings.keys())}")

            return json.dumps({

                "status": "success", 

                "message": "设置更新成功",

                "conflict_warning": conflict_msg,

                "settings": updated_settings

            }, ensure_ascii=False)

            

        except Exception as e:

            logger.info(f"Failed to load settings: {e}")

            return json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False)

    

    def _check_and_notify_week_conflicts(self, old_settings=None, new_settings=None):

        """

        (text)

        

        Args:

            old_settings: settings dict before change

            new_settings: settings dict after change

            

        Returns:

            str: (text) None

        """

        try:

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            if not existing_courses:

                return None

                

            # cleaned comment

            conflicts = self.settings_manager.check_course_week_conflicts(existing_courses)

            

            if conflicts:

                # cleaned comment

                conflict_info = {

                    'type': 'week_conflicts',

                    'count': len(conflicts),

                    'conflicts': conflicts,

                    'timestamp': datetime.now().isoformat()

                }

                self.dataStateChanged.emit(json.dumps(conflict_info, ensure_ascii=False))

                

                # (comment)

                max_week = self.settings_manager.settings.semester_weeks

                # cleaned comment

                conflict_names = list(set([c['course'].get('name', 'Unknown') for c in conflicts]))

                msg = f"Found {len(conflicts)} week conflicts beyond max week {max_week}"

                msg += f"{', '.join(conflict_names[:3])}{'...' if len(conflict_names) > 3 else ''}"

                

                logger.info(f"{msg}")

                return msg

            

            # (comment)

            if old_settings and new_settings:

                old_max = old_settings.get('semester_weeks', 20)

                new_max = new_settings.get('semester_weeks', 20)

                if new_max < old_max:

                    logger.info(f"Max week reduced ({old_max} -> {new_max}), checking conflicts")

            

            return None

            

        except Exception as e:

            logger.warning(f"Conflict check failed: {e}")

            return None

    

    def _apply_global_settings(self, settings):

        """Apply global settings to integration manager and runtime."""

        logger.info("Applying global settings...")

        

        # (comment)

        if self.integration_manager:

            try:

                self.integration_manager.handle_settings_change(settings)

                logger.info("Synced settings to integration manager")

            except Exception as e:

                logger.warning(f"Integration manager sync failed: {e}")

        # Apply runtime-effective settings immediately in main window.
        if self._main_window_instance:
            try:
                self._main_window_instance.apply_runtime_settings(settings)
                logger.info("Applied runtime settings to main window")
            except Exception as e:
                logger.warning(f"Runtime settings apply failed: {e}")

    

    def _save_settings_to_file(self):

        """Run time-consuming operations in background thread"""

        try:

            settings_dict = self.settings_manager.get_settings_dict()

            self._atomic_write_json(self.settings_file, settings_dict)
            self._run_auto_backup_if_needed()

            logger.info("Settings saved to file")

        except Exception as e:

            logger.info(f"Save failed: {e}")

    

    @pyqtSlot(result=str)

    def reset_global_settings(self):

        """Reset global settings to defaults."""

        try:

            if self.settings_manager.reset_to_defaults():
                settings_dict = self.settings_manager.get_settings_dict()
                return self._success_response("设置已重置为默认值", data=settings_dict, settings=settings_dict)
            else:
                return self._error_response("閲嶇疆鍏ㄥ眬璁剧疆澶辫触", "SETTINGS_RESET_FAILED")

                

        except Exception as e:

            error_msg = f"閲嶇疆鍏ㄥ眬璁剧疆澶辫触: {str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "SETTINGS_RESET_EXCEPTION")

    

    @pyqtSlot(result=str)

    def get_week_options(self):

        """Run time-consuming operations in background thread"""

        try:

            week_options = self.settings_manager.get_week_options()

            max_week = self.settings_manager.settings.semester_weeks
            payload = {"week_options": week_options, "max_week": max_week}
            return self._success_response("获取周数选项成功", data=payload, **payload)

        except Exception as e:

            error_msg = f"获取周数选项失败: {str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "WEEK_OPTIONS_EXCEPTION")

    

    @pyqtSlot(result=str)

    def check_course_week_conflicts(self):

        """Check week conflicts."""

        try:

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            conflicts = self.settings_manager.check_course_week_conflicts(existing_courses)

            

            payload = {
                "conflicts": conflicts,
                "conflict_count": len(conflicts),
                "max_week": self.settings_manager.settings.semester_weeks,
            }
            return self._success_response("周数冲突检查完成", data=payload, **payload)

            

        except Exception as e:

            error_msg = f"鍛ㄦ暟鍐茬獊妫€鏌ュけ璐? {str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "WEEK_CONFLICT_CHECK_EXCEPTION")

    

    @pyqtSlot(str, result=str)

    def export_settings(self, export_path):

        """Export settings to file."""

        try:

            if self.settings_manager.export_settings(export_path):

                return json.dumps({

                    "status": "success", 

                    "message": f"Settings exported to {export_path}"

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error", 

                    "message": "设置导出失败"

                }, ensure_ascii=False)

                

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

    

    @pyqtSlot(str, result=str)

    def import_settings(self, import_path):

        """Import settings from file."""

        try:

            success, error_msg = self.settings_manager.import_settings(import_path)

            

            if success:

                return json.dumps({

                    "status": "success", 

                    "message": f"Settings imported from {import_path} successfully",

                    "settings": self.settings_manager.get_settings_dict()

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error", 

                    "message": error_msg

                }, ensure_ascii=False)

                

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

    

    @pyqtSlot(result=str)

    def get_settings_statistics(self):

        """Run time-consuming operations in background thread"""

        try:

            stats = self.settings_manager.get_statistics()

            return json.dumps(stats, ensure_ascii=False)

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"error": error_msg}, ensure_ascii=False)

    

    @pyqtSlot(str, result=str)

    def fix_course_week_conflicts(self, strategy):

        """Fix course week conflicts - remove or keep conflicting courses"""

        try:

            # 璇搷浣滃鐞嗭細浠呭厑璁?truncate/remove 涓ょ绛栫暐
            if strategy not in ("truncate", "remove"):
                return self._error_response(
                    f"淇绛栫暐鏃犳晥: {strategy}锛屼粎鏀寔 truncate 鎴?remove",
                    "INVALID_FIX_STRATEGY"
                )

            # cleaned comment

            if os.path.exists(self.courses_file):

                file_size = os.path.getsize(self.courses_file)

                if file_size > 100 * 1024:  # cleaned comment

                    operation_id = f"fix_conflicts_{strategy}_{int(datetime.now().timestamp())}"

                    self._run_async_operation(operation_id, self._fix_course_week_conflicts_heavy, strategy)

                    return json.dumps({
                        "status": "processing",
                        "message": "大数据量处理中，请稍候",
                        "operation_id": operation_id,
                        "data": {"operation_id": operation_id},
                    }, ensure_ascii=False)

            

            # (comment)

            return self._fix_course_week_conflicts_sync(strategy)

            

        except Exception as e:

            error_msg = f"淇璇剧▼鍛ㄦ暟鍐茬獊澶辫触: {str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "WEEK_CONFLICT_FIX_EXCEPTION")

    

    def _fix_course_week_conflicts_sync(self, strategy):

        """Run time-consuming operations in background thread"""

        try:

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            max_week = self.settings_manager.settings.semester_weeks

            fixed_courses = []

            removed_count = 0

            

            # cleaned comment

            batch_size = 50

            for i in range(0, len(existing_courses), batch_size):

                batch = existing_courses[i:i + batch_size]

                

                for course in batch:

                    week_list = course.get('week_list', [])

                    weeks_str = course.get('weeks', '')

                    

                    has_conflict = False

                    

                    # (comment)

                    if week_list:

                        if any(week > max_week for week in week_list):

                            has_conflict = True

                            if strategy == 'truncate':

                                course['week_list'] = [w for w in week_list if w <= max_week]

                                if course['week_list']:

                                    course['weeks'] = f"{min(course['week_list'])}-{max(course['week_list'])}"

                                else:

                                    course['weeks'] = "1"

                                    course['week_list'] = [1]

                    

                    # cleaned comment

                    elif weeks_str and '-' in weeks_str:

                        try:

                            start_week, end_week = map(int, weeks_str.split('-'))

                            if start_week > max_week or end_week > max_week:

                                has_conflict = True

                                if strategy == 'truncate':

                                    new_start = min(start_week, max_week)

                                    new_end = min(end_week, max_week)

                                    course['weeks'] = f"{new_start}-{new_end}"

                                    course['week_list'] = list(range(new_start, new_end + 1))

                        except ValueError:

                            pass

                    

                    # (comment)

                    if has_conflict and strategy == 'remove':

                        removed_count += 1

                        continue

                    else:

                        fixed_courses.append(course)

            

            # (comment)

            self._atomic_write_json(self.courses_file, fixed_courses)
            self._run_auto_backup_if_needed()

            

            if strategy == 'truncate':
                message = f"已修复课程周数，截断到第 {max_week} 周"
            else:
                message = f"已删除 {removed_count} 个冲突课程"

            

            self.dataStateChanged.emit("week_conflicts_fixed")

            fixed_count = len(existing_courses) - len(fixed_courses) if strategy == 'remove' else len(existing_courses)
            payload = {"fixed_count": fixed_count, "removed_count": removed_count, "strategy": strategy}
            return self._success_response(message, data=payload, **payload)

            

        except Exception as e:

            error_msg = f"淇璇剧▼鍛ㄦ暟鍐茬獊澶辫触: {str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "WEEK_CONFLICT_FIX_SYNC_EXCEPTION")

    

    def _fix_course_week_conflicts_heavy(self, strategy):

        """Run time-consuming operations in background thread"""

        # (comment)

        return json.loads(self._fix_course_week_conflicts_sync(strategy))

    

    @pyqtSlot(int, result=str)

    def validate_week_number(self, week):

        """Run time-consuming operations in background thread"""

        try:

            try:
                normalized_week = int(week)
            except (TypeError, ValueError):
                return self._error_response("周数校验失败：周数参数无效", "INVALID_WEEK_NUMBER")

            is_valid = self.settings_manager.is_week_valid(normalized_week)

            max_week = self.settings_manager.settings.semester_weeks

            

            payload = {
                "is_valid": is_valid,
                "week": normalized_week,
                "max_week": max_week,
                "detail": f"鍛ㄦ暟 {normalized_week} {'鏈夋晥' if is_valid else '鏃犳晥'}锛屾湁鏁堣寖鍥翠负 1-{max_week}",
            }
            return self._success_response("鍛ㄦ暟鏍￠獙瀹屾垚", data=payload, **payload)

            

        except Exception as e:

            error_msg = f"鍛ㄦ暟鏍￠獙澶辫触: {str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "WEEK_VALIDATE_EXCEPTION")

    

    @pyqtSlot(str, result=str)

    def get_course_groups(self, group_id=""):

        """Run time-consuming operations in background thread"""

        try:

            if group_id:

                # (comment)

                group = self.course_group_manager.get_group(group_id)

                if group:

                    group_dict = {

                        'id': group.id,

                        'name': group.name,

                        'teacher': group.teacher,

                        'location': group.location,

                        'color': group.color,

                        'course_ids': list(group.course_ids),

                        'course_count': len(group.course_ids),

                        'created_at': group.created_at.isoformat(),

                        'updated_at': group.updated_at.isoformat()

                    }

                    return json.dumps(group_dict, ensure_ascii=False)

                else:

                    return json.dumps({"error": "Group not found"}, ensure_ascii=False)

            else:

                # cleaned comment

                groups_data = []

                for group in self.course_group_manager.get_all_groups():

                    group_dict = {

                        'id': group.id,

                        'name': group.name,

                        'teacher': group.teacher,

                        'location': group.location,

                        'color': group.color,

                        'course_count': len(group.course_ids),

                        'created_at': group.created_at.isoformat(),

                        'updated_at': group.updated_at.isoformat()

                    }

                    groups_data.append(group_dict)

                

                return json.dumps(groups_data, ensure_ascii=False)

                

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"error": error_msg}, ensure_ascii=False)

    

    @pyqtSlot(str, str, result=str)

    def update_group_properties(self, group_id, updates_json):

        """Update group properties."""

        try:

            updates = json.loads(updates_json)

            

            success, error_msg = self.course_group_manager.sync_group_properties(group_id, updates)

            

            if success:

                # (comment)

                self._save_groups_to_file()

                

                # cleaned comment

                if 'color' in updates:

                    self._sync_group_color_to_courses(group_id, updates['color'])

                

                self.dataStateChanged.emit("group_updated")

                return json.dumps({"status": "success", "message": "Group updated successfully"}, ensure_ascii=False)

            else:

                return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

                

        except Exception as e:

            error_msg = f"Failed to update group properties: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

    

    def _sync_group_color_to_courses(self, group_id, new_color):

        """Sync group color to all related courses."""

        try:

            group = self.course_group_manager.get_group(group_id)

            if not group:

                return

            

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            # (comment)

            updated = False

            for course in existing_courses:

                if course.get('id') in group.course_ids:

                    course['color'] = new_color

                    updated = True

            

            # (comment)

            if updated:

                self._atomic_write_json(self.courses_file, existing_courses)
                self._run_auto_backup_if_needed()

                logger.info(f"Synced group {group_id} color to {len(group.course_ids)} courses")

                

        except Exception as e:

            logger.info(f"Save failed: {e}")

    

    @pyqtSlot(str, result=str)

    def delete_course_group(self, group_id):

        """Run time-consuming operations in background thread"""

        try:

            group = self.course_group_manager.get_group(group_id)

            if not group:

                return json.dumps({"status": "error", "message": "Group not found"}, ensure_ascii=False)

            

            # (comment)

            course_ids_to_delete = list(group.course_ids)

            

            # (comment)

            success, error_msg = self.course_group_manager.delete_group(group_id)

            

            if not success:

                return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

            

            # cleaned comment

            for course_id in course_ids_to_delete:

                self.delete_course_by_id(course_id)

            

            # (comment)

            self._save_groups_to_file()
            self._run_auto_backup_if_needed()
            self._run_auto_backup_if_needed()

            self.dataStateChanged.emit("group_deleted")

            return json.dumps({

                "status": "success", 

                "message": f"Deleted group and {len(course_ids_to_delete)} related courses"

            }, ensure_ascii=False)

                

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)



    # =========================================================================

    # cleaned comment

    # =========================================================================

    @pyqtSlot(str)

    def open_web_browser_view(self, config_str):

        try:
            if self._main_window_instance:
                self._main_window_instance.open_web_browser_view(config_str)
        except Exception as e:
            logger.error(f"open_web_browser_view failed: {e}", exc_info=True)



    @pyqtSlot()

    def hide_web_browser_view(self):

        try:
            if self._main_window_instance:
                self._main_window_instance.hide_web_browser_view()
        except Exception as e:
            logger.error(f"hide_web_browser_view failed: {e}", exc_info=True)



    @pyqtSlot(str)

    def load_url_in_browser(self, url):

        try:
            if self._main_window_instance:
                self._main_window_instance.load_url_in_browser(url)
        except Exception as e:
            logger.error(f"load_url_in_browser failed: {e}", exc_info=True)



    # =========================================================================

    # (comment)

    # =========================================================================

    # -------------------------------------------------------------------------

    # cleaned comment

    # -------------------------------------------------------------------------

    @pyqtSlot(result=str)

    def extract_schedule_from_browser(self):

        """Handle extract request from frontend (iframe-aware)."""

        logger.info("Extract request received (smart iframe mode)...")

        

        if not self._main_window_instance or not self._main_window_instance.import_browser_view:

            return json.dumps({"status": "error", "message": "导入浏览器未初始化，请先打开导入窗口。"})



        view = self._main_window_instance.import_browser_view
        if not hasattr(view, 'page'):
            return json.dumps({"status": "error", "message": "导入浏览器不可用，请重新打开导入窗口。"}, ensure_ascii=False)
        try:
            page = view.page()
        except Exception as e:
            logger.error(f"Failed to access import browser page: {e}", exc_info=True)
            return json.dumps({"status": "error", "message": "导入浏览器状态异常，请重试。"}, ensure_ascii=False)
        if page is None:
            return json.dumps({"status": "error", "message": "导入浏览器未就绪，请稍后重试。"}, ensure_ascii=False)



        # cleaned comment

        # Common frame ids in QiangZhi pages: "iframe0", "Frame1", "contentFrame"

        js_extractor = """

(function() {

    function getDocHtml(doc) {

        return doc.documentElement.outerHTML;

    }



    // 1. Check whether course table exists on current page (id="kbtable" or class="kbcontent")

    if (document.querySelector('#kbtable') || document.querySelector('.kbcontent')) {

        console.log("Course table found on main page");

        return getDocHtml(document);

    }



    // 2. Try to find table in iframe

    var frames = document.getElementsByTagName('iframe');

    for (var i = 0; i < frames.length; i++) {

        try {

            var doc = frames[i].contentDocument || frames[i].contentWindow.document;

            if (doc.querySelector('#kbtable') || doc.querySelector('.kbcontent')) {

                console.log("Iframe[" + i + "] accessible");

                return getDocHtml(doc);

            }

            // In some pages table is in iframe0 or Frame1

            if (frames[i].id === 'iframe0' || frames[i].id === 'Frame1') {

                console.log("Table-like structure found; trying core iframe extraction...");

                return getDocHtml(doc);

            }

        } catch(e) {

            console.log("Cannot access iframe (cross-origin): " + e);

        }

    }



    // 3. Fallback to main page

    console.log("No clear table structure detected; returning main page");

    return getDocHtml(document);

})();

"""



        # cleaned comment

        def on_html_ready(html_content):

            if not html_content:

                self.importProgress.emit("Unable to read page content")

                return



            logger.info(f"JS extraction done, content length: {len(html_content)}")

            try:

                # (comment)

                from backend.importers.qiangzhi_importer import QiangZhiImporter

                importer = QiangZhiImporter()

                

                # cleaned comment

                is_valid, msg = importer.validate(html_content)

                # cleaned comment

                if not is_valid:

                    if "Iframe" in msg:

                        self.importProgress.emit("Still outside iframe; try entering personal schedule page manually")

                    else:

                        self.importProgress.emit(f"Validation failed: {msg}")

                    return



                # (comment)

                self.importProgress.emit("Parsing HTML content...")

                bases, details = importer.parse(html_content)

                

                if not bases:

                    self.importProgress.emit("No courses extracted; page may not show valid schedule table")

                    return



                # (comment)

                self._save_extracted_courses(bases, details)



            except Exception as e:

                import traceback

                traceback.print_exc()

                self.importProgress.emit(f"Fast update failed: {str(e)}")



        # (comment)

        try:
            page.runJavaScript(js_extractor, on_html_ready)
        except Exception as e:
            logger.error(f"runJavaScript failed during schedule extraction: {e}", exc_info=True)
            return json.dumps({"status": "error", "message": "读取导入页面失败，请重试。"}, ensure_ascii=False)

        

        return json.dumps({"status": "processing", "message": "Processing import..."})



    # =========================================================================

    # cleaned comment

    # =========================================================================

    

    def _get_parent_window(self):

        return self._main_window_instance if self._main_window_instance else None



    @pyqtSlot()

    def trigger_excel_import(self):

        """Trigger Excel import dialog"""

        QTimer.singleShot(0, self._safe_import_excel)



    @pyqtSlot()

    def trigger_html_import(self):

        """Trigger HTML import dialog"""

        QTimer.singleShot(0, self._safe_import_html)



    @pyqtSlot()

    def trigger_json_import(self):

        """Trigger JSON import dialog"""

        QTimer.singleShot(0, self._safe_import_json)



    @pyqtSlot()

    def clear_all_courses(self):

        """Create empty schedule by clearing all current data."""

        try:

            # (comment)

            if os.path.exists(self.courses_file):

                os.remove(self.courses_file)

            

            # (comment)

            if hasattr(self.course_group_manager, 'groups'):

                self.course_group_manager.groups.clear()

            self._save_groups_to_file()

            

            # (comment)

            self.scheduleLoaded.emit("[]")

            self.dataStateChanged.emit("schedule_cleared")

            self.importProgress.emit("Schedule has been cleared")

            

            logger.info("Schedule cleared (fast mode)")

        except Exception as e:

            print(f"Clear failed: {e}")

            self.importProgress.emit(f"Clear failed: {str(e)}")

            self.dataStateChanged.emit("schedule_cleared_failed")



    def _safe_import_excel(self):

        from PyQt6.QtWidgets import QFileDialog

        try:

            parent = self._get_parent_window()

            file_path, _ = QFileDialog.getOpenFileName(

                parent, "Select Excel File", "", "Excel Files (*.xls *.xlsx)"

            )

            if not file_path: return

            

            self.importProgress.emit(f"Parsing: {os.path.basename(file_path)} (will overwrite current data)")

            from backend.importers.excel_importer import ExcelImporter

            importer = ExcelImporter()

            bases, details = importer.parse(file_path)

            self._save_extracted_courses(bases, details)

            # cleaned comment

        except Exception as e:

            self.importProgress.emit(f"Import failed: {str(e)}")

            self.dataStateChanged.emit("import_failed")



    def _safe_import_html(self):

        from PyQt6.QtWidgets import QFileDialog

        try:

            parent = self._get_parent_window()

            file_path, _ = QFileDialog.getOpenFileName(

                parent, "Select HTML File", "", "HTML Files (*.html *.htm)"

            )

            if not file_path: return

            

            self.importProgress.emit(f"Parsing: {os.path.basename(file_path)} (will overwrite current data)")

            

            with open(file_path, 'r', encoding='utf-8') as f:

                html_content = f.read()

            

            from backend.importers.html_importer import HTMLImporter

            importer = HTMLImporter()

            bases, details = importer.parse(html_content)

            self._save_extracted_courses(bases, details)

            # cleaned comment

        except Exception as e:

            self.importProgress.emit(f"HTML import failed: {str(e)}")

            self.dataStateChanged.emit("import_failed")



    def _safe_import_json(self):

        from PyQt6.QtWidgets import QFileDialog

        try:

            parent = self._get_parent_window()

            file_path, _ = QFileDialog.getOpenFileName(

                parent, "Select JSON File", "", "JSON Files (*.json)"

            )

            if not file_path: return

            

            self.importProgress.emit("Importing JSON data (will overwrite current data)")

            

            with open(file_path, 'r', encoding='utf-8') as f:

                data = json.load(f)

            

            ui_courses = data if isinstance(data, list) else data.get("courses", [])

            

            # cleaned comment

            if hasattr(self.course_group_manager, 'groups'):

                self.course_group_manager.groups.clear()

            

            # (comment)

            self._emit_fast_update(ui_courses)

            

        except Exception as e:

            self.importProgress.emit(f"JSON import failed: {str(e)}")

            self.dataStateChanged.emit("import_failed")




    def _emit_fast_update(self, courses_data):

        """Fast update method"""

        try:

            # (comment)

            json_str = json.dumps(courses_data, ensure_ascii=False)

            logger.info(f"Fast dispatch {len(courses_data)} courses, JSON length: {len(json_str)}")

            logger.info("Emitting scheduleLoaded signal...")

            self.scheduleLoaded.emit(json_str)

            logger.info("scheduleLoaded emitted")

            self.dataStateChanged.emit("imported_instant")

            

            # (comment)

            msg = f"Imported {len(courses_data)} courses successfully"

            self.importProgress.emit(msg)

            

            # cleaned comment

            def async_save():

                try:

                    self._atomic_write_json(self.courses_file, courses_data)

                    self._save_groups_to_file()
                    self._run_auto_backup_if_needed()

                    logger.info("Using cached data")

                except Exception as e:

                    logger.info(f"Failed to load settings: {e}")

            

            # cleaned comment

            future = self._submit_to_thread_pool(async_save, context="save-extracted-courses")
            if future is None:
                logger.warning("Background saver unavailable, fallback to inline save")
                async_save()

            

        except Exception as e:

            logger.info(f"Fast update failed: {e}")

            self.importProgress.emit(f"Fast update failed: {str(e)}")

            self.dataStateChanged.emit("import_failed")
    @pyqtSlot(result=str)
    def select_background_image(self):
        """
        Open file dialog to select a background image

        Returns:
            JSON string with selected file path or error
        """
        from PyQt6.QtWidgets import QFileDialog
        try:
            parent = self._get_parent_window()
            file_path, _ = QFileDialog.getOpenFileName(
                parent,
                "閫夋嫨鑳屾櫙鍥惧儚",
                "",
                "Image Files (*.png *.jpg *.jpeg *.webp *.bmp *.gif)"
            )

            if not file_path:
                return json.dumps({"success": False, "message": "鏈€夋嫨鏂囦欢"}, ensure_ascii=False)

            # Validate that the file exists
            if not os.path.isfile(file_path):
                return json.dumps({
                    "success": False,
                    "message": f"鏂囦欢涓嶅瓨鍦? {file_path}"
                }, ensure_ascii=False)

            # Validate file extension
            valid_extensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']
            file_ext = os.path.splitext(file_path)[1].lower()
            if file_ext not in valid_extensions:
                return json.dumps({
                    "success": False,
                    "message": f"涓嶆敮鎸佺殑鍥惧儚鏍煎紡: {file_ext}"
                }, ensure_ascii=False)

            logger.info(f"Selected background image: {file_path}")
            return json.dumps({
                "success": True,
                "path": file_path,
                "message": "鑳屾櫙鍥惧儚閫夋嫨鎴愬姛"
            }, ensure_ascii=False)

        except Exception as e:
            logger.info(f"Background image selection failed: {e}")
            return json.dumps({
                "success": False,
                "message": f"閫夋嫨鑳屾櫙鍥惧儚澶辫触: {str(e)}"
            }, ensure_ascii=False)




    def _save_extracted_courses(self, bases, details):

        """Convert crawler output to UI JSON and persist (normalized)."""

        # (comment)

        from backend.utils.data_normalizer import CourseDataNormalizer

        from backend.models.week_type import WeekType

        

        ui_courses = []

        

        # (comment)

        if hasattr(self.course_group_manager, 'groups'):

            self.course_group_manager.groups.clear()

        

        base_map = {b.course_id: b for b in bases}

        settings = self.settings_manager.get_settings_dict()

        auto_color = settings.get('auto_color_import', True)

        

        for detail in details:

            base = base_map.get(detail.course_id)

            if not base: 

                continue



            # 添加空值检查
            if self.course_group_manager is not None:
                group, is_new_group = self.course_group_manager.create_or_update_group(base, detail)
            else:
                logger.warning("course_group_manager is None, skipping group creation")
                group = None
                is_new_group = False

            

            # Determine course color: group color > auto color > default purple
            if group and group.color:
                course_color = group.color
            elif auto_color and self.color_manager:
                course_color = self.color_manager.get_color_for_course(base.name)
            else:
                course_color = "#8B5CF6"  # Default purple

            

            # cleaned comment

            all_weeks = range(detail.start_week, detail.end_week + 1)

            if detail.week_type == WeekType.ODD_WEEK:

                week_list = [w for w in all_weeks if w % 2 != 0]

            elif detail.week_type == WeekType.EVEN_WEEK:

                week_list = [w for w in all_weeks if w % 2 == 0]

            else:

                week_list = list(all_weeks)



            # (comment)

            raw_course = {

                "id": str(uuid.uuid4()),  

                "name": base.name,        

                "teacher": detail.teacher or "",

                "location": detail.location or "",

                "day": detail.day_of_week,  

                "start": detail.start_section,

                "duration": detail.step,

                "weeks": week_list,  # (comment)

                "week_list": week_list,  

                "color": course_color,

                "groupId": group.id if group else None,  

                "note": f"Course ID: {base.course_id}"

            }

            

            # (comment)

            try:

                normalized_course = CourseDataNormalizer.normalize_course_dict(raw_course)

                ui_courses.append(normalized_course)

            except Exception as e:

                # cleaned comment

                logger.info(f"Data normalization failed, skipping course: {base.name}, error: {e}")

                continue



        # (comment)

        unique_courses = self._deduplicate_courses_in_memory(ui_courses)

        

        # (comment)

        self._log_data_validation(unique_courses)

        

        # (comment)

        self._emit_fast_update(unique_courses)

    

    def _deduplicate_courses_in_memory(self, courses):

        """

        (text)

        

        Deduplicate by unique key (name + day + start + week).

        Keep the first encountered course.

        

        Args:

            courses: See implementation
        Returns:
        See implementation

        """

        unique_courses = []

        seen = set()

        

        for c in courses:

            # cleaned comment

            # cleaned comment

            week_tuple = tuple(sorted(c.get('week_list', [])))

            key = (c['name'], c['day'], c['start'], week_tuple)

            

            if key not in seen:

                unique_courses.append(c)

                seen.add(key)

            else:

                logger.info(f"Skip duplicate course: {c['name']} (day {c['day']}, start {c['start']})")

        

        if len(courses) > len(unique_courses):

            removed_count = len(courses) - len(unique_courses)

            logger.info(f"In-memory dedupe removed {removed_count} duplicates")

        

        return unique_courses

    

    def _log_data_validation(self, courses):

        """

        (text)

        

        Print course statistics and basic type checks for diagnostics.

        

        Args:

            courses: See implementation
        """

        print(f"\n[Bridge] Course data report:")

        print(f"  - Total courses: {len(courses)}")

        

        if not courses:

            print(f"  - No course data")

            return

        

        # cleaned comment

        sample = courses[0]

        print(f"  Sample course structure:")

        print(f"    - id: {type(sample['id']).__name__} = {sample['id'][:8]}...")

        print(f"    - name: {type(sample['name']).__name__} = {sample['name']}")

        print(f"    - day: {type(sample['day']).__name__} = {sample['day']}")

        print(f"    - start: {type(sample['start']).__name__} = {sample['start']}")

        print(f"    - duration: {type(sample['duration']).__name__} = {sample['duration']}")

        

        # (comment)

        weeks_preview = sample['weeks'][:3] if len(sample['weeks']) > 3 else sample['weeks']

        weeks_suffix = "..." if len(sample['weeks']) > 3 else ""

        print(f"    - weeks: {type(sample['weeks']).__name__} = {weeks_preview}{weeks_suffix}")

        print(f"    - color: {type(sample['color']).__name__} = {sample['color']}")

        

        # (comment)

        type_errors = []

        for i, course in enumerate(courses):

            if not isinstance(course['day'], int):

                type_errors.append(f"Course {i} ({course.get('name', 'Unknown')}): day must be int (got: {type(course['day']).__name__})")

            if not isinstance(course['start'], int):

                type_errors.append(f"Course {i} ({course.get('name', 'Unknown')}): start must be int (got: {type(course['start']).__name__})")

            if not isinstance(course['duration'], int):

                type_errors.append(f"Course {i} ({course.get('name', 'Unknown')}): duration must be int (got: {type(course['duration']).__name__})")

            if not isinstance(course['weeks'], list):

                type_errors.append(f"(text){i} ({course.get('name', '(text)')}): weeks(text) ((text): {type(course['weeks']).__name__})")

            elif not all(isinstance(w, int) for w in course['weeks']):

                type_errors.append(f"Course {i} ({course.get('name', 'Unknown')}): weeks contains non-integer values")

        

        if type_errors:

            print(f"  - Type errors found:")

            for error in type_errors[:5]:  # cleaned comment

                print(f"    - {error}")

            if len(type_errors) > 5:

                print(f"    ... and {len(type_errors) - 5} more")

        else:

            print(f"  - All data types are valid")

        

        # (comment)

        total_weeks = sum(len(c.get('weeks', [])) for c in courses)

        avg_weeks = total_weeks / len(courses) if courses else 0

        print(f"  Sample course structure:")

        print(f"    - Avg weeks: {avg_weeks:.1f}")

        print(f"    - Max duration: {max((c.get('duration', 0) for c in courses), default=0)}")

        print(f"    - Min duration: {min((c.get('duration', 0) for c in courses), default=0)}")

        print()

    

    def _deduplicate_courses(self):

        """Second-pass dedupe: keep one with larger duration."""

        try:

            with open(self.courses_file, 'r', encoding='utf-8') as f:

                courses = json.load(f)

            

            original_count = len(courses)

            

            # cleaned comment

            from collections import defaultdict

            groups = defaultdict(list)

            

            for course in courses:

                week_list = course.get('week_list', [])

                for week in week_list:

                    key = (course['name'], course['day'], course['start'], week)

                    groups[key].append(course)

            

            # cleaned comment

            ids_to_remove = set()

            for key, course_list in groups.items():

                if len(course_list) > 1:

                    # (comment)

                    best = max(course_list, key=lambda c: c['duration'])

                    for c in course_list:

                        if c['id'] != best['id']:

                            ids_to_remove.add(c['id'])

            

            if ids_to_remove:

                # (comment)

                courses = [c for c in courses if c['id'] not in ids_to_remove]

                

                # (comment)

                self._atomic_write_json(self.courses_file, courses)
                self._run_auto_backup_if_needed()

                

                removed_count = original_count - len(courses)

                logger.info(f"Second-pass dedupe removed {removed_count} duplicates")

                return removed_count

            

            return 0

        except Exception as e:

            logger.info(f"Failed to load settings: {e}")

            return 0

    

    

        except Exception as e:

            logger.info(f"Failed to load settings: {e}")



    # =========================================================================

    # (comment)

    # =========================================================================

    @pyqtSlot()

    def init_app(self):

        """Init hook for frontend: emit current data once bound."""

        current_time = datetime.now()

        

        # cleaned comment

        if hasattr(self, '_last_init_time'):

            time_diff = (current_time - self._last_init_time).total_seconds()

            if time_diff < 3:  # (comment)

                logger.warning(f"init_app called too frequently; skip duplicate init ({time_diff:.1f}s)")

                return

        

        self._last_init_time = current_time

        

        logger.info("Frontend requested initialization")

        courses_data = self.get_courses()

        if courses_data and courses_data != "[]":

            self.scheduleLoaded.emit(courses_data)

            logger.info(f"Emitted current course data (len={len(courses_data)})")

        else:

            logger.info("Using cached data")

            # cleaned comment

            self.scheduleLoaded.emit("[]")



    @pyqtSlot(result=str)

    def get_schedule_data(self):

        """Get schedule data for frontend."""

        return self.get_courses()



    # =========================================================================

    # cleaned comment

    # =========================================================================

    @pyqtSlot()

    def init_frontend(self):

        """

        Called after frontend initialization.

        Emits current schedule once signal bindings are ready.

        """

        logger.info("Frontend init request, preparing current schedule payload")

        courses_data = self.get_courses()

        if courses_data and courses_data != "[]":

            self.scheduleLoaded.emit(courses_data)

            logger.info(f"Emitted current course data (len={len(courses_data)})")

        else:

            logger.info("Using cached data")

            # cleaned comment

            self.scheduleLoaded.emit("[]")

    

    # =========================================================================

    # cleaned comment

    # =========================================================================

    def _get_all_courses_impl(self, progress_callback=None):
        """Background course-loading function (non-slot)."""
        stop_flag = {'stop': False}

        def progress_pusher():
            p = 0
            while not stop_flag['stop'] and p < 80:
                p += 2
                if progress_callback:
                    progress_callback(p)
                time.sleep(0.04)

        pusher_thread = threading.Thread(target=progress_pusher, daemon=True)
        pusher_thread.start()

        try:
            courses = []
            if os.path.exists(self.courses_file):
                with open(self.courses_file, 'r', encoding='utf-8') as f:
                    courses = json.load(f)
            return {
                "status": "success",
                "courses": courses
            }
        finally:
            stop_flag['stop'] = True
            pusher_thread.join(timeout=0.5)
            if progress_callback:
                progress_callback(100)

    @pyqtSlot(result=str)
    def get_all_courses(self):
        """Get all courses asynchronously with operation id + progress signals."""
        try:
            operation_id = f"get_all_courses:{int(time.time()*1000)}"
            self._run_async_operation(operation_id, self._get_all_courses_impl)
            return json.dumps({
                "status": "pending",
                "operation_id": operation_id
            }, ensure_ascii=False)
        except Exception as e:
            return json.dumps({
                "status": "error",
                "message": str(e)
            }, ensure_ascii=False)

    @pyqtSlot(result=str)
    def get_courses(self):

        """Run time-consuming operations in background thread"""

        if os.path.exists(self.courses_file):

            try:

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    return f.read()

            except Exception as e:

                logger.info(f"Save failed: {e}")

                return "[]"

        return "[]"



    @pyqtSlot(str, result=str)

    def save_course(self, course_json):

        """Run time-consuming operations in background thread"""

        try:

            course_data = json.loads(course_json)

            

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            # cleaned comment

            course_id = course_data.get('id')

            found = False

            for i, existing_course in enumerate(existing_courses):

                if existing_course.get('id') == course_id:

                    existing_courses[i] = course_data

                    found = True

                    break

            

            # cleaned comment

            if not found:

                existing_courses.append(course_data)

            

            # cleaned comment

            self._atomic_write_json(self.courses_file, existing_courses)
            self._run_auto_backup_if_needed()

            

            # cleaned comment

            self._emit_fast_update(existing_courses)

            self.dataStateChanged.emit("course_saved")

            

            return json.dumps({"status": "success", "message": "课程保存成功"}, ensure_ascii=False)

            

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)



    @pyqtSlot(str, result=str)

    def add_course(self, course_json):

        """Add new course with color persistence and grouping."""

        try:

            course_data = json.loads(course_json)

            

            # (comment)

            if not course_data.get('id'):

                course_data['id'] = str(uuid.uuid4())

            

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            # cleaned comment

            if any(course.get('id') == course_data['id'] for course in existing_courses):

                return json.dumps({"status": "error", "message": "Course ID already exists, use update"}, ensure_ascii=False)

            

            # (comment)

            if course_data.get('name') and course_data.get('teacher') and course_data.get('location'):

                course_base = CourseBase(

                    course_id=course_data['id'],

                    name=course_data.get('name', ''),

                    color=course_data.get('color', ''),

                    note=course_data.get('note', '')

                )

                

                course_detail = CourseDetail(

                    course_id=course_data['id'],

                    teacher=course_data.get('teacher', ''),

                    location=course_data.get('location', ''),

                    day_of_week=course_data.get('day', 1),

                    start_section=course_data.get('start', 1),

                    step=course_data.get('duration', 1),

                    start_week=1,  # cleaned comment

                    end_week=16,  # cleaned comment

                    week_type=1  # cleaned comment

                )

                

                # 添加空值检查
                if self.course_group_manager is not None:
                    group, is_new_group = self.course_group_manager.create_or_update_group(course_base, course_detail)
                else:
                    logger.warning("course_group_manager is None, skipping group creation")
                    group = None
                    is_new_group = False

                

                if group:

                    course_data['color'] = group.color

                    course_data['groupId'] = group.id

                    

                    if is_new_group:

                        logger.info(f"Created new group: {group.name} (Teacher: {group.teacher})")

                    else:

                        logger.info(f"Joined existing group: {group.name} (Teacher: {group.teacher})")

            

            # cleaned comment

            existing_courses.append(course_data)

            

            # cleaned comment

            self._atomic_write_json(self.courses_file, existing_courses)

            

            # (comment)

            self._save_groups_to_file()

            

            logger.info(f"Successfully added/updated course: {course_data.get('name', 'Unknown')} (Color: {course_data.get('color', 'Default')})")

            

            # cleaned comment

            self._emit_fast_update(existing_courses)

            self.dataStateChanged.emit("course_added")

            

            return json.dumps({"status": "success", "message": "课程添加成功", "id": course_data['id']}, ensure_ascii=False)

            

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)



    @pyqtSlot(str, result=str)

    def update_course(self, course_json):

        """Update existing course with color persistence."""

        try:

            course_data = json.loads(course_json)

            course_id = course_data.get('id')

            

            if not course_id:

                return json.dumps({"status": "error", "message": "(text)ID(text)"}, ensure_ascii=False)

            

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            # cleaned comment

            found = False

            for i, existing_course in enumerate(existing_courses):

                if existing_course.get('id') == course_id:

                    existing_courses[i] = course_data

                    found = True

                    break

            

            if not found:

                return json.dumps({"status": "error", "message": "Course to update not found"}, ensure_ascii=False)

            

            # cleaned comment

            self._atomic_write_json(self.courses_file, existing_courses)
            self._run_auto_backup_if_needed()

            

            logger.info(f"Successfully added/updated course: {course_data.get('name', 'Unknown')} (Color: {course_data.get('color', 'Default')})")

            

            # cleaned comment

            self._emit_fast_update(existing_courses)

            self.dataStateChanged.emit("course_updated")

            

            return json.dumps({"status": "success", "message": "课程更新成功"}, ensure_ascii=False)

            

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)



    @pyqtSlot(str, result=str)

    def delete_course_by_id(self, course_id):

        """(text)ID(text)"""

        try:

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            # cleaned comment

            original_count = len(existing_courses)

            course_to_delete = None

            for course in existing_courses:

                if course.get('id') == course_id:

                    course_to_delete = course

                    break

            

            existing_courses = [course for course in existing_courses if course.get('id') != course_id]

            

            if len(existing_courses) == original_count:

                return json.dumps({"status": "error", "message": "Course to delete not found"}, ensure_ascii=False)

            

            # (comment)

            affected_groups = self.course_group_manager.remove_course_from_groups(course_id)

            

            # cleaned comment

            self._atomic_write_json(self.courses_file, existing_courses)

            

            # (comment)

            if affected_groups:

                self._save_groups_to_file()

                logger.info(f"Course removed from {len(affected_groups)} groups")
            self._run_auto_backup_if_needed()

            

            course_name = course_to_delete.get('name', 'Unknown') if course_to_delete else 'Unknown'

            logger.info(f"Successfully deleted course: {course_name}")

            

            # cleaned comment

            self._emit_fast_update(existing_courses)

            self.dataStateChanged.emit("course_deleted")

            

            return json.dumps({"status": "success", "message": "课程删除成功"}, ensure_ascii=False)

            

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)



    @pyqtSlot(str, result=str)

    def delete_course(self, course_id):

        """Delete course (legacy-compatible wrapper)."""

        return self.delete_course_by_id(course_id)

    

    # =========================================================================

    # cleaned comment

    # =========================================================================

    

    def _save_course_to_file(self, course_data):

        """Persist courses to file system."""

        try:

            # (comment)

            existing_courses = []

            if os.path.exists(self.courses_file):

                with open(self.courses_file, 'r', encoding='utf-8') as f:

                    existing_courses = json.load(f)

            

            # cleaned comment

            course_id = course_data.get('id')

            found = False

            for i, existing_course in enumerate(existing_courses):

                if existing_course.get('id') == course_id:

                    existing_courses[i] = course_data

                    found = True

                    break

            

            # cleaned comment

            if not found:

                existing_courses.append(course_data)

            

            # cleaned comment

            self._atomic_write_json(self.courses_file, existing_courses)

            

            logger.info(f"Course saved to file: {course_data.get('name', 'Unknown')}")
            self._run_auto_backup_if_needed()

            

        except Exception as e:

            logger.info(f"Persist course file failed: {e}")

            raise

    

    def _save_course_legacy(self, course_data):

        """Legacy course save path (fallback)."""

        try:

            # cleaned comment

            course_base = CourseBase(

                course_id=course_data['id'],

                name=course_data.get('name', ''),

                color=course_data.get('color', ''),

                note=course_data.get('note', '')

            )

            

            course_detail = CourseDetail(

                course_id=course_data['id'],

                teacher=course_data.get('teacher', ''),

                location=course_data.get('location', ''),

                day_of_week=course_data.get('day', 1),

                start_section=course_data.get('start', 1),

                step=course_data.get('duration', 1),

                start_week=1,  # cleaned comment

                end_week=16,  # cleaned comment

                week_type=1  # cleaned comment

            )

            

            # 添加空值检查
            if self.course_group_manager is not None:
                group, is_new_group = self.course_group_manager.create_or_update_group(course_base, course_detail)
            else:
                logger.warning("course_group_manager is None, skipping group creation")
                group = None
                is_new_group = False

            

            # cleaned comment

            if group:

                course_data['color'] = group.color

                course_data['groupId'] = group.id

                

                if is_new_group:

                    logger.info(f"Created new group: {group.name} (Teacher: {group.teacher})")

                else:

                    logger.info(f"Joined existing group: {group.name} (Teacher: {group.teacher})")

            

            # (comment)

            result = self.save_course(json.dumps(course_data, ensure_ascii=False))

            

            # (comment)

            if group:

                self._save_groups_to_file()

            

            # cleaned comment

            self.dataStateChanged.emit("course_saved_with_grouping")

            

            return result

            

        except Exception as e:

            error_msg = f"Background operation failed: {str(e)}"

            logger.info(f"{error_msg}")

            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

    

    @pyqtSlot(result=str)

    def get_integration_status(self):

        """Get integration manager status."""

        try:

            if self.integration_manager:

                status = self.integration_manager.get_system_status()

                return json.dumps({

                    "status": "success",

                    "integration_enabled": True,

                    "system_status": status

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "success",

                    "integration_enabled": False,

                    "message": "Using standalone manager mode"

                }, ensure_ascii=False)

        except Exception as e:

            return json.dumps({

                "status": "error",

                "message": f"Failed to get integration status: {str(e)}"

            }, ensure_ascii=False)



    @pyqtSlot(result=str)

    def perform_system_check(self):

        """Run system consistency check."""

        try:

            issues = []

            

            if self.integration_manager:

                issues = self.integration_manager.perform_consistency_check()

            else:

                # cleaned comment

                if not os.path.exists(self.courses_file):

                    issues.append("Courses file does not exist")

                if not os.path.exists(self.settings_file):

                    issues.append("Settings file does not exist")

            

            return json.dumps({

                "status": "success",

                "issues": issues,

                "healthy": len(issues) == 0

            }, ensure_ascii=False)

            

        except Exception as e:

            return json.dumps({

                "status": "error",

                "message": f"System check failed: {str(e)}",

            }, ensure_ascii=False)





    # =========================================================================

    # cleaned comment

    # =========================================================================

    

    @pyqtSlot(result=str)

    def ping(self):

        """

        Health check endpoint

        (text) Bridge (text)

        

        Returns:

            string "pong"

        """

        return "pong"

    

    # =========================================================================

    # (comment)

    # =========================================================================

    

    def _emit_progress_safe(self, value: int):

        """Emit progress signal in a thread-safe way."""

        try:

            # (comment)

            QTimer.singleShot(0, lambda: self.loadingProgress.emit(value, f"Loading... {value}%"))

        except Exception as e:

            print(f"[Bridge][WARN] Failed to emit progress signal: {e}", flush=True)

    

    def _get_all_tasks_impl(self, progress_callback=None):

        """

        Background task-loading function (non-slot).

        Runs in thread pool and does not block UI.

        """

        # (comment)

        stop_flag = {'stop': False}

        

        def progress_pusher():

            """Progress pusher: smooth increment to 80%."""

            p = 0  # cleaned comment

            while not stop_flag['stop'] and p < 80:

                p += 2  # (comment)

                if progress_callback:

                    progress_callback(p)

                time.sleep(0.04)  # (comment)

        

        # (comment)

        pusher_thread = threading.Thread(target=progress_pusher, daemon=True)

        pusher_thread.start()

        

        try:
            # Check if task_manager is initialized
            if not self.task_manager:
                if not self._init_task_manager_blocking("_get_all_tasks_impl"):
                    print("[Bridge] task_manager is still unavailable", flush=True)
                    return {
                        "status": "error",
                        "message": "Task manager is initializing, please retry in a moment",
                        "tasks": []
                    }
            
            # Load task data
            print(">>> Starting to load task data", flush=True)
            self.task_manager.load_tasks()
            tasks = self.task_manager.get_all_tasks()
            print(f">>> Task loading complete, total {len(tasks)} tasks", flush=True)

            

            # (comment)

            wait_count = 0

            while not stop_flag['stop'] and wait_count < 15:  # (comment)

                time.sleep(0.04)

                wait_count += 1

            

            return {

                "status": "success",

                "tasks": tasks

            }

        except Exception as e:

            print(f"[Bridge] _get_all_tasks_impl exception: {e}", flush=True)

            traceback.print_exc()

            raise

        finally:

            # cleaned comment

            stop_flag['stop'] = True

            pusher_thread.join(timeout=0.5)  # (comment)

            

            # (comment)

            if progress_callback:

                progress_callback(100)

    

    @pyqtSlot(result=str)

    def get_all_tasks(self):

        """

        Get all tasks (async version).

        Returns operation_id immediately; real loading runs in background thread.

        

        Returns:

            JSON string containing operation_id or task data.

        """

        print(">>> ENTER get_all_tasks (async)", flush=True)

        print("THREAD:", QThread.currentThread(), flush=True)

        

        try:

            # cleaned comment

            operation_id = f"get_all_tasks:{int(time.time()*1000)}"

            

            # (comment)

            self._run_async_operation(operation_id, self._get_all_tasks_impl)

            

            print(f"[Bridge] Task loading initiated (async), operation_id: {operation_id}", flush=True)

            

            # (comment)

            return json.dumps({

                "status": "pending",

                "operation_id": operation_id

            }, ensure_ascii=False)

            

        except Exception as e:

            print("get_all_tasks exception:", e, flush=True)

            traceback.print_exc()

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)

    

    @pyqtSlot(str, result=str)

    def get_tasks_by_status(self, status):

        """

        Get tasks by status

        

        Args:

            status: task status (todo, doing, done)

            

        Returns:

            JSON string containing filtered tasks

        """

        try:
            if not self.task_manager:
                self._start_task_manager_init_async("get_tasks_by_status")
             
            if not self.task_manager:
                return self._task_manager_unavailable_response(include_tasks=True)
            
            tasks = self.task_manager.get_tasks_by_status(status)

            return json.dumps({

                "status": "success",

                "tasks": tasks

            }, ensure_ascii=False)

        except Exception as e:

            logger.info(f"Save failed: {e}")

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)

    

    @pyqtSlot(result=str)

    def get_exam_tasks(self):

        """

        (text)/(text)DDL(text)

        

        Returns:

            JSON(text)

        """

        try:
            if not self.task_manager:
                self._start_task_manager_init_async("get_exam_tasks")
             
            if not self.task_manager:
                return self._task_manager_unavailable_response(include_tasks=True)
            
            tasks = self.task_manager.get_exam_tasks()

            return json.dumps({

                "status": "success",

                "tasks": tasks

            }, ensure_ascii=False)

        except Exception as e:

            logger.info(f"Save failed: {e}")

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)

    

    @pyqtSlot(str, result=str)

    def add_task(self, task_json):

        """

        Add new task

        

        Args:

            task_json: task JSON payload

            

        Returns:

            JSON(text)

        """

        try:
            # 🔥 兜底逻辑：如果后台线程还没初始化完，这里手动初始化一下
            if not self.task_manager:
                self._start_task_manager_init_async("add_task")
             
            if not self.task_manager:
                return self._task_manager_unavailable_response()
            
            task_data = json.loads(task_json)
            success, message, task_dict = self.task_manager.add_task(task_data)

            

            if success:

                # cleaned comment

                self.dataStateChanged.emit("task_added")
                self._run_auto_backup_if_needed()

                

                return json.dumps({

                    "status": "success",

                    "message": message,

                    "task": task_dict

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error",

                    "message": message

                }, ensure_ascii=False)

                

        except Exception as e:

            logger.info(f"Save failed: {e}")

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)

    

    @pyqtSlot(str, str, result=str)

    def update_task(self, task_id, task_json):

        """

        (text)

        

        Args:

            task_id: (text)ID

            task_json: updated task JSON payload

            

        Returns:

            JSON(text)

        """

        try:
            if not self.task_manager:
                self._start_task_manager_init_async("update_task")
                return self._task_manager_unavailable_response()
            
            task_data = json.loads(task_json)
            success, message, task_dict = self.task_manager.update_task(task_id, task_data)

            

            if success:

                # cleaned comment

                self.dataStateChanged.emit("task_updated")
                self._run_auto_backup_if_needed()

                

                return json.dumps({

                    "status": "success",

                    "message": message,

                    "task": task_dict

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error",

                    "message": message

                }, ensure_ascii=False)

                

        except Exception as e:

            logger.info(f"Save failed: {e}")

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)

    

    @pyqtSlot(str, result=str)

    def delete_task(self, task_id):

        """

        (text)

        

        Args:

            task_id: (text)ID

            

        Returns:

            JSON(text)

        """

        try:
            if not self.task_manager:
                self._start_task_manager_init_async("delete_task")
                return self._task_manager_unavailable_response()
            
            success, message = self.task_manager.delete_task(task_id)

            

            if success:

                # cleaned comment

                self.dataStateChanged.emit("task_deleted")
                self._run_auto_backup_if_needed()

                

                return json.dumps({

                    "status": "success",

                    "message": message

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error",

                    "message": message

                }, ensure_ascii=False)

                

        except Exception as e:

            logger.info(f"Save failed: {e}")

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)

    

    @pyqtSlot(str, str, result=str)

    def update_task_status(self, task_id, new_status):

        """

        Update task status

        

        Args:

            task_id: (text)ID

            new_status: new status (todo, doing, done)

            

        Returns:

            JSON(text)

        """

        try:
            if not self.task_manager:
                self._start_task_manager_init_async("update_task_status")
                return self._task_manager_unavailable_response()
            
            success, message, task_dict = self.task_manager.update_task_status(task_id, new_status)

            

            if success:

                # cleaned comment

                self.dataStateChanged.emit("task_status_updated")
                self._run_auto_backup_if_needed()

                

                return json.dumps({

                    "status": "success",

                    "message": message,

                    "task": task_dict

                }, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error",

                    "message": message

                }, ensure_ascii=False)

                

        except Exception as e:

            logger.info(f"Failed to update task status: {e}")

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)

    

    @pyqtSlot(result=str)

    def get_task_statistics(self):

        """

        (text)

        

        Returns:

            JSON(text)

        """

        print(">>> ENTER get_task_statistics", flush=True)
        try:
            if not self.task_manager:
                self._start_task_manager_init_async("get_task_statistics")
                return json.dumps({
                    "status": "error",
                    "message": "Task manager is initializing, please retry in a moment",
                    "statistics": {
                        "total": 0,
                        "todo": 0,
                        "doing": 0,
                        "done": 0,
                        "exam_count": 0
                    }
                }, ensure_ascii=False)
            
            stats = self.task_manager.get_statistics()

            print(f">>> EXIT get_task_statistics: {stats}", flush=True)

            return json.dumps({

                "status": "success",

                "statistics": stats

            }, ensure_ascii=False)

        except Exception as e:

            print(f"get_task_statistics exception: {e}", flush=True)

            traceback.print_exc()

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)



    # =========================================================================

    # cleaned comment

    # =========================================================================

    

    @pyqtSlot(str, result=str)

    def get_weather(self, city="北京"):

        """

        (text)

        

        Args:

            city: city name, default is Beijing

            

        Returns:

            JSON(text)

        """

        try:

            # (comment)

            cache_key = f'weather_cache_{city}'

            if cache_key in self._operation_cache:

                cached = self._operation_cache[cache_key]

                cache_time = datetime.fromisoformat(cached['timestamp'])

                age_seconds = (datetime.now() - cache_time).total_seconds()

                

                # cleaned comment

                if age_seconds < 1800:  # (comment)

                    remaining_minutes = int((1800 - age_seconds) / 60)

                    logger.info(f"Using cached weather for {city} ({remaining_minutes} minutes left)")

                    return json.dumps(cached['result'], ensure_ascii=False)

                else:

                    logger.info(f"Weather cache expired for {city} ({int((age_seconds - 1800) / 60)} minutes over)")

            else:

                logger.info(f"Weather cache missing for {city}, requesting API")

            

            # cleaned comment

            from backend.services.weather_service import WeatherService

            try:
                settings = self.settings_manager.get_settings_dict() if self.settings_manager else self.load_settings()
            except Exception:
                settings = self.load_settings()

            api_key = str(settings.get('weather_api_key', '')).strip()
            api_host = str(settings.get('weather_host_url', 'devapi.qweather.com')).strip() or 'devapi.qweather.com'

            if not api_key:
                return json.dumps({
                    "status": "error",
                    "message": "天气 API Key 未配置，请在设置中填写"
                }, ensure_ascii=False)

            weather_service = WeatherService(
                api_key,
                api_host,
                cache_file=os.path.join(self.data_dir, 'weather_cache.json')
            )

            weather_data = weather_service.get_weather(city)

            

            if weather_data:

                result = {

                    "status": "success",

                    "data": weather_data

                }

                

                # (comment)

                self._operation_cache[cache_key] = {

                    'result': result,

                    'timestamp': datetime.now().isoformat(),

                    'status': 'success'

                }

                logger.info(f"Weather cached for {city} (valid 30 minutes)")

                

                return json.dumps(result, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error",

                    "message": "获取天气失败，请检查城市名称或网络连接"

                }, ensure_ascii=False)

                

        except Exception as e:

            logger.info(f"get_weather failed: {e}")

            traceback.print_exc()

            return json.dumps({
                "status": "error",
                "message": str(e)
            }, ensure_ascii=False)

    

    @pyqtSlot(str, result=str)
    def search_cities(self, query):
        """
        鎼滅储鍩庡競锛堢敤浜庡煄甯傚悕绉拌浆缁忕含搴︼級
        
        Args:
            query: 鍩庡競鍚嶇О鎴栧叧閿瘝
            
        Returns:
            JSON鏍煎紡鐨勬悳绱㈢粨鏋?
        """
        try:
            if not query or not query.strip():
                return json.dumps({
                    "status": "error",
                    "message": "搜索关键字不能为空"
                }, ensure_ascii=False)
            
            from backend.services.weather_service import WeatherService
            
            # 浠庤缃腑鑾峰彇API閰嶇疆
            try:
                settings = self.settings_manager.get_settings_dict() if self.settings_manager else self.load_settings()
            except Exception:
                settings = self.load_settings()
            
            # 馃敀 浣跨敤閫氱敤榛樿鍊硷紝閬垮厤鏆撮湶涓汉 API 淇℃伅
            api_key = settings.get('weather_api_key', '')
            api_host = settings.get('weather_host_url', 'devapi.qweather.com')
            
            weather_service = WeatherService(api_key, api_host, cache_file=os.path.join(self.data_dir, 'weather_cache.json'))
            
            # 鏋勫缓鍩庡競鏌ヨURL
            geo_api_url = f"https://{api_host}/geo/v2/city/lookup"
            
            import requests
            response = requests.get(
                geo_api_url,
                params={'location': query, 'key': api_key},
                timeout=10
            )
            
            print(f"馃攳 [Bridge] 鍩庡競鎼滅储: {query}")
            print(f"馃摗 [Bridge] 鍝嶅簲鐘舵€? {response.status_code}")
            
            if response.status_code != 200:
                return json.dumps({
                    "status": "error",
                    "message": f"鍩庡競鎼滅储璇锋眰澶辫触: {response.status_code}"
                }, ensure_ascii=False)
            
            data = response.json()
            
            if data.get('code') != '200':
                return json.dumps({
                    "status": "error",
                    "message": f"鍩庡競鎼滅储澶辫触: {data.get('code')}",
                    "data": []
                }, ensure_ascii=False)
            
            locations = data.get('location', [])
            
            # 鏍煎紡鍖栬繑鍥炵粨鏋?
            cities = []
            for loc in locations[:10]:  # 鏈€澶氳繑鍥?0涓粨鏋?
                cities.append({
                    'id': loc.get('id'),
                    'name': loc.get('name'),
                    'adm1': loc.get('adm1'),  # 鐪佷唤
                    'adm2': loc.get('adm2'),  # 鍩庡競
                    'country': loc.get('country'),
                    'lat': loc.get('lat'),
                    'lon': loc.get('lon'),
                    'display': f"{loc.get('name')}, {loc.get('adm1')}"
                })
            
            logger.info(f"Found {len(cities)} cities")
            
            return json.dumps({
                "status": "success",
                "data": cities,
                "count": len(cities)
            }, ensure_ascii=False)
            
        except Exception as e:
            print(f"鉂?[Bridge] 鍩庡競鎼滅储寮傚父: {e}")
            traceback.print_exc()
            return json.dumps({
                "status": "error",
                "message": f"鍩庡競鎼滅储寮傚父: {str(e)}"
            }, ensure_ascii=False)
    
    @pyqtSlot(result=str)

    def get_shici(self):

        """

        Get today's poem (with cache)

        

        Returns:

            JSON(text)

        """

        try:

            # (comment)

            cache_key = 'shici_cache'

            if cache_key in self._operation_cache:

                cached = self._operation_cache[cache_key]

                cache_time = datetime.fromisoformat(cached['timestamp'])

                age_seconds = (datetime.now() - cache_time).total_seconds()

                

                # cleaned comment

                if age_seconds < 1800:  # (comment)

                    remaining_minutes = int((1800 - age_seconds) / 60)

                    logger.info(f"Using cached poem data ({remaining_minutes} minutes left)")

                    return json.dumps(cached['result'], ensure_ascii=False)

                else:

                    logger.info(f"Poem cache expired ({int((age_seconds - 1800) / 60)} minutes over)")

            else:

                logger.info("Using cached weather/poetry API data")

            

            # cleaned comment

            from backend.services.shici_service import ShiciService

            

            shici_service = ShiciService()

            shici_data = shici_service.get_shici()

            

            if shici_data:

                result = {

                    "status": "success",

                    "data": shici_data

                }

                

                # (comment)

                self._operation_cache[cache_key] = {

                    'result': result,

                    'timestamp': datetime.now().isoformat(),

                    'status': 'success'

                }

                logger.info("Poem data cached (valid 30 minutes)")

                

                return json.dumps(result, ensure_ascii=False)

            else:

                return json.dumps({

                    "status": "error",

                    "message": "获取诗词失败，请稍后重试"

                }, ensure_ascii=False)

                

        except Exception as e:

            logger.info(f"get_shici failed: {e}")

            traceback.print_exc()

            return json.dumps({

                "status": "error",

                "message": str(e)

            }, ensure_ascii=False)


    def _refresh_weather_and_shici_async(self, location: str):
        """
        寮傛鍒锋柊澶╂皵鍜岃瘲璇嶆暟鎹紙鍚庡彴绾跨▼锛?
        
        Args:
            location: 澶╂皵位置锛堝煄甯傚悕鎴栫粡绾害锛?
        """
        import threading
        
        def refresh_task():
            try:
                logger.info(f"开始异步刷新天气和诗词数据 (位置: {location})")
                
                # 1. 刷新天气数据
                weather_result = self.get_weather(location)
                weather_data = json.loads(weather_result)
                
                if weather_data.get('status') == 'success':
                    logger.info("天气数据刷新成功")
                    # 发送信号通知前端
                    self.weatherDataUpdated.emit(weather_result)
                else:
                    logger.info(f"天气数据刷新失败: {weather_data.get('message')}")
                
                # 2. 刷新诗词数据
                shici_result = self.get_shici()
                shici_data = json.loads(shici_result)
                
                if shici_data.get('status') == 'success':
                    logger.info("诗词数据刷新成功")
                    # 发送信号通知前端
                    self.shiciDataUpdated.emit(shici_result)
                else:
                    logger.info(f"诗词数据刷新失败: {shici_data.get('message')}")
                    
            except Exception as e:
                logger.info(f"寮傛鍒锋柊澶辫触: {e}")
                import traceback
                traceback.print_exc()
        
        # 鍦ㄥ悗鍙扮嚎绋嬫墽琛屽埛鏂颁换鍔?
        thread = threading.Thread(target=refresh_task, daemon=True)
        thread.start()
        logger.info("Background refresh thread started")




    # =========================================================================
    # GPA Records Management
    # =========================================================================
    
    @pyqtSlot(result=str)
    def get_gpa_records(self):
        """Get all GPA records"""
        try:
            gpa_file = os.path.join(self.data_dir, 'gpa_records.json')
            
            if not os.path.exists(gpa_file):
                # Create empty file if not exists
                self._atomic_write_json(gpa_file, [])
                return json.dumps({"status": "success", "records": []}, ensure_ascii=False)
            
            with open(gpa_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
            
            logger.info(f"Loaded {len(records)} GPA records")
            return json.dumps({"status": "success", "records": records}, ensure_ascii=False)
            
        except Exception as e:
            error_msg = f"Failed to load GPA records: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)
    
    @pyqtSlot(str, result=str)
    def save_gpa_record(self, record_json):
        """Save or update a GPA record"""
        try:
            record = json.loads(record_json)
            gpa_file = os.path.join(self.data_dir, 'gpa_records.json')
            
            # Load existing records
            if os.path.exists(gpa_file):
                with open(gpa_file, 'r', encoding='utf-8') as f:
                    records = json.load(f)
            else:
                records = []
            
            # Check if semester already exists
            semester = record.get('semester', '')
            existing_index = -1
            for i, r in enumerate(records):
                if r.get('semester') == semester:
                    existing_index = i
                    break
            
            if existing_index >= 0:
                # Update existing record
                records[existing_index] = record
                logger.info(f"Updated GPA record for {semester}")
            else:
                # Add new record
                records.append(record)
                logger.info(f"Added new GPA record for {semester}")
            
            # Sort by semester
            records.sort(key=lambda x: x.get('semester', ''))
            
            # Save to file
            self._atomic_write_json(gpa_file, records)
            self._run_auto_backup_if_needed()
            
            return json.dumps({"status": "success", "records": records}, ensure_ascii=False)
            
        except Exception as e:
            error_msg = f"Failed to save GPA record: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)
    
    @pyqtSlot(str, result=str)
    def delete_gpa_record(self, semester):
        """Delete a GPA record by semester"""
        try:
            gpa_file = os.path.join(self.data_dir, 'gpa_records.json')
            
            if not os.path.exists(gpa_file):
                return json.dumps({"status": "error", "message": "No GPA records found"}, ensure_ascii=False)
            
            with open(gpa_file, 'r', encoding='utf-8') as f:
                records = json.load(f)
            
            # Filter out the record to delete
            original_count = len(records)
            records = [r for r in records if r.get('semester') != semester]
            
            if len(records) == original_count:
                return json.dumps({"status": "error", "message": f"Semester {semester} not found"}, ensure_ascii=False)
            
            # Save updated records
            self._atomic_write_json(gpa_file, records)
            self._run_auto_backup_if_needed()
            
            logger.info(f"Deleted GPA record for {semester}")
            return json.dumps({"status": "success", "records": records}, ensure_ascii=False)
            
        except Exception as e:
            error_msg = f"Failed to delete GPA record: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)
    
    @pyqtSlot(result=str)
    def get_daily_notes(self):
        """Get all daily notes"""
        try:
            notes_file = os.path.join(self.data_dir, 'daily_notes.json')
            
            if not os.path.exists(notes_file):
                # Create empty file if not exists
                self._atomic_write_json(notes_file, {})
                return json.dumps({"status": "success", "notes": {}}, ensure_ascii=False)
            
            with open(notes_file, 'r', encoding='utf-8') as f:
                notes = json.load(f)
            
            logger.info(f"Loaded {len(notes)} daily notes")
            return json.dumps({"status": "success", "notes": notes}, ensure_ascii=False)
            
        except Exception as e:
            error_msg = f"Failed to load daily notes: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)
    
    @pyqtSlot(str, str, result=str)
    def save_daily_note(self, date_key, content):
        """Save or update a daily note"""
        try:
            notes_file = os.path.join(self.data_dir, 'daily_notes.json')
            
            # Load existing notes
            if os.path.exists(notes_file):
                with open(notes_file, 'r', encoding='utf-8') as f:
                    notes = json.load(f)
            else:
                notes = {}
            
            # Update or add note
            notes[date_key] = content
            logger.info(f"Saved daily note for {date_key}")
            
            # Save to file
            self._atomic_write_json(notes_file, notes)
            self._run_auto_backup_if_needed()
            
            return json.dumps({"status": "success", "notes": notes}, ensure_ascii=False)
            
        except Exception as e:
            error_msg = f"Failed to save daily note: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)
    
    @pyqtSlot(str, result=str)
    def delete_daily_note(self, date_key):
        """Delete a daily note by date key"""
        try:
            notes_file = os.path.join(self.data_dir, 'daily_notes.json')
            
            if not os.path.exists(notes_file):
                return json.dumps({"status": "error", "message": "No daily notes found"}, ensure_ascii=False)
            
            with open(notes_file, 'r', encoding='utf-8') as f:
                notes = json.load(f)
            
            # Delete the note if exists
            if date_key in notes:
                del notes[date_key]
                logger.info(f"Deleted daily note for {date_key}")
            else:
                return json.dumps({"status": "error", "message": f"Note for {date_key} not found"}, ensure_ascii=False)
            
            # Save updated notes
            self._atomic_write_json(notes_file, notes)
            self._run_auto_backup_if_needed()
            
            return json.dumps({"status": "success", "notes": notes}, ensure_ascii=False)
            
        except Exception as e:
            error_msg = f"Failed to delete daily note: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return json.dumps({"status": "error", "message": error_msg}, ensure_ascii=False)

    @pyqtSlot(result=str)
    def clear_runtime_cache(self):
        """Clear runtime cache files and in-memory caches."""
        try:
            removed = []
            cache_targets = [
                os.path.join(self.data_dir, 'cache'),
                os.path.join(self.data_dir, 'temp'),
                os.path.join(self.data_dir, 'webengine_cache'),
                os.path.join(self.data_dir, 'webengine_storage', 'Service Worker', 'CacheStorage'),
                os.path.join(current_dir, '__pycache__'),
                os.path.join(current_dir, 'backend', '__pycache__'),
                os.path.join(current_dir, 'backend', 'core', '__pycache__'),
                os.path.join(current_dir, 'backend', 'models', '__pycache__'),
            ]
            for path in cache_targets:
                try:
                    if os.path.exists(path):
                        shutil.rmtree(path)
                        removed.append(path)
                except Exception:
                    pass

            cache_files = [
                os.path.join(self.data_dir, 'weather_cache.json'),
                os.path.join(self.data_dir, 'shici_cache.json'),
            ]
            for file_path in cache_files:
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        removed.append(file_path)
                except Exception:
                    pass

            with self._cache_lock:
                self._operation_cache.clear()

            self.cacheUpdated.emit(json.dumps({"status": "success", "removed": removed}, ensure_ascii=False))
            self.dataStateChanged.emit("runtime_cache_cleared")
            return self._success_response("运行缓存已清理", data={"removed_count": len(removed), "removed": removed})
        except Exception as e:
            return self._error_response(f"娓呯悊杩愯缂撳瓨澶辫触: {str(e)}", "CACHE_CLEAR_FAILED")

    @pyqtSlot(result=str)
    def export_all_data(self):
        """Export all application data to JSON file with timestamp"""
        try:
            # Generate timestamp for filename
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"export_{timestamp}.json"
            
            # Determine export path (Downloads folder or fallback to data directory)
            try:
                # Try to get user's Downloads folder
                if sys.platform == 'win32':
                    import winreg
                    sub_key = r'SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders'
                    downloads_guid = '{374DE290-123F-4565-9164-39C4925E467B}'
                    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, sub_key) as key:
                        downloads_path = winreg.QueryValueEx(key, downloads_guid)[0]
                else:
                    # For macOS and Linux
                    downloads_path = os.path.join(os.path.expanduser('~'), 'Downloads')
                
                # Verify Downloads folder exists
                if not os.path.exists(downloads_path):
                    downloads_path = self.data_dir
            except Exception as e:
                logger.info(f"Could not access Downloads folder: {e}, using data directory")
                downloads_path = self.data_dir
            
            export_path = os.path.join(downloads_path, filename)
            
            # Collect all application data
            export_data = {
                "export_timestamp": timestamp,
                "export_date": datetime.now().isoformat(),
                "version": "1.0",
                "data": self._collect_data_snapshot().get("data", {})
            }
            
            # Write export file
            self._atomic_write_json(export_path, export_data)
            
            logger.info(f"Successfully exported all data to {export_path}")
            
            # Emit signal to notify frontend
            self.dataStateChanged.emit(json.dumps({
                "action": "export_completed",
                "file_path": export_path,
                "timestamp": timestamp
            }, ensure_ascii=False))
            
            payload = {"file_path": export_path, "filename": filename}
            return self._success_response("数据导出成功", data=payload, **payload)
            
        except PermissionError as e:
            error_msg = f"导出失败：没有写入权限。{str(e)}"
            logger.info(f"{error_msg}")
            return self._error_response(error_msg, "EXPORT_PERMISSION_DENIED")
        except Exception as e:
            error_msg = f"瀵煎嚭澶辫触: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return self._error_response(error_msg, "EXPORT_EXCEPTION")

    @pyqtSlot(result=str)
    def reset_app_data(self):
        """Reset all application data to defaults with backup"""
        try:
            logger.info("Starting app data reset...")
            
            # Step 1: Create backup before reset (recommended)
            backup_timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            backup_filename = f"backup_before_reset_{backup_timestamp}.json"
            encrypted_backup_path = None
            
            try:
                # Determine backup path
                backup_dir = os.path.join(self.data_dir, 'backups')
                os.makedirs(backup_dir, exist_ok=True)
                backup_path = os.path.join(backup_dir, backup_filename)
                
                # Collect current data for backup
                backup_data = {
                    "backup_timestamp": backup_timestamp,
                    "backup_date": datetime.now().isoformat(),
                    "backup_reason": "pre_reset_backup",
                    "data": self._collect_data_snapshot().get("data", {})
                }
                
                # Write backup file
                self._atomic_write_json(backup_path, backup_data)
                
                logger.info(f"Created backup at {backup_path}")
                try:
                    encrypted_backup_path = self._create_encrypted_backup("pre_reset")
                    logger.info(f"Created encrypted backup at {encrypted_backup_path}")
                except Exception as _:
                    pass
                
            except Exception as e:
                logger.info(f"Warning: Failed to create backup: {e}")
                # Continue with reset even if backup fails
            
            # Step 2: Reset all data to defaults
            
            # 2.1 Clear courses (reset to empty list)
            try:
                self._atomic_write_json(self.courses_file, [])
                logger.info("Cleared courses")
            except Exception as e:
                logger.info(f"Failed to clear courses: {e}")
            
            # 2.2 Clear tasks (reset to empty list)
            try:
                self._atomic_write_json(self.tasks_file, [])
                if self.task_manager:
                    self.task_manager.tasks = []
                logger.info("Cleared tasks")
            except Exception as e:
                logger.info(f"Failed to clear tasks: {e}")
            
            # 2.3 Clear GPA records (reset to empty list)
            try:
                gpa_file = os.path.join(self.data_dir, 'gpa_records.json')
                self._atomic_write_json(gpa_file, [])
                logger.info("Cleared GPA records")
            except Exception as e:
                logger.info(f"Failed to clear GPA records: {e}")
            
            # 2.4 Clear daily notes (reset to empty dict)
            try:
                notes_file = os.path.join(self.data_dir, 'daily_notes.json')
                self._atomic_write_json(notes_file, {})
                logger.info("Cleared daily notes")
            except Exception as e:
                logger.info(f"Failed to clear daily notes: {e}")
            
            # 2.5 Clear course groups (reset to empty list)
            try:
                self._atomic_write_json(self.groups_file, [])
                logger.info("Cleared course groups")
            except Exception as e:
                logger.info(f"Failed to clear course groups: {e}")
            
            # 2.6 Reset settings to defaults (including new URL fields)
            try:
                if self.settings_manager:
                    self.settings_manager.reset_to_defaults()
                    # Reload settings in bridge
                    self.settings = self.load_settings()
                    logger.info("Reset settings to defaults")
                else:
                    # Fallback: manually reset settings
                    from backend.models.schedule_settings import ScheduleSettings
                    default_settings = ScheduleSettings()
                    self._atomic_write_json(self.settings_file, default_settings.to_dict())
                    self.settings = default_settings.to_dict()
                    logger.info("Reset settings to defaults (fallback)")
            except Exception as e:
                logger.info(f"Failed to reset settings: {e}")
            
            # Step 3: Emit signals to notify frontend of reset completion
            
            # Emit dataStateChanged signal
            self.dataStateChanged.emit(json.dumps({
                "action": "reset_completed",
                "timestamp": backup_timestamp,
                "backup_path": backup_path if 'backup_path' in locals() else None
            }, ensure_ascii=False))
            
            # Emit settingsUpdated signal to refresh settings in frontend
            self.settingsUpdated.emit(json.dumps(self.settings, ensure_ascii=False))
            
            # Emit scheduleDataUpdated signal to refresh schedule
            self.scheduleDataUpdated.emit()
            self._run_auto_backup_if_needed(force=True)
            
            logger.info("Successfully reset all application data")
            
            # Step 4: Return success status
            return json.dumps({
                "status": "success",
                "message": "All application data has been reset to defaults",
                "backup_path": backup_path if 'backup_path' in locals() else None,
                "encrypted_backup_path": encrypted_backup_path,
                "timestamp": backup_timestamp
            }, ensure_ascii=False)
            
        except Exception as e:
            error_msg = f"Failed to reset app data: {str(e)}"
            logger.info(f"{error_msg}")
            traceback.print_exc()
            return json.dumps({
                "status": "error",
                "message": error_msg
            }, ensure_ascii=False)



