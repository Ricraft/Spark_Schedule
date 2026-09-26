"""Recovery previews use temporary fixtures only; live application data is untouched."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from backend.bridge_security import encrypt_backup_payload
from recover_backup import inspect_backup, main, write_plaintext_preview


class BackupRecoveryTests(unittest.TestCase):
    def test_encrypted_snapshot_can_be_inspected_and_previewed_exclusively(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix="recovery-fixture-") as root:
            work = Path(root)
            backup_dir = work / "backups"
            backup_dir.mkdir()
            key_file = work / "profile" / "Security" / "backup.key"
            source = work / "snapshot_pre_reset.bak"
            snapshot = {
                "schema": "spark_schedule_backup_v1",
                "created_at": "2026-01-01T00:00:00",
                "data": {"courses": [{"name": "fixture"}], "settings": {"ai_api_key": "fixture-only-secret"}},
            }
            source.write_bytes(encrypt_backup_payload(json.dumps(snapshot).encode(), str(key_file), str(backup_dir)))
            self.assertNotIn(b"fixture-only-secret", source.read_bytes())
            self.assertEqual(inspect_backup(source, key_file), snapshot)

            preview = work / "private-preview.json"
            write_plaintext_preview(snapshot, preview)
            self.assertEqual(json.loads(preview.read_text(encoding="utf-8")), snapshot)
            with self.assertRaises(FileExistsError):
                write_plaintext_preview(snapshot, preview)

            live_dir = work / "data"
            live_dir.mkdir()
            with mock.patch("recover_backup.ROOT", work), self.assertRaisesRegex(ValueError, "live application data"):
                write_plaintext_preview(snapshot, live_dir / "settings.json")
            self.assertFalse((live_dir / "settings.json").exists())

    def test_wrong_key_and_missing_plaintext_consent_do_not_create_preview(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent, prefix="recovery-fixture-") as root:
            work = Path(root)
            backup_dir = work / "backups"
            backup_dir.mkdir()
            key_file = work / "private" / "backup.key"
            source = work / "snapshot_auto.bak"
            source.write_bytes(encrypt_backup_payload(
                b'{"schema":"spark_schedule_backup_v1","data":{"tasks":[]}}',
                str(key_file), str(backup_dir),
            ))
            other_key = work / "wrong.key"
            from cryptography.fernet import Fernet
            other_key.write_bytes(Fernet.generate_key())
            with self.assertRaisesRegex(ValueError, "cannot be decrypted"):
                inspect_backup(source, other_key)

            preview = work / "preview.json"
            with mock.patch("sys.stdout"), mock.patch("sys.stderr"):
                self.assertEqual(main([str(source), "--key-file", str(key_file), "--output", str(preview)]), 1)
                with mock.patch("builtins.input", return_value="NO"):
                    self.assertEqual(main([str(source), "--key-file", str(key_file),
                                           "--output", str(preview), "--allow-plaintext"]), 1)
            self.assertFalse(preview.exists())


if __name__ == "__main__":
    unittest.main()
