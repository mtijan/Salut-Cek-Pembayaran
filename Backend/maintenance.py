from __future__ import annotations

import json

from Backend.app.services import cleanup_operational_data, ensure_database


def main() -> None:
    ensure_database()
    print(json.dumps(cleanup_operational_data(), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
