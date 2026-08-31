"""ASGI application runner and local development server entry point.

This script launches the Uvicorn ASGI server hosting the FastAPI application
with configured network host and port settings.
"""

from __future__ import annotations

import sys
from pathlib import Path

import uvicorn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from Backend.app.config import DB_PATH, PORT  # noqa: E402 - script mode adjusts sys.path first
from Backend.app.main import app as app  # noqa: E402 - compatibility export for ASGI/tests


def main() -> None:
    """Run local development ASGI server via Uvicorn."""
    print(f"Salut Cek Pembayaran running at http://127.0.0.1:{PORT}")
    print(f"SQLite database: {DB_PATH.resolve()}")
    uvicorn.run("Backend.app.main:app", host="127.0.0.1", port=PORT)


if __name__ == "__main__":
    main()
