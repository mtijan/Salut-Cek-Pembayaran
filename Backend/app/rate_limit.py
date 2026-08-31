"""In-memory sliding window rate limiter.

This module provides thread-safe sliding window rate limiting for public and administrative
endpoints. It automatically evicts expired timestamps and cleans up stale key buckets
to prevent memory exhaustion.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    """Thread-safe sliding window rate limiter with periodic stale entry eviction."""

    def __init__(self) -> None:
        self._entries: dict[str, deque[float]] = defaultdict(deque)
        self._windows: dict[str, int] = {}
        self._lock = threading.Lock()

    def check(self, scope: str, key: str, limit: int, window_seconds: int) -> int | None:
        """Check if a request is allowed within the rate limit window.

        Args:
            scope: Rate limit bucket namespace (e.g., 'lookup', 'login', 'import').
            key: Unique identifier for the client (e.g., IP address, user email).
            limit: Maximum allowed requests within the time window.
            window_seconds: Duration of the sliding window in seconds.

        Returns:
            int | None: Number of seconds to wait if rate-limited; None if allowed.
        """
        now = time.monotonic()
        entry_key = f"{scope}:{key}"
        with self._lock:
            # Process-local limiter cleanup: evict stale buckets from inactive clients
            for stale_key, stale_entries in list(self._entries.items()):
                stale_window = self._windows.get(stale_key, window_seconds)
                while stale_entries and stale_entries[0] <= now - stale_window:
                    stale_entries.popleft()
                if not stale_entries:
                    del self._entries[stale_key]
                    self._windows.pop(stale_key, None)

            entries = self._entries[entry_key]
            self._windows[entry_key] = window_seconds
            while entries and entries[0] <= now - window_seconds:
                entries.popleft()
            if len(entries) >= limit:
                return max(1, int(entries[0] + window_seconds - now) + 1)
            entries.append(now)
        return None


# Global singleton instance for process-level rate limiting
RATE_LIMITER = RateLimiter()
