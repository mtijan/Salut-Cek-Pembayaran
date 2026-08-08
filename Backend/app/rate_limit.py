from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self) -> None:
        self._entries: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, scope: str, key: str, limit: int, window_seconds: int) -> int | None:
        now = time.monotonic()
        entry_key = f"{scope}:{key}"
        with self._lock:
            entries = self._entries[entry_key]
            while entries and entries[0] <= now - window_seconds:
                entries.popleft()
            if len(entries) >= limit:
                return max(1, int(entries[0] + window_seconds - now) + 1)
            entries.append(now)
        return None


RATE_LIMITER = RateLimiter()

