#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fail-closed checks for the allowlisted, frontend-first package build."""

from __future__ import annotations

import ast
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
EXPECTED_DATAS = {
    "resources": ("resources",),
    "frontend/dist": ("frontend", "dist"),
}
FORBIDDEN_DATA_PARTS = {
    "data",
    "backup",
    "backups",
    "token",
    "tokens",
    "jinrishici_token.txt",
}


def _assignment_values(tree: ast.AST) -> dict[str, ast.AST]:
    """Collect simple top-level assignments used by the spec allowlist."""
    values: dict[str, ast.AST] = {}
    for node in getattr(tree, "body", []):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    values[target.id] = node.value
    return values


def _path_literals(node: ast.AST, assignments: dict[str, ast.AST], seen: set[str] | None = None) -> tuple[str, ...]:
    """Resolve literal path components from a constrained os.path.join expression."""
    seen = set() if seen is None else seen
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return (node.value,)
    if isinstance(node, ast.Name) and node.id in assignments and node.id not in seen:
        return _path_literals(assignments[node.id], assignments, seen | {node.id})
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "join":
        parts: list[str] = []
        for argument in node.args:
            parts.extend(_path_literals(argument, assignments, seen))
        return tuple(parts)
    return ()


def read_spec_datas(spec_path: Path) -> list[tuple[tuple[str, ...], str]]:
    """Read only the `Analysis(datas=...)` allowlist without executing a spec."""
    tree = ast.parse(spec_path.read_text(encoding="utf-8"), filename=str(spec_path))
    assignments = _assignment_values(tree)
    datas_node: ast.AST | None = None
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name) or node.func.id != "Analysis":
            continue
        for keyword in node.keywords:
            if keyword.arg == "datas":
                datas_node = keyword.value
                break
        if datas_node is not None:
            break
    if not isinstance(datas_node, (ast.List, ast.Tuple)):
        raise ValueError("Analysis(datas=...) must be an explicit list/tuple allowlist")

    entries: list[tuple[tuple[str, ...], str]] = []
    for entry in datas_node.elts:
        if not isinstance(entry, (ast.Tuple, ast.List)) or len(entry.elts) != 2:
            raise ValueError("Every datas entry must be a (source, destination) pair")
        source_node, destination_node = entry.elts
        if not isinstance(destination_node, ast.Constant) or not isinstance(destination_node.value, str):
            raise ValueError("Every datas destination must be a literal path")
        entries.append((_path_literals(source_node, assignments), destination_node.value.replace("\\", "/")))
    return entries


def validate_spec_allowlist(spec_path: Path) -> tuple[bool, str]:
    """Ensure every packaged data tree is explicitly on the safe allowlist."""
    try:
        entries = read_spec_datas(spec_path)
    except (OSError, SyntaxError, ValueError) as exc:
        return False, f"Cannot validate {spec_path.name}: {exc}"

    actual = {destination: source_parts for source_parts, destination in entries}
    if len(entries) != len(EXPECTED_DATAS) or actual != EXPECTED_DATAS:
        return False, f"Unexpected PyInstaller datas allowlist in {spec_path.name}: {actual!r}"

    for source_parts, destination in entries:
        forbidden = FORBIDDEN_DATA_PARTS.intersection(part.casefold() for part in source_parts)
        if forbidden:
            return False, f"Forbidden data/token path in {spec_path.name}: {sorted(forbidden)}"
        if destination.casefold() in FORBIDDEN_DATA_PARTS:
            return False, f"Forbidden PyInstaller destination in {spec_path.name}: {destination}"
    return True, "Only resources and frontend/dist are data inputs; backend modules compile without copying backend/data/."


def check_files() -> bool:
    print("=" * 60)
    print("File Check")
    print("=" * 60)
    required_files = [
        ("main.py", "Main entry point"),
        ("bridge.py", "Bridge module"),
        ("logger_setup.py", "Logging module"),
        ("build_exe.spec", "Standard PyInstaller spec"),
        ("build_exe_clean.spec", "Safe PyInstaller spec"),
        ("backend/__init__.py", "Backend package init"),
        ("backend/core/task_manager.py", "Task manager"),
        ("backend/core/course_group_manager.py", "Course group manager"),
        ("backend/core/settings_manager.py", "Settings manager"),
        ("backend/utils/color_manager.py", "Color manager"),
        ("resources/icon.png", "Application icon"),
        ("frontend/package.json", "Frontend package manifest"),
        ("frontend/package-lock.json", "Locked frontend dependencies"),
        ("frontend/dist/index.html", "Built frontend entry point"),
    ]
    all_ok = True
    for relative_path, description in required_files:
        exists = (PROJECT_ROOT / relative_path).is_file()
        status = "[OK]" if exists else "[FAIL]"
        print(f"{status} {description}: {relative_path}")
        all_ok &= exists
    if not (PROJECT_ROOT / "frontend/dist/index.html").is_file():
        print("  [!] Run `npm ci` and `npm run build` from the frontend directory.")
    return all_ok


def check_code() -> bool:
    """Check a few packaging-critical runtime/source expectations."""
    print("\n" + "=" * 60)
    print("Code Check")
    print("=" * 60)
    main_content = (PROJECT_ROOT / "main.py").read_text(encoding="utf-8")
    bridge_content = (PROJECT_ROOT / "bridge.py").read_text(encoding="utf-8")
    checks = [
        ("perform_initialization called", "self.bridge.perform_initialization()" in main_content),
        ("settingsUpdated signal emitted", "self.settingsUpdated.emit" in bridge_content),
        ("task_manager null check", "if not self.task_manager:" in bridge_content),
        ("color_manager null check", "if self.color_manager" in bridge_content or "self.color_manager and" in bridge_content),
        ("backend package init exists", (PROJECT_ROOT / "backend/__init__.py").is_file()),
    ]
    all_ok = True
    for description, passed in checks:
        print(f"{'[OK]' if passed else '[FAIL]'} {description}")
        all_ok &= passed
    return all_ok


def check_spec() -> bool:
    print("\n" + "=" * 60)
    print("Spec Allowlist Check")
    print("=" * 60)
    all_ok = True
    for filename in ("build_exe.spec", "build_exe_clean.spec"):
        passed, message = validate_spec_allowlist(PROJECT_ROOT / filename)
        print(f"{'[OK]' if passed else '[FAIL]'} {filename}: {message}")
        all_ok &= passed
    return all_ok


def main() -> int:
    print("\n" + "=" * 60)
    print("  Pre-Package Check")
    print("=" * 60 + "\n")
    file_ok = check_files()
    code_ok = check_code()
    spec_ok = check_spec()
    if file_ok and code_ok and spec_ok:
        print("\n[OK] All pre-package checks passed.")
        return 0
    print("\n[FAIL] Pre-package checks failed; packaging must not continue.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
