"""Fail when public-repository candidates contain private or sensitive data.

Content findings report only path, line number, and category. Matched values are
never copied to CI output. The candidate set includes both tracked files and
untracked, non-ignored working-tree files so local pre-commit checks cannot miss
new files.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path, PurePosixPath


PRIVATE_ROOTS = {
    "deploy",
    "docs",
}
PRIVATE_DIRECTORY_NAMES = {
    "backups",
    "encrypted_backups",
    "exports",
    "imports",
    "logs",
    "sessions",
    "uploads",
}
SENSITIVE_SUFFIXES = {
    ".backup",
    ".bak",
    ".csv",
    ".db",
    ".dump",
    ".key",
    ".log",
    ".p12",
    ".pem",
    ".pfx",
    ".sqlite",
    ".sqlite3",
    ".sql",
    ".xls",
    ".xlsb",
    ".xlsm",
    ".xlsx",
}
SENSITIVE_BASENAMES = {".codex-gitconfig", "vps.txt"}
ALLOWED_SENSITIVE_PATHS = {"backend/schema.sql"}
SENSITIVE_ARCHIVE_TOKENS = {"backup", "dump", "export", "private", "secret"}

SCANNED_SOURCE_SUFFIXES = {
    ".conf",
    ".env",
    ".example",
    ".html",
    ".js",
    ".jsx",
    ".json",
    ".mjs",
    ".ps1",
    ".py",
    ".service",
    ".sh",
    ".timer",
    ".toml",
    ".yaml",
    ".yml",
}
CONTENT_SCAN_EXCLUDED_PARTS = {"admin-dist", "node_modules", "tests"}
CONTENT_SCAN_EXCLUDED_BASENAMES = {"package-lock.json"}
MAX_SCANNED_SOURCE_BYTES = 1_000_000

EMAIL_LITERAL_RE = re.compile(r"[A-Za-z0-9._%+-]+@(?P<domain>[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
CREDENTIAL_LITERAL_RE = re.compile(
    r"""(?ix)(?:^|[,{]\s*)["']?[a-z0-9_]*(?:password|secret|api[_-]?key|access[_-]?token|credential)"""
    r"""[a-z0-9_]*["']?\s*[:=]\s*["'][^"'\r\n]{4,}["']"""
)
IDENTITY_LITERAL_RE = re.compile(
    r"""(?ix)["']?(?:nim|nik|no[_-]?ktp|phone(?:_number)?|briva|account(?:_number)?)["']?"""
    r"""\s*:\s*["'](?P<value>\d{7,19})["']"""
)
LONG_DIGIT_RE = re.compile(r"(?<!\d)(?P<value>\d{12,19})(?!\d)")


def normalize_repo_path(value: str) -> PurePosixPath:
    normalized = value.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    return PurePosixPath(normalized)


def forbidden_reason(value: str) -> str | None:
    path = normalize_repo_path(value)
    if not path.parts:
        return None

    root = path.parts[0].lower()
    basename = path.name.lower()
    suffix = path.suffix.lower()
    if path.as_posix().lower() in ALLOWED_SENSITIVE_PATHS:
        return None

    if root in PRIVATE_ROOTS:
        return f"private root '{root}/'"
    lowered_parts = tuple(part.lower() for part in path.parts)
    runtime_directory = next((part for part in lowered_parts[:-1] if part in PRIVATE_DIRECTORY_NAMES), None)
    if runtime_directory:
        return f"private runtime directory '{runtime_directory}/'"
    if lowered_parts[:3] == ("backend", "data", "imports"):
        return "private import directory 'Backend/data/imports/'"
    if lowered_parts[:2] == ("backend", "data") and suffix == ".txt":
        return "private Backend/data text file"
    if basename in SENSITIVE_BASENAMES:
        return f"sensitive filename '{basename}'"
    if basename.startswith(".env") and not basename.endswith(".example"):
        return "environment file"
    if suffix in SENSITIVE_SUFFIXES:
        return f"sensitive file type '{suffix}'"
    if suffix in {".gz", ".tar", ".zip"} and any(token in basename for token in SENSITIVE_ARCHIVE_TOKENS):
        return "sensitive archive filename"
    return None


def _git_ls_files(repo_root: Path, *, explicit_repository: bool) -> subprocess.CompletedProcess[bytes]:
    command = ["git"]
    if explicit_repository:
        command.extend([f"--git-dir={repo_root / '.git'}", f"--work-tree={repo_root}"])
    command.extend(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    return subprocess.run(command, cwd=repo_root, check=True, capture_output=True)


def tracked_paths(repo_root: Path) -> list[str]:
    try:
        result = _git_ls_files(repo_root, explicit_repository=False)
    except subprocess.CalledProcessError:
        # Explicit repository paths avoid Git's ownership discovery check while
        # remaining read-only and scoped to this working tree.
        result = _git_ls_files(repo_root, explicit_repository=True)
    return [item.decode("utf-8") for item in result.stdout.split(b"\0") if item]


def find_violations(paths: list[str]) -> list[tuple[str, str]]:
    violations = []
    for value in paths:
        reason = forbidden_reason(value)
        if reason:
            violations.append((value, reason))
    return violations


def should_scan_content(value: str) -> bool:
    path = normalize_repo_path(value)
    lowered_parts = tuple(part.lower() for part in path.parts)
    if any(part in CONTENT_SCAN_EXCLUDED_PARTS for part in lowered_parts):
        return False
    if path.name.lower().startswith("test_") or path.name.lower() in CONTENT_SCAN_EXCLUDED_BASENAMES:
        return False
    if path.name.lower().startswith(".env") and path.name.lower().endswith(".example"):
        return False
    return path.suffix.lower() in SCANNED_SOURCE_SUFFIXES


def _is_reserved_email_domain(domain: str) -> bool:
    lowered = domain.lower()
    reserved_domains = {"example.com", "example.net", "example.org"}
    return (
        lowered in reserved_domains
        or any(lowered.endswith(f".{reserved}") for reserved in reserved_domains)
        or lowered.endswith((".example", ".invalid", ".local", ".localhost", ".test"))
    )


def _is_obviously_synthetic_number(value: str) -> bool:
    return len(set(value)) <= 2


def content_violations(value: str, content: str) -> list[tuple[str, int, str]]:
    if not should_scan_content(value):
        return []

    violations: list[tuple[str, int, str]] = []
    for line_number, line in enumerate(content.splitlines(), start=1):
        categories: set[str] = set()
        presentation_placeholder = "placeholder=" in line.lower()

        if not presentation_placeholder:
            for match in EMAIL_LITERAL_RE.finditer(line):
                if not _is_reserved_email_domain(match.group("domain")):
                    categories.add("non-reserved email literal")
            for match in LONG_DIGIT_RE.finditer(line):
                if not _is_obviously_synthetic_number(match.group("value")):
                    categories.add("PII-like long numeric literal")

        if CREDENTIAL_LITERAL_RE.search(line):
            categories.add("hardcoded credential literal")
        for match in IDENTITY_LITERAL_RE.finditer(line):
            if not _is_obviously_synthetic_number(match.group("value")):
                categories.add("hardcoded identity literal")

        violations.extend((value, line_number, category) for category in sorted(categories))
    return violations


def find_content_violations(repo_root: Path, paths: list[str]) -> list[tuple[str, int, str]]:
    violations: list[tuple[str, int, str]] = []
    resolved_root = repo_root.resolve()
    for value in paths:
        if not should_scan_content(value):
            continue
        relative_path = normalize_repo_path(value)
        source_path = (resolved_root / Path(*relative_path.parts)).resolve()
        try:
            source_path.relative_to(resolved_root)
        except ValueError:
            violations.append((value, 0, "tracked path escapes repository root"))
            continue
        try:
            if source_path.stat().st_size > MAX_SCANNED_SOURCE_BYTES:
                continue
            raw_content = source_path.read_bytes()
            if b"\0" in raw_content:
                continue
            content = raw_content.decode("utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        violations.extend(content_violations(value, content))
    return violations


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    try:
        paths = tracked_paths(repo_root)
        violations = find_violations(paths)
        sensitive_content = find_content_violations(repo_root, paths)
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: unable to inspect public-repository candidates: {exc}", file=sys.stderr)
        return 2

    if violations or sensitive_content:
        print("ERROR: public repository boundary violations detected:", file=sys.stderr)
        for path, reason in violations:
            print(f"- {path}: {reason}", file=sys.stderr)
        for path, line_number, category in sensitive_content:
            print(f"- {path}:{line_number}: {category}", file=sys.stderr)
        return 1

    print("OK: no private paths or high-signal sensitive literals in public-repository candidates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
