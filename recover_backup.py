"""Inspect a Spark Schedule Fernet snapshot without touching live application data.

A plaintext recovery preview is written only after explicit opt-in and confirmation.
The preview is for manual review/recovery; this tool never overwrites data/.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from backend.bridge_security import backup_key_path

MAX_BACKUP_BYTES = 64 * 1024 * 1024
ROOT = Path(__file__).resolve().parent


def inspect_backup(backup_file: Path, key_file: Path) -> dict:
    """Decrypt and validate one snapshot in memory; never print its values."""
    from cryptography.fernet import Fernet, InvalidToken

    if backup_file.is_symlink() or not backup_file.is_file() or backup_file.suffix.lower() != ".bak":
        raise ValueError("Select an existing regular .bak snapshot")
    if backup_file.stat().st_size > MAX_BACKUP_BYTES:
        raise ValueError("The backup exceeds the supported size limit")
    if key_file.is_symlink() or not key_file.is_file():
        raise ValueError("A regular per-user backup key file is required")
    try:
        decrypted = Fernet(key_file.read_bytes()).decrypt(backup_file.read_bytes())
    except (InvalidToken, ValueError) as exc:
        raise ValueError("The backup cannot be decrypted with this key") from exc
    try:
        snapshot = json.loads(decrypted)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("The decrypted backup is not valid JSON") from exc
    if not isinstance(snapshot, dict) or snapshot.get("schema") != "spark_schedule_backup_v1":
        raise ValueError("This is not a supported Spark Schedule snapshot")
    if not isinstance(snapshot.get("data"), dict):
        raise ValueError("The snapshot has no valid data section")
    return snapshot


def write_plaintext_preview(snapshot: dict, output: Path) -> None:
    """Write a NEW user-selected preview, never inside the live project data/."""
    if not output.is_absolute() or output.suffix.lower() != ".json":
        raise ValueError("Choose an absolute local .json output path")
    if str(output).startswith(("\\\\", "//")):
        raise ValueError("Network output paths are not allowed")
    if output.exists() or output.is_symlink():
        raise FileExistsError("The output already exists; no file will be overwritten")
    if not output.parent.is_dir():
        raise ValueError("The output directory must already exist")
    resolved_parent = output.parent.resolve(strict=True)
    live_data = (ROOT / "data").resolve()
    if resolved_parent == live_data or live_data in resolved_parent.parents:
        raise ValueError("Recovery previews must not be written into live application data")

    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_BINARY"):
        flags |= os.O_BINARY
    encoded = (json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    descriptor = os.open(output, flags, 0o600)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
    except Exception:
        output.unlink(missing_ok=True)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Inspect an encrypted Spark Schedule backup safely")
    parser.add_argument("backup", type=Path, help="Existing snapshot_*.bak file")
    parser.add_argument("--key-file", type=Path, default=Path(backup_key_path()), help="Private Fernet key; defaults to this user's key")
    parser.add_argument("--output", type=Path, help="New plaintext JSON preview path, outside live data/")
    parser.add_argument("--allow-plaintext", action="store_true", help="Acknowledge that --output contains all personal data and saved API keys")
    args = parser.parse_args(argv)

    try:
        snapshot = inspect_backup(args.backup, args.key_file)
        print("Backup verified; data categories:", ", ".join(sorted(snapshot["data"].keys())))
        if args.output is not None:
            if not args.allow_plaintext:
                raise ValueError("Use --allow-plaintext only when a recovery preview is needed")
            try:
                answer = input("The preview contains ALL personal data and API keys. Type RESTORE to write it: ")
            except EOFError:
                answer = ""
            if answer != "RESTORE":
                raise ValueError("Recovery preview cancelled; no file was written")
            write_plaintext_preview(snapshot, args.output)
            print("Plaintext recovery preview created at the selected location. Protect and remove it after use.")
        return 0
    except (OSError, ValueError, ImportError) as exc:
        print(f"Recovery stopped: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
