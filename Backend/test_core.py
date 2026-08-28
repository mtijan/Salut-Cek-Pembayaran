from __future__ import annotations

import unittest
from pathlib import Path

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.discover(
        start_dir=str(Path(__file__).resolve().parent),
        pattern="test_*.py",
        top_level_dir=str(Path(__file__).resolve().parent.parent),
    )
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
