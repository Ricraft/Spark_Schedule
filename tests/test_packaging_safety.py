"""Static and temporary-fixture tests for safe packaging behavior."""
from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pre_package_check import read_spec_datas, validate_spec_allowlist  # noqa: E402


class PackagingSafetyTests(unittest.TestCase):
    def test_both_specs_have_only_the_allowlisted_payload(self) -> None:
        for name in ("build_exe.spec", "build_exe_clean.spec"):
            with self.subTest(spec=name):
                passed, reason = validate_spec_allowlist(ROOT / name)
                self.assertTrue(passed, reason)
                self.assertEqual(
                    {destination for _source, destination in read_spec_datas(ROOT / name)},
                    {"resources", "frontend/dist"},
                    "Never copy backend/ as data: it contains backend/data/schedule_data.json",
                )

    def test_official_build_routes_use_safe_shared_spec(self) -> None:
        clean = (ROOT / "build_clean.bat").read_text(encoding="utf-8").casefold()
        standard = (ROOT / "build.bat").read_text(encoding="utf-8").casefold()
        rebuild = (ROOT / "rebuild_clean.bat").read_text(encoding="utf-8").casefold()
        simple = (ROOT / "build_simple.py").read_text(encoding="utf-8").casefold()

        self.assertIn("build_exe_clean.spec", clean)
        self.assertIn("--clean --noconfirm", clean)
        self.assertIn("npm ci", clean)
        self.assertIn("npm run build", clean)
        self.assertIn("frontend\\dist\\index.html", clean)
        self.assertIn("build_clean.bat", standard)
        self.assertIn("build_clean.bat", rebuild)
        self.assertNotIn("taskkill", rebuild)
        self.assertNotIn("clean_sensitive_data.py", clean)

        for source in (clean, standard, rebuild, simple):
            self.assertNotIn("d:\\python\\python.exe", source)
            self.assertNotIn("react (3)", source)
            self.assertNotIn("--add-data=data", source)
        self.assertIn('"npm", "ci"', simple)
        self.assertIn('"npm", "run", "build"', simple)
        self.assertIn("--clean", simple)
        self.assertIn("--noconfirm", simple)

    def test_cleanup_no_and_yes_branches_never_change_fixture_data(self) -> None:
        cleanup_script = ROOT / "clean_sensitive_data.py"
        with tempfile.TemporaryDirectory(prefix="packaging-safety-") as temp_dir:
            fixture = Path(temp_dir)
            files = {
                Path("data/settings.json"): b'{"api_key":"fixture-secret"}\n',
                Path("data/backups/backup.json"): b'{"backup":true}\n',
                Path("data/jinrishici_token.txt"): b"fixture-token\n",
            }
            for relative_path, content in files.items():
                path = fixture / relative_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)

            for response in ("no\n", "yes\n"):
                with self.subTest(response=response.strip()):
                    result = subprocess.run(
                        [sys.executable, str(cleanup_script)],
                        cwd=fixture,
                        input=response,
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    for relative_path, original_content in files.items():
                        self.assertEqual((fixture / relative_path).read_bytes(), original_content)

    def test_cleanup_implementation_contains_no_mutation_primitives(self) -> None:
        source = (ROOT / "clean_sensitive_data.py").read_text(encoding="utf-8")
        for destructive_marker in ("shutil.rmtree", "os.remove", "os.unlink", "open("):
            with self.subTest(marker=destructive_marker):
                self.assertNotIn(destructive_marker, source)


if __name__ == "__main__":
    unittest.main()
