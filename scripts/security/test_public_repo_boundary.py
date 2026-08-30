import sys
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.security.check_public_repo_boundary import (
    content_violations,
    find_content_violations,
    find_violations,
    forbidden_reason,
    tracked_paths,
)


class PublicRepositoryBoundaryTests(unittest.TestCase):
    def test_private_operational_roots_are_forbidden(self) -> None:
        self.assertEqual(forbidden_reason("docs/RUNBOOK.md"), "private root 'docs/'")
        self.assertEqual(forbidden_reason(r"deploy\app.service"), "private root 'deploy/'")

    def test_runtime_and_secret_file_types_are_forbidden(self) -> None:
        paths = [
            ".env",
            "./.env.production",
            "Backend/data/production.sqlite",
            "Backend/data/imports/upload.bin",
            "Backend/data/import-result.txt",
            "backups/latest.zip",
            "Backend/logs/application.log",
            "keys/server.pem",
            "imports/students.xlsx",
            "exports/students.csv",
            "database/dump.sql",
            "private-backup.zip",
            ".codex-gitconfig",
            "vps.txt",
        ]
        self.assertEqual(len(find_violations(paths)), len(paths))

    def test_public_templates_and_source_files_are_allowed(self) -> None:
        paths = [
            ".env.docker.example",
            "Backend/.env.example",
            "Backend/data/.gitkeep",
            "Backend/app/main.py",
            "README.md",
        ]
        self.assertEqual(find_violations(paths), [])

    def test_sensitive_content_reports_location_and_category_without_value(self) -> None:
        credential_value = "unsafe-literal-for-regression"
        content = (
            'payload = {"password": "' + credential_value + '"}\n'
            'email = "student@private-campus.ac.id"\n'
            'record = {"nim": "123456789"}\n'
            'identity = "1234567890123456"\n'
        )
        violations = content_violations("scripts/dev/check.py", content)

        self.assertEqual(
            violations,
            [
                ("scripts/dev/check.py", 1, "hardcoded credential literal"),
                ("scripts/dev/check.py", 2, "non-reserved email literal"),
                ("scripts/dev/check.py", 3, "hardcoded identity literal"),
                ("scripts/dev/check.py", 4, "PII-like long numeric literal"),
            ],
        )
        self.assertNotIn(credential_value, repr(violations))

    def test_reserved_synthetic_content_and_test_sources_are_allowed(self) -> None:
        synthetic = 'email = "student@example.test"\nrecord = {"nim": "000000001"}\nidentity = "0000000000000001"\n'
        self.assertEqual(content_violations("Backend/app/sample.py", synthetic), [])
        self.assertEqual(
            content_violations("Backend/test_sample.py", 'email = "student@personal.example.com"'),
            [],
        )

    def test_content_scan_reads_only_tracked_scannable_sources(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "source.py"
            source.write_text('email = "student@private-campus.ac.id"\n', encoding="utf-8")
            ignored_test = root / "test_source.py"
            ignored_test.write_text('email = "student@private-campus.ac.id"\n', encoding="utf-8")

            self.assertEqual(
                find_content_violations(root, ["source.py", "test_source.py", "missing.py"]),
                [("source.py", 1, "non-reserved email literal")],
            )

    @mock.patch("scripts.security.check_public_repo_boundary.subprocess.run")
    def test_tracked_paths_falls_back_to_explicit_git_paths(self, run: mock.Mock) -> None:
        run.side_effect = [
            subprocess.CalledProcessError(128, ["git", "ls-files", "-z"]),
            subprocess.CompletedProcess([], 0, stdout=b"README.md\0", stderr=b""),
        ]

        root = Path("repository").resolve()
        self.assertEqual(tracked_paths(root), ["README.md"])
        fallback_command = run.call_args_list[1].args[0]
        self.assertIn(f"--git-dir={root / '.git'}", fallback_command)
        self.assertIn(f"--work-tree={root}", fallback_command)
        self.assertIn("--cached", fallback_command)
        self.assertIn("--others", fallback_command)
        self.assertIn("--exclude-standard", fallback_command)


if __name__ == "__main__":
    unittest.main()
