from __future__ import annotations

import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
VERSION_FILE = PROJECT_ROOT / "VERSION"
SEMANTIC_VERSION_PATTERN = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$")


def read_application_version(version_file: str | Path = VERSION_FILE) -> str:
    """Read and validate the repository's canonical application version."""
    path = Path(version_file)
    try:
        version = path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise RuntimeError(f"Application version file is unavailable: {path}") from exc

    if not SEMANTIC_VERSION_PATTERN.fullmatch(version):
        raise RuntimeError(f"Application version must use semantic versioning: {path}")
    return version


APP_VERSION = read_application_version()
