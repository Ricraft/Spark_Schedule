"""Safe, reproducible packaging entry point using the allowlisted spec."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
FRONTEND_INDEX = FRONTEND_DIR / "dist" / "index.html"
SPEC_FILE = PROJECT_ROOT / "build_exe_clean.spec"


def run_checked(command: list[str], *, cwd: Path, label: str) -> None:
    """Run a build step and preserve its non-zero status as a failure."""
    print(f"\n[{label}] {' '.join(command)}", flush=True)
    try:
        subprocess.run(command, cwd=cwd, check=True)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Required command was not found: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"{label} failed with exit code {exc.returncode}.") from exc


def main() -> int:
    if not (FRONTEND_DIR / "package.json").is_file():
        print("[FAIL] frontend/package.json is missing.", file=sys.stderr)
        return 1
    if not (FRONTEND_DIR / "package-lock.json").is_file():
        print("[FAIL] frontend/package-lock.json is missing; npm ci cannot be reproducible.", file=sys.stderr)
        return 1
    if not SPEC_FILE.is_file():
        print("[FAIL] build_exe_clean.spec is missing.", file=sys.stderr)
        return 1

    try:
        run_checked(["npm", "ci"], cwd=FRONTEND_DIR, label="Install locked frontend dependencies")
        run_checked(["npm", "run", "build"], cwd=FRONTEND_DIR, label="Build frontend")
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        if "npm" in str(exc):
            print("Install Node.js with npm, then rerun this script.", file=sys.stderr)
        return 1

    if not FRONTEND_INDEX.is_file():
        print("[FAIL] Expected frontend/dist/index.html was not produced.", file=sys.stderr)
        return 1

    try:
        run_checked([sys.executable, "pre_package_check.py"], cwd=PROJECT_ROOT, label="Pre-package checks")
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    try:
        pyinstaller_check = subprocess.run(
            [sys.executable, "-m", "PyInstaller", "--version"],
            cwd=PROJECT_ROOT,
            check=False,
        )
    except FileNotFoundError:
        print("[FAIL] The active Python executable is unavailable.", file=sys.stderr)
        return 1
    if pyinstaller_check.returncode != 0:
        print("[FAIL] PyInstaller is not installed for the active Python.", file=sys.stderr)
        print("Install with: python -m pip install pyinstaller", file=sys.stderr)
        return 1

    try:
        run_checked(
            [sys.executable, "-m", "PyInstaller", str(SPEC_FILE), "--clean", "--noconfirm"],
            cwd=PROJECT_ROOT,
            label="PyInstaller safe package",
        )
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    executable = PROJECT_ROOT / "dist" / "SparkSchedule" / "SparkSchedule.exe"
    if not executable.is_file():
        print(f"[FAIL] Expected executable was not produced: {executable}", file=sys.stderr)
        return 1

    print(f"\n[OK] Package created: {executable}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
