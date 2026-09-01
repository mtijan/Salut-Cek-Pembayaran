from __future__ import annotations

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


if __name__ == "__main__":
    unittest.main()
