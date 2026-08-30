from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from Backend.app import config
from Backend.db import migrate_database
from Backend.server import app


class FrontendServingTests(unittest.TestCase):
    def test_admin_routes_fail_fast_when_react_bundle_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            frontend = root / "Frontend"
            frontend.mkdir()
            (frontend / "index.html").write_text("<!doctype html><title>Portal</title>", encoding="utf-8")
            database = root / "salut.sqlite"
            migrate_database(database)

            previous_frontend = config.FRONTEND_DIR
            previous_database = config.DB_PATH
            config.FRONTEND_DIR = frontend
            config.DB_PATH = database
            try:
                client = TestClient(app)
                admin = client.get("/admin")
                asset = client.get("/admin/assets/missing.js")
                client.close()
            finally:
                config.FRONTEND_DIR = previous_frontend
                config.DB_PATH = previous_database

            self.assertEqual(admin.status_code, 503)
            self.assertEqual(asset.status_code, 503)
            self.assertEqual(admin.json()["error"]["code"], "ADMIN_BUNDLE_UNAVAILABLE")
            self.assertEqual(asset.json()["error"]["code"], "ADMIN_BUNDLE_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
