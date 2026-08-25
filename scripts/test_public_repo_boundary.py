import unittest

from scripts.check_public_repo_boundary import find_violations, forbidden_reason


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


if __name__ == "__main__":
    unittest.main()
