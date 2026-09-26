"""Security regressions for the WebEngine entry point (no real user data)."""

import importlib.util
import json
import logging
import os
from pathlib import Path
import sys
import types

import pytest

pytest.importorskip("PyQt6.QtWebEngineCore")
from PyQt6.QtCore import QUrl
from PyQt6.QtWebEngineCore import QWebEnginePage


@pytest.fixture(scope="module")
def app_module():
    # Importing the real bridge/logger would initialize application storage.
    bridge = types.ModuleType("bridge")
    bridge.AppBridge = type("AppBridge", (), {})
    logger = types.ModuleType("logger_setup")
    logger.logger = logging.getLogger("test_main_security")
    previous = {name: sys.modules.get(name) for name in ("bridge", "logger_setup")}
    sys.modules.update({"bridge": bridge, "logger_setup": logger})
    try:
        path = Path(__file__).resolve().parents[1] / "main.py"
        spec = importlib.util.spec_from_file_location("_tested_spark_main", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        yield module
    finally:
        for name, original in previous.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original


def test_remote_debugging_is_opt_in_and_local(app_module, tmp_path, monkeypatch):
    settings = tmp_path / "settings.json"
    monkeypatch.setattr(app_module, "get_data_path", lambda _name="": str(settings))
    monkeypatch.setenv("QTWEBENGINE_REMOTE_DEBUGGING", "0.0.0.0:8888")
    app_module.prepare_webengine_env_from_settings()
    assert "QTWEBENGINE_REMOTE_DEBUGGING" not in os.environ
    settings.write_text(json.dumps({"enable_devtools": "false"}), encoding="utf-8")
    app_module.prepare_webengine_env_from_settings()
    assert "QTWEBENGINE_REMOTE_DEBUGGING" not in os.environ
    settings.write_text(json.dumps({"enable_devtools": True}), encoding="utf-8")
    app_module.prepare_webengine_env_from_settings()
    assert os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] == "127.0.0.1:8888"
    monkeypatch.delenv("QTWEBENGINE_REMOTE_DEBUGGING", raising=False)


@pytest.mark.parametrize("url,allowed", [
    ("https://school.example.edu/path", True),
    ("http://school.example.edu/", True),
    ("file:///C:/Users/secret.txt", False),
    ("data:text/html,hello", False),
    ("javascript:alert(1)", False),
    ("http://user:pass@school.example.edu/", False),
    ("not a URL", False),
])
def test_import_url_allowlist(app_module, url, allowed):
    assert bool(app_module.ScholarApp._safe_import_url(url)) is allowed


def test_privileged_page_rejects_navigation_outside_bundle(app_module, tmp_path):
    root = tmp_path / "frontend" / "dist"
    root.mkdir(parents=True)
    trusted = root / "index.html"
    trusted.write_text("<!doctype html>", encoding="utf-8")
    page = types.SimpleNamespace(_trusted_root=os.path.normcase(os.path.realpath(root)))
    accept = app_module.TrustedAppPage.acceptNavigationRequest
    other = QWebEnginePage.NavigationType.NavigationTypeOther
    assert accept(page, QUrl.fromLocalFile(str(trusted)), other, True)
    assert not accept(page, QUrl.fromLocalFile(str(tmp_path / "secret.html")), other, True)
    assert not accept(page, QUrl("https://untrusted.example/"), other, True)
    import_page = app_module.RestrictedImportPage.acceptNavigationRequest
    assert import_page(None, QUrl("https://school.example/"), other, True)
    assert not import_page(None, QUrl.fromLocalFile(str(trusted)), other, True)


def test_privileged_frontend_entry_has_no_remote_script():
    from html.parser import HTMLParser

    class ScriptSources(HTMLParser):
        def __init__(self):
            super().__init__()
            self.sources = []

        def handle_starttag(self, tag, attrs):
            if tag.lower() == "script":
                self.sources.extend(value for key, value in attrs if key == "src" and value)

    parser = ScriptSources()
    parser.feed((Path(__file__).resolve().parents[1] / "frontend" / "index.html").read_text(encoding="utf-8"))
    assert parser.sources
    assert all(QUrl(source).scheme().lower() not in ("http", "https", "file", "data")
               for source in parser.sources)
