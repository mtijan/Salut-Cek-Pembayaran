"""Operational data maintenance and cleanup CLI.

This script runs periodic background maintenance tasks: pruning expired sessions,
deleting stale uncommitted import previews, and cleaning up old temporary files.
"""

from __future__ import annotations

import json

from Backend.app.services import cleanup_operational_data, ensure_database


def main() -> None:
    """Execute maintenance database initialization and operational data cleanup."""
    ensure_database()
    print(json.dumps(cleanup_operational_data(), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
