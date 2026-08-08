from __future__ import annotations

import sys
from pathlib import Path

import uvicorn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from Backend.app.config import DB_PATH, PORT
from Backend.app.main import app
from Backend.app.rate_limit import RateLimiter
from Backend.app.services import list_imported_bill_groups, update_bill_status


def main() -> None:
    print(f"Salut Cek Pembayaran running at http://127.0.0.1:{PORT}")
    print(f"SQLite database: {DB_PATH.resolve()}")
    uvicorn.run("Backend.app.main:app", host="127.0.0.1", port=PORT)


if __name__ == "__main__":
    main()
