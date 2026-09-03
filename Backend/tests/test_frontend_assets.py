from __future__ import annotations

import re
import unittest
from fastapi.testclient import TestClient

from Backend.server import app


class FrontendAssetServingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()

    def test_portal_index_serves_html_with_modular_assets(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response.headers.get("content-type", ""))
        self.assertIn("./css/main.css", response.text)
        self.assertIn("./assets/images/logo-salut.jpeg", response.text)
        self.assertIn("./js/app.js", response.text)

    def test_css_modular_assets_served_successfully(self) -> None:
        css_paths = [
            "/css/main.css",
            "/css/variables.css",
            "/css/base.css",
            "/css/layout.css",
            "/css/components.css",
            "/css/modules/student-card.css",
            "/css/modules/financial.css",
            "/css/modules/briva.css",
            "/css/modules/history.css",
            "/css/modules/instructions.css",
            "/css/responsive.css",
            "/css/print.css",
        ]
        for path in css_paths:
            with self.subTest(css_path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn("text/css", response.headers.get("content-type", ""))

    def test_js_modular_assets_served_successfully(self) -> None:
        js_paths = [
            "/js/app.js",
            "/js/config.js",
            "/js/services/api.js",
            "/js/utils/formatters.js",
            "/js/utils/clipboard.js",
            "/js/utils/toast.js",
            "/js/utils/dom.js",
            "/js/components/studentCard.js",
            "/js/components/financialGrid.js",
            "/js/components/brivaList.js",
            "/js/components/historyList.js",
            "/js/components/shareSummary.js",
        ]
        for path in js_paths:
            with self.subTest(js_path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                content_type = response.headers.get("content-type", "")
                self.assertTrue(
                    "javascript" in content_type or "text/plain" in content_type,
                    f"Unexpected content-type {content_type} for {path}",
                )

    def test_image_assets_served_successfully(self) -> None:
        response = self.client.get("/assets/images/logo-salut.jpeg")
        self.assertEqual(response.status_code, 200)
        self.assertIn("image/jpeg", response.headers.get("content-type", ""))

    def test_admin_index_revalidates_and_hashed_logo_is_immutable(self) -> None:
        index_response = self.client.get("/admin")
        self.assertEqual(index_response.status_code, 200)
        self.assertEqual(
            index_response.headers.get("cache-control"),
            "no-cache, no-store, must-revalidate",
        )

        script_match = re.search(r'<script[^>]+src="([^"]+\.js)"', index_response.text)
        self.assertIsNotNone(script_match)
        script_response = self.client.get(script_match.group(1))
        self.assertEqual(script_response.status_code, 200)
        self.assertEqual(
            script_response.headers.get("cache-control"),
            "public, max-age=31536000, immutable",
        )

        logo_match = re.search(r'(/admin/assets/logo-salut-[^"\']+\.jpeg)', script_response.text)
        self.assertIsNotNone(logo_match)
        logo_response = self.client.get(logo_match.group(1))
        self.assertEqual(logo_response.status_code, 200)
        self.assertIn("image/jpeg", logo_response.headers.get("content-type", ""))
        self.assertGreater(len(logo_response.content), 1_000)
        self.assertEqual(
            logo_response.headers.get("cache-control"),
            "public, max-age=31536000, immutable",
        )


if __name__ == "__main__":
    unittest.main()
