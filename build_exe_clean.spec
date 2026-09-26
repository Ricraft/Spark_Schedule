# -*- mode: python ; coding: utf-8 -*-
"""Safe allowlist spec shared by all supported packaging entry points."""
import os

block_cipher = None
project_root = os.path.abspath(SPECPATH)
frontend_dist = os.path.join(project_root, "frontend", "dist")
frontend_index = os.path.join(frontend_dist, "index.html")
if not os.path.isfile(frontend_index):
    raise FileNotFoundError(
        "Frontend build is missing: frontend/dist/index.html. "
        "Run npm ci and npm run build in frontend/ before packaging."
    )

# Only static resources. Imported backend Python modules are collected by Analysis;
# never copy the backend source tree, which can contain backend/data user files.
a = Analysis(
    [os.path.join(project_root, "main.py")],
    pathex=[project_root],
    binaries=[],
    datas=[
        (os.path.join(project_root, "resources"), "resources"),
        (frontend_dist, "frontend/dist"),
    ],
    hiddenimports=[
        "PyQt6.QtCore",
        "PyQt6.QtGui",
        "PyQt6.QtWidgets",
        "PyQt6.QtWebEngineWidgets",
        "PyQt6.QtWebEngineCore",
        "PyQt6.QtWebChannel",
        "psutil",
        "requests",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

icon_path = os.path.join(project_root, "resources", "icon.ico")
if not os.path.exists(icon_path):
    icon_path = os.path.join(project_root, "resources", "icon.png")
if not os.path.exists(icon_path):
    icon_path = None

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="SparkSchedule",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_path,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="SparkSchedule",
)
