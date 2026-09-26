"""Side-effect-free tests for bridge security helpers and slot wiring.

These tests never import bridge.py (logger_setup creates the real data/logs
folder) or instantiate AppBridge. File fixtures are confined to a temporary
folder under this test directory and removed automatically.
"""

import ast
import builtins
from datetime import datetime
import importlib.util
import json
import os
import pathlib
import stat
import sys
import types
import unittest
from tempfile import TemporaryDirectory
from unittest import mock

from backend.bridge_security import (
    SECRET_SETTING_FIELDS,
    SECRET_SETTING_PLACEHOLDER,
    encrypt_backup_payload,
    get_weather_request,
    normalize_ai_endpoint,
    normalize_weather_host,
    post_ai_request,
    redact_settings,
    restore_secret_placeholders,
    validate_public_weather_host,
    validate_settings_file_path,
)


ROOT = pathlib.Path(__file__).resolve().parents[2]
BRIDGE_PATH = ROOT / "bridge.py"
TEST_DIR = pathlib.Path(__file__).resolve().parent


class FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code


class FakeRequests:
    def __init__(self, status_code=200):
        self.status_code = status_code
        self.calls = []

    def post(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return FakeResponse(self.status_code)

    def get(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return FakeResponse(self.status_code)


class SecretRedactionTests(unittest.TestCase):
    def test_redacts_keys_with_fixed_marker_and_preserves_nonsecrets(self):
        secret = "not-a-real-credential"
        settings = {name: secret for name in SECRET_SETTING_FIELDS}
        settings["weather_location"] = "Test City"

        safe = redact_settings(settings)

        self.assertEqual(safe["weather_location"], "Test City")
        for name in SECRET_SETTING_FIELDS:
            self.assertEqual(safe[name], SECRET_SETTING_PLACEHOLDER)
            self.assertNotIn(secret, safe[name])

    def test_placeholder_echo_keeps_current_key_but_new_value_is_accepted(self):
        current = {name: "stored-test-value" for name in SECRET_SETTING_FIELDS}
        updates = {name: SECRET_SETTING_PLACEHOLDER for name in SECRET_SETTING_FIELDS}
        updates["ai_api_key"] = SECRET_SETTING_PLACEHOLDER
        updates["weather_location"] = "Another City"

        restored = restore_secret_placeholders(updates, current)

        self.assertEqual(restored["ai_api_key"], current["ai_api_key"])
        self.assertEqual(restored["weather_api_key"], current["weather_api_key"])
        self.assertEqual(restored["weather_location"], "Another City")
        self.assertEqual(restore_secret_placeholders({"ai_api_key": "new-test-value"}, current)["ai_api_key"], "new-test-value")


class AiEndpointTests(unittest.TestCase):
    def test_https_is_default_and_loopback_http_is_the_only_exception(self):
        self.assertEqual(
            normalize_ai_endpoint("https://api.example.test/v1"),
            "https://api.example.test/v1/chat/completions",
        )
        self.assertEqual(
            normalize_ai_endpoint("http://localhost:8080/v1"),
            "http://localhost:8080/v1/chat/completions",
        )
        self.assertEqual(
            normalize_ai_endpoint("http://127.0.0.1:8080/v1"),
            "http://127.0.0.1:8080/v1/chat/completions",
        )
        with self.assertRaises(ValueError):
            normalize_ai_endpoint("http://api.example.test/v1")
        with self.assertRaises(ValueError):
            normalize_ai_endpoint("https://user:password@api.example.test/v1")
        with self.assertRaises(ValueError):
            normalize_ai_endpoint("https://api.example.test/v1?token=unsafe")

    def test_unapproved_endpoint_is_not_called_when_native_consent_is_denied(self):
        requester = FakeRequests()
        approved = set()
        prompted = []

        with self.assertRaisesRegex(RuntimeError, "approval"):
            post_ai_request(
                requester,
                "https://attacker.example/v1",
                "test-only-key",
                {"message": "test"},
                approved_endpoints=approved,
                confirm_callback=lambda endpoint: prompted.append(endpoint) or False,
            )

        self.assertEqual(requester.calls, [])
        self.assertEqual(prompted, ["https://attacker.example/v1/chat/completions"])
        self.assertEqual(approved, set())

    def test_exact_endpoint_is_approved_once_and_redirects_are_rejected(self):
        requester = FakeRequests(status_code=200)
        endpoint = "https://custom.example/v1/chat/completions"
        approved = set()
        confirmations = []
        post_ai_request(
            requester,
            "https://custom.example/v1",
            "test-only-key",
            {"message": "test"},
            approved_endpoints=approved,
            confirm_callback=lambda value: confirmations.append(value) or True,
        )
        post_ai_request(
            requester,
            "https://custom.example/v1/chat/completions",
            "test-only-key",
            {"message": "test"},
            approved_endpoints=approved,
            confirm_callback=lambda value: self.fail("approved endpoint prompted twice"),
        )

        self.assertEqual(confirmations, [endpoint])
        self.assertEqual(len(requester.calls), 2)
        self.assertFalse(requester.calls[0][1]["allow_redirects"])
        self.assertEqual(requester.calls[0][1]["headers"]["Authorization"], "Bearer test-only-key")

        redirecting = FakeRequests(status_code=302)
        with self.assertRaisesRegex(RuntimeError, "redirects"):
            post_ai_request(
                redirecting,
                "https://api.openai.com/v1",
                "test-only-key",
                {},
                approved_endpoints={normalize_ai_endpoint("https://api.openai.com/v1")},
            )

    def test_insecure_remote_endpoint_is_rejected_before_request(self):
        requester = FakeRequests()
        with self.assertRaises(ValueError):
            post_ai_request(requester, "http://attacker.example/v1", "test-only-key", {})
        self.assertEqual(requester.calls, [])


class WeatherHostTests(unittest.TestCase):
    def test_weather_host_rejects_urls_credentials_ports_and_internal_ip_literals(self):
        for value in (
            "https://attacker.example/path",
            "attacker.example/path",
            "user@attacker.example",
            "attacker.example:443",
            "127.0.0.1",
            "10.1.2.3",
            "[::1]",
            "localhost",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_weather_host(value)

    def test_weather_request_is_https_and_redirects_are_not_followed(self):
        public_resolver = lambda host, port, type: [(None, None, None, None, ("8.8.8.8", port))]
        requester = FakeRequests(status_code=200)
        get_weather_request(
            requester,
            "api.example.com",
            "/geo/v2/city/lookup",
            "test-only-key",
            {"location": "Test City"},
            resolver=public_resolver,
        )
        args, kwargs = requester.calls[0]
        self.assertEqual(args[0], "https://api.example.com/geo/v2/city/lookup")
        self.assertEqual(kwargs["params"]["key"], "test-only-key")
        self.assertFalse(kwargs["allow_redirects"])

        redirecting = FakeRequests(status_code=302)
        with self.assertRaisesRegex(RuntimeError, "redirects"):
            get_weather_request(
                redirecting,
                "api.example.com",
                "/v7/weather/now",
                "test-only-key",
                {"location": "101010100"},
                resolver=public_resolver,
            )
        self.assertFalse(redirecting.calls[0][1]["allow_redirects"])

        with self.assertRaisesRegex(ValueError, "path is not allowed"):
            get_weather_request(requester, "api.example.com", "/evil", "test-only-key", {}, resolver=public_resolver)

    def test_weather_dns_must_resolve_only_to_public_addresses(self):
        public_resolver = lambda host, port, type: [(None, None, None, None, ("8.8.8.8", port))]
        self.assertEqual(validate_public_weather_host("api.example.com", resolver=public_resolver), "api.example.com")

        private_resolver = lambda host, port, type: [(None, None, None, None, ("192.168.1.5", port))]
        with self.assertRaisesRegex(ValueError, "private or reserved"):
            validate_public_weather_host("api.example.com", resolver=private_resolver)

        mixed_resolver = lambda host, port, type: [
            (None, None, None, None, ("8.8.8.8", port)),
            (None, None, None, None, ("127.0.0.1", port)),
        ]
        with self.assertRaisesRegex(ValueError, "private or reserved"):
            validate_public_weather_host("api.example.com", resolver=mixed_resolver)


class SettingsPathTests(unittest.TestCase):
    def test_paths_are_absolute_json_local_and_outside_app_data(self):
        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-security-") as root:
            data_dir = os.path.join(root, "data")
            export_dir = os.path.join(root, "export")
            os.makedirs(data_dir)
            os.makedirs(export_dir)

            target = os.path.join(export_dir, "settings.json")
            self.assertEqual(validate_settings_file_path(target, data_dir, for_export=True), os.path.realpath(target))
            with self.assertRaisesRegex(ValueError, "inside application data"):
                validate_settings_file_path(os.path.join(data_dir, "settings.json"), data_dir, for_export=True)
            with self.assertRaisesRegex(ValueError, "absolute"):
                validate_settings_file_path("settings.json", data_dir, for_export=True)
            with self.assertRaisesRegex(ValueError, "extension"):
                validate_settings_file_path(os.path.join(export_dir, "settings.txt"), data_dir, for_export=True)

            source = os.path.join(export_dir, "import.json")
            pathlib.Path(source).write_text("{}", encoding="utf-8")
            self.assertEqual(validate_settings_file_path(source, data_dir, for_export=False), os.path.realpath(source))
            too_large = os.path.join(export_dir, "large.json")
            pathlib.Path(too_large).write_bytes(b"x" * (1024 * 1024 + 1))
            with self.assertRaisesRegex(ValueError, "too large"):
                validate_settings_file_path(too_large, data_dir, for_export=False)


class SettingsManagerExportTests(unittest.TestCase):
    def test_invalid_settings_are_not_overwritten_with_defaults_on_load(self):
        from backend.core.settings_manager import SettingsManager
        from backend.models.schedule_settings import ScheduleSettings

        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-invalid-settings-") as root:
            settings_file = pathlib.Path(root) / "settings.json"
            invalid = ScheduleSettings().to_dict()
            invalid["acrylic_opacity"] = -99
            original = json.dumps(invalid, ensure_ascii=False)
            settings_file.write_text(original, encoding="utf-8")
            manager = SettingsManager(str(settings_file), backup_dir=os.path.join(root, "backups"))
            self.assertEqual(settings_file.read_text(encoding="utf-8"), original)
            self.assertEqual(manager.settings.acrylic_opacity, ScheduleSettings().acrylic_opacity)

    def test_direct_json_export_redacts_and_reimport_preserves_existing_secrets(self):
        from backend.core.settings_manager import SettingsManager

        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-settings-") as root:
            data_dir = os.path.join(root, "data")
            os.makedirs(data_dir)
            manager = SettingsManager(os.path.join(data_dir, "settings.json"), backup_dir=os.path.join(data_dir, "backups"))
            manager.settings.ai_api_key = "original-test-secret"
            self.assertTrue(manager.save_settings(manager.settings))
            backup_success, backup_path = manager.create_manual_backup()
            self.assertTrue(backup_success)
            backup_payload = pathlib.Path(backup_path).read_text(encoding="utf-8")
            backup_data = json.loads(backup_payload)
            self.assertTrue(backup_data["secrets_redacted"])
            self.assertEqual(backup_data["ai_api_key"], "")
            self.assertNotIn("original-test-secret", backup_payload)

            exported = os.path.join(root, "export", "settings.json")
            os.makedirs(os.path.dirname(exported))
            self.assertTrue(manager.export_settings(exported))
            payload = pathlib.Path(exported).read_text(encoding="utf-8")
            parsed = json.loads(payload)
            self.assertTrue(parsed["secrets_redacted"])
            self.assertEqual(parsed["ai_api_key"], "")
            self.assertNotIn("original-test-secret", payload)

            manager.settings.ai_api_key = "current-test-secret"
            self.assertTrue(manager.save_settings(manager.settings))
            success, error = manager.import_settings(exported)
            self.assertTrue(success, error)
            self.assertEqual(manager.get_settings_dict()["ai_api_key"], "current-test-secret")

            manager.settings.ai_api_key = "restore-test-secret"
            self.assertTrue(manager.save_settings(manager.settings))
            success, error = manager.restore_from_backup(backup_path)
            self.assertTrue(success, error)
            self.assertEqual(manager.get_settings_dict()["ai_api_key"], "restore-test-secret")


class BackupEncryptionTests(unittest.TestCase):
    def test_corrupted_settings_are_not_copied_as_plaintext_when_crypto_fails(self):
        from backend.core.settings_manager import SettingsManager

        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-corrupt-settings-") as root:
            settings_file = os.path.join(root, "settings.json")
            backup_dir = os.path.join(root, "backups")
            manager = SettingsManager(settings_file, backup_dir=backup_dir)
            corrupted = '{"ai_api_key":"test-only-secret"'
            pathlib.Path(settings_file).write_text(corrupted, encoding="utf-8")

            with mock.patch("backend.core.settings_manager.encrypt_backup_payload", side_effect=RuntimeError("crypto unavailable")):
                manager.load_settings()

            self.assertEqual(pathlib.Path(settings_file).read_text(encoding="utf-8"), corrupted)
            corrupted_backups = [name for name in os.listdir(backup_dir) if name.startswith("settings_corrupted_")]
            self.assertEqual(corrupted_backups, [])

    def test_missing_cryptography_fails_closed_without_writing_a_key(self):
        real_import = builtins.__import__

        def fail_crypto(name, *args, **kwargs):
            if name == "cryptography.fernet":
                raise ImportError("deliberately unavailable for test")
            return real_import(name, *args, **kwargs)

        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-backup-") as root:
            backup_dir = os.path.join(root, "backups")
            key_file = os.path.join(root, "profile", "Security", "backup.key")
            os.makedirs(backup_dir)
            with mock.patch("builtins.__import__", side_effect=fail_crypto):
                with self.assertRaisesRegex(RuntimeError, "cryptography is required"):
                    encrypt_backup_payload(b"test-only-payload", key_file, backup_dir)
            self.assertFalse(os.path.exists(key_file))

    def test_key_file_is_outside_backup_directory_and_restricted(self):
        class FakeFernet:
            @staticmethod
            def generate_key():
                return b"unit-test-key"

            def __init__(self, key):
                self.key = key

            def encrypt(self, value):
                return b"encrypted:" + value

        cryptography_module = types.ModuleType("cryptography")
        cryptography_module.__path__ = []
        fernet_module = types.ModuleType("cryptography.fernet")
        fernet_module.Fernet = FakeFernet

        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-backup-") as root:
            backup_dir = os.path.join(root, "backups")
            key_file = os.path.join(root, "profile", "Security", "backup.key")
            os.makedirs(backup_dir)
            with mock.patch.dict(sys.modules, {
                "cryptography": cryptography_module,
                "cryptography.fernet": fernet_module,
            }):
                encrypted = encrypt_backup_payload(b"test-only-payload", key_file, backup_dir)

            self.assertEqual(encrypted, b"encrypted:test-only-payload")
            self.assertNotEqual(os.path.realpath(os.path.dirname(key_file)), os.path.realpath(backup_dir))
            nested_key = os.path.join(backup_dir, "private", "backup.key")
            with mock.patch.dict(sys.modules, {
                "cryptography": cryptography_module,
                "cryptography.fernet": fernet_module,
            }):
                with self.assertRaisesRegex(RuntimeError, "outside the backup directory"):
                    encrypt_backup_payload(b"test-only-payload", nested_key, backup_dir)
            with open(key_file, "rb") as key_stream:
                self.assertEqual(key_stream.read(), b"unit-test-key")
            if os.name != "nt":
                self.assertEqual(stat.S_IMODE(os.stat(key_file).st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(os.stat(os.path.dirname(key_file)).st_mode), 0o700)

    def test_legacy_backup_key_is_migrated_out_of_backup_directory(self):
        class FakeFernet:
            @staticmethod
            def generate_key():
                return b"new-test-key"

            def __init__(self, key):
                if key not in (b"old-test-key", b"new-test-key"):
                    raise ValueError("invalid test key")
                self.key = key

            def encrypt(self, value):
                return b"encrypted:" + value

        cryptography_module = types.ModuleType("cryptography")
        cryptography_module.__path__ = []
        fernet_module = types.ModuleType("cryptography.fernet")
        fernet_module.Fernet = FakeFernet

        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-backup-") as root:
            backup_dir = os.path.join(root, "backups")
            key_file = os.path.join(root, "profile", "Security", "backup.key")
            legacy_key_file = os.path.join(backup_dir, "backup.key")
            os.makedirs(backup_dir)
            pathlib.Path(legacy_key_file).write_bytes(b"old-test-key")
            with mock.patch.dict(sys.modules, {
                "cryptography": cryptography_module,
                "cryptography.fernet": fernet_module,
            }):
                encrypted = encrypt_backup_payload(
                    b"test-only-payload",
                    key_file,
                    backup_dir,
                    legacy_key_file=legacy_key_file,
                )

            self.assertEqual(encrypted, b"encrypted:test-only-payload")
            self.assertFalse(os.path.exists(legacy_key_file))
            with open(key_file, "rb") as key_stream:
                self.assertEqual(key_stream.read(), b"old-test-key")
            self.assertNotEqual(os.path.realpath(os.path.dirname(key_file)), os.path.realpath(backup_dir))

    @unittest.skipUnless(importlib.util.find_spec("cryptography") is not None, "cryptography is not installed")
    def test_fernet_key_is_private_and_outside_backup_directory(self):
        from cryptography.fernet import Fernet

        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-backup-") as root:
            backup_dir = os.path.join(root, "backups")
            key_file = os.path.join(root, "profile", "Security", "backup.key")
            os.makedirs(backup_dir)
            encrypted = encrypt_backup_payload(b"test-only-payload", key_file, backup_dir)

            self.assertNotEqual(os.path.realpath(os.path.dirname(key_file)), os.path.realpath(backup_dir))
            with open(key_file, "rb") as key_stream:
                key = key_stream.read()
            self.assertEqual(Fernet(key).decrypt(encrypted), b"test-only-payload")
            if os.name != "nt":
                self.assertEqual(stat.S_IMODE(os.stat(key_file).st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(os.stat(os.path.dirname(key_file)).st_mode), 0o700)


class BridgeWiringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Parse source only: importing bridge would initialize real data/log files.
        cls.tree = ast.parse(BRIDGE_PATH.read_text(encoding="utf-8"))
        cls.app_bridge = next(
            node for node in cls.tree.body
            if isinstance(node, ast.ClassDef) and node.name == "AppBridge"
        )
        cls.methods = {
            node.name: node
            for node in cls.app_bridge.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

    def _method_source(self, name):
        return ast.get_source_segment(BRIDGE_PATH.read_text(encoding="utf-8"), self.methods[name])

    def test_unreadable_existing_data_aborts_backup_instead_of_saving_empty_snapshot(self):
        # Compile only this side-effect-free method, never import the real bridge.
        module = ast.Module(body=[self.methods["_collect_data_snapshot"]], type_ignores=[])
        scope = {"datetime": datetime, "os": os, "json": json, "logger": mock.Mock()}
        exec(compile(module, str(BRIDGE_PATH), "exec"), scope)
        with TemporaryDirectory(dir=TEST_DIR, prefix="bridge-snapshot-") as root:
            courses = pathlib.Path(root) / "courses.json"
            courses.write_text('{"unfinished":', encoding="utf-8")
            fake_bridge = types.SimpleNamespace(
                data_dir=root,
                courses_file=str(courses),
                tasks_file=str(pathlib.Path(root) / "tasks.json"),
                settings_file=str(pathlib.Path(root) / "settings.json"),
                groups_file=str(pathlib.Path(root) / "groups.json"),
            )
            with self.assertRaisesRegex(RuntimeError, "Cannot back up existing courses data"):
                scope["_collect_data_snapshot"](fake_bridge)
            self.assertEqual(courses.read_text(encoding="utf-8"), '{"unfinished":')

    def test_sensitive_slots_require_native_authorization_and_redaction(self):
        reset = self._method_source("reset_app_data")
        self.assertIn("_confirm_native_action", reset)
        self.assertIn("_create_encrypted_backup", reset)
        self.assertIn("reset_partial_failure", reset)
        self.assertIn("RESET_PARTIAL_FAILURE", reset)
        self.assertIn("if not self.settings_manager.reset_to_defaults()", reset)
        self.assertNotIn("backup_before_reset_", reset)
        self.assertNotIn("_atomic_write_json(backup_path", reset)

        getter = self._method_source("get_global_settings")
        self.assertIn("_public_settings", getter)
        all_data_export = self._method_source("export_all_data")
        self.assertIn("SECRET_SETTING_FIELDS", all_data_export)
        self.assertIn('"secrets_redacted": True', all_data_export)
        self.assertIn("_confirm_native_action", all_data_export)
        for method_name in ("export_settings", "import_settings"):
            method = self._method_source(method_name)
            self.assertIn("validate_settings_file_path", method)
            self.assertIn("_confirm_native_action", method)

    def test_both_ai_slots_use_approval_gated_secure_transport(self):
        for method_name in ("analyze_task_with_ai", "get_learning_suggestions_with_ai"):
            source = self._method_source(method_name)
            self.assertIn("post_ai_request", source)
            self.assertIn("approved_endpoints=self._approved_ai_endpoints", source)
            self.assertIn("confirm_callback=self._confirm_ai_endpoint", source)
        self.assertNotIn("requests.post(", self._method_source("analyze_task_with_ai"))
        self.assertNotIn("requests.post(", self._method_source("get_learning_suggestions_with_ai"))
        self.assertIn("_approve_ai_endpoint", self._method_source("analyze_task_with_ai_async"))
        self.assertIn("_approve_ai_endpoint", self._method_source("get_learning_suggestions_with_ai_async"))

    def test_weather_slots_validate_and_authorize_host(self):
        for method_name in ("get_weather", "search_cities"):
            self.assertIn("_authorize_weather_host", self._method_source(method_name))
        weather_service_source = (ROOT / "backend" / "services" / "weather_service.py").read_text(encoding="utf-8")
        self.assertIn("get_weather_request", weather_service_source)
        ast.parse(weather_service_source)


if __name__ == "__main__":
    unittest.main()
