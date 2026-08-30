from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from Backend.app.main import app
from Backend.app.version import APP_VERSION, VERSION_FILE, read_application_version


class ApplicationVersionTests(unittest.TestCase):
    def test_fastapi_and_repository_use_the_same_version(self) -> None:
        self.assertEqual(APP_VERSION, VERSION_FILE.read_text(encoding="utf-8").strip())
        self.assertEqual(app.version, APP_VERSION)

    def test_version_reader_rejects_invalid_or_missing_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            invalid_path = Path(temp_dir) / "VERSION"
            invalid_path.write_text("release-latest\n", encoding="utf-8")

            with self.assertRaises(RuntimeError):
                read_application_version(invalid_path)
            with self.assertRaises(RuntimeError):
                read_application_version(Path(temp_dir) / "missing")


if __name__ == "__main__":
    unittest.main()
