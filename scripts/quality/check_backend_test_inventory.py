from __future__ import annotations

import unittest
from collections import Counter


EXPECTED_TEST_COUNTS = {
    "Backend.tests.test_admin_cli": 5,
    "Backend.tests.test_admin_users": 9,
    "Backend.tests.test_audit_logs": 3,
    "Backend.tests.test_auth_rbac": 13,
    "Backend.tests.test_bill_activation": 9,
    "Backend.tests.test_billing": 10,
    "Backend.tests.test_billing_payments": 5,
    "Backend.tests.test_contract_openapi": 10,
    "Backend.tests.test_database_lifecycle": 23,
    "Backend.tests.test_domain": 3,
    "Backend.tests.test_due_date_backfill": 4,
    "Backend.tests.test_frontend_serving": 1,
    "Backend.tests.test_import_admin_safety": 12,
    "Backend.tests.test_imports": 10,
    "Backend.tests.test_lookup": 3,
    "Backend.tests.test_master_data": 6,
    "Backend.tests.test_operations": 9,
    "Backend.tests.test_reporting": 3,
    "Backend.tests.test_security_ops": 14,
    "Backend.tests.test_service_boundaries": 1,
    "Backend.tests.test_students": 9,
    "Backend.tests.test_version": 2,
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
