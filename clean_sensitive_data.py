#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Retired data-cleanup entry point. It never edits project or package files."""

from __future__ import annotations


def main() -> int:
    print("Spark Schedule data cleanup is disabled for safety.")
    print("Packaging now excludes data, backups, and token files via PyInstaller allowlists.")
    print("This utility will not clean the working tree or any staging directory.")
    try:
        response = input("Acknowledge and exit without changes? (yes/no): ").strip().lower()
    except EOFError:
        response = ""

    if response != "yes":
        print("Cancelled. No files were changed.")
        return 1

    print("Acknowledged. No files were changed; run build_clean.bat to package safely.")
    # This retired utility intentionally performs no cleanup, even on yes.
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
