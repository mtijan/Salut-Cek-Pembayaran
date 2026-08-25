"""Fail when private operational or runtime files are tracked by Git.

This check is intentionally path-based. It does not read or print file contents,
so it is safe to run in CI logs for the public repository.
"""

from __future__ import annotations

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
    "logs",
    "sessions",
    "uploads",
}
SENSITIVE_SUFFIXES = {
    ".db",
    ".key",
    ".log",
    ".p12",
    ".pem",
    ".pfx",
    ".sqlite",
    ".sqlite3",
    ".xls",
    ".xlsb",
    ".xlsm",
    ".xlsx",
}
SENSITIVE_BASENAMES = {".codex-gitconfig", "vps.txt"}


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
    return None


def tracked_paths(repo_root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    )
    return [item.decode("utf-8") for item in result.stdout.split(b"\0") if item]


def find_violations(paths: list[str]) -> list[tuple[str, str]]:
    violations = []
    for value in paths:
        reason = forbidden_reason(value)
        if reason:
            violations.append((value, reason))
    return violations


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    try:
        violations = find_violations(tracked_paths(repo_root))
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: unable to inspect tracked Git paths: {exc}", file=sys.stderr)
        return 2

    if violations:
        print("ERROR: public repository boundary violations detected:", file=sys.stderr)
        for path, reason in violations:
            print(f"- {path}: {reason}", file=sys.stderr)
        return 1

    print("OK: no private operational or runtime paths are tracked by Git")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
