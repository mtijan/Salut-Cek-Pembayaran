from __future__ import annotations

import unittest
from collections import Counter


EXPECTED_TEST_COUNTS = {
    "Backend.test_auth_rbac": 7,
    "Backend.test_billing": 15,
    "Backend.test_database_lifecycle": 17,
    "Backend.test_domain": 3,
    "Backend.test_imports": 18,
    "Backend.test_lookup": 3,
    "Backend.test_master_data": 6,
    "Backend.test_operations": 4,
    "Backend.test_reporting": 3,
    "Backend.test_security_ops": 9,
    "Backend.test_students": 9,
    "Backend.test_version": 2,
}


def iter_tests(suite: unittest.TestSuite) -> list[unittest.TestCase]:
    tests: list[unittest.TestCase] = []
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            tests.extend(iter_tests(item))
        else:
            tests.append(item)
    return tests


def main() -> int:
    suite = unittest.defaultTestLoader.discover("Backend", pattern="test_*.py", top_level_dir=".")
    tests = iter_tests(suite)
    test_ids = [test.id() for test in tests]
    counts = Counter(test_id.rsplit(".", 2)[0] for test_id in test_ids)

    errors: list[str] = []
    if len(test_ids) != len(set(test_ids)):
        duplicates = sorted(test_id for test_id, count in Counter(test_ids).items() if count > 1)
        errors.append(f"duplicate test IDs: {', '.join(duplicates)}")
    if dict(sorted(counts.items())) != EXPECTED_TEST_COUNTS:
        errors.append(f"test inventory changed: expected {EXPECTED_TEST_COUNTS}, found {dict(sorted(counts.items()))}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        print("Update EXPECTED_TEST_COUNTS only after reviewing intentional test additions/removals.")
        return 1

    print(f"OK: backend test inventory contains {len(test_ids)} unique tests across {len(counts)} modules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
