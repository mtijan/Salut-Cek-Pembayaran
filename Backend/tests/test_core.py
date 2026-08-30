from __future__ import annotations

import unittest
from pathlib import Path


def discover_backend_tests(loader: unittest.TestLoader) -> unittest.TestSuite:
    return loader.discover(
        start_dir=str(Path(__file__).resolve().parent),
        pattern="test_*.py",
        top_level_dir=str(Path(__file__).resolve().parents[2]),
    )


def load_tests(
    loader: unittest.TestLoader,
    standard_tests: unittest.TestSuite,
    pattern: str | None,
) -> unittest.TestSuite:
    # During normal discovery this module must remain empty to avoid duplicate
    # test IDs. A direct `python -m unittest Backend.tests.test_core` call uses
    # this compatibility hook to run the complete suite.
    if pattern is not None:
        return standard_tests
    return discover_backend_tests(loader)


if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = discover_backend_tests(loader)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
