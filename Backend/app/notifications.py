"""Provider-neutral outbound notification adapters with bounded delivery behavior."""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


class WebhookDeliveryError(RuntimeError):
    """Raised when a configured webhook cannot be delivered safely."""


def build_disk_alert_payload(report: dict[str, object]) -> dict[str, object]:
    """Build a minimal external payload without filesystem paths or infrastructure addresses."""
    raw_filesystems = report.get("filesystems")
    filesystems = raw_filesystems if isinstance(raw_filesystems, list) else []
    safe_items = [item for item in filesystems if isinstance(item, dict)]
    alerting = [item for item in safe_items if item.get("alert") is True]
    used_values = [
        float(item["used_percent"]) for item in safe_items if isinstance(item.get("used_percent"), int | float)
    ]
    free_values = [int(item["free_bytes"]) for item in safe_items if isinstance(item.get("free_bytes"), int)]
    thresholds = [
        float(item["threshold_percent"])
        for item in safe_items
        if isinstance(item.get("threshold_percent"), int | float)
    ]
    return {
        "event": "disk_capacity_alert",
        "service": "salut-cek-pembayaran",
        "status": "alert",
        "filesystem_count": len(safe_items),
        "alerting_filesystem_count": len(alerting),
        "max_used_percent": max(used_values, default=0.0),
        "min_free_bytes": min(free_values, default=0),
        "threshold_percent": max(thresholds, default=0.0),
    }


def _validate_webhook_url(webhook_url: str) -> None:
    parts = urlsplit(webhook_url)
    if parts.scheme != "https" or not parts.netloc or parts.fragment:
        raise ValueError("Webhook disk alert wajib memakai URL HTTPS valid tanpa fragment.")


def send_json_webhook(
    webhook_url: str,
    payload: dict[str, object],
    *,
    timeout_seconds: float = 5.0,
    max_attempts: int = 3,
    backoff_seconds: float = 0.5,
    opener: Callable[..., Any] = urlopen,
    sleeper: Callable[[float], None] = time.sleep,
) -> None:
    """POST JSON to a trusted HTTPS webhook with bounded exponential backoff."""
    _validate_webhook_url(webhook_url)
    if timeout_seconds <= 0 or max_attempts < 1 or backoff_seconds < 0:
        raise ValueError("Konfigurasi timeout, attempt, dan backoff webhook tidak valid.")

    body = json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    request = Request(
        webhook_url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "salut-disk-alert/1"},
        method="POST",
    )
    for attempt in range(max_attempts):
        try:
            with opener(request, timeout=timeout_seconds) as response:
                raw_status = getattr(response, "status", None)
                status = int(raw_status if raw_status is not None else response.getcode())
                if 200 <= status < 300:
                    return
        except (HTTPError, URLError, TimeoutError, OSError):
            pass
        if attempt + 1 < max_attempts:
            sleeper(backoff_seconds * (2**attempt))

    raise WebhookDeliveryError("Pengiriman webhook gagal setelah batas percobaan.")


def notify_disk_alert(
    report: dict[str, object],
    webhook_url: str,
    *,
    timeout_seconds: float = 5.0,
    max_attempts: int = 3,
    backoff_seconds: float = 0.5,
    opener: Callable[..., Any] = urlopen,
    sleeper: Callable[[float], None] = time.sleep,
) -> bool:
    """Send an alert only when the report is alerting and a webhook is configured."""
    if report.get("status") != "alert" or not webhook_url.strip():
        return False
    send_json_webhook(
        webhook_url.strip(),
        build_disk_alert_payload(report),
        timeout_seconds=timeout_seconds,
        max_attempts=max_attempts,
        backoff_seconds=backoff_seconds,
        opener=opener,
        sleeper=sleeper,
    )
    return True
