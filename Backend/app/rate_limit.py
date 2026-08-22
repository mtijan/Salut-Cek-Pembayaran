from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self) -> None:
        self._entries: dict[str, deque[float]] = defaultdict(deque)
        self._windows: dict[str, int] = {}
        self._lock = threading.Lock()

    def check(self, scope: str, key: str, limit: int, window_seconds: int) -> int | None:
        now = time.monotonic()
        entry_key = f"{scope}:{key}"
        with self._lock:
            # A process-local limiter is still bounded: stale buckets from
            # clients that never return must not accumulate forever.
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


RATE_LIMITER = RateLimiter()
