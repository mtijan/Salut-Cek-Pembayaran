"""Bounded in-memory sliding-window rate limiter for single-worker deployments."""

from __future__ import annotations

import hashlib
import heapq
import threading
import time
from collections import deque
from collections.abc import Callable

from Backend.app import config


class RateLimiter:
    """Thread-safe limiter with hashed keys, bounded buckets, and expiry-heap cleanup."""

    def __init__(self, max_buckets: int = 10_000, clock: Callable[[], float] | None = None) -> None:
        if max_buckets < 1:
            raise ValueError("Batas bucket rate limiter wajib lebih besar dari nol.")
        self._max_buckets = max_buckets
        self._clock = clock or time.monotonic
        self._entries: dict[str, deque[float]] = {}
        self._windows: dict[str, int] = {}
        self._scheduled: dict[str, tuple[float, int]] = {}
        self._expirations: list[tuple[float, int, str]] = []
        self._sequence = 0
        self._lock = threading.Lock()

    @staticmethod
    def _entry_key(scope: str, key: str) -> str:
        """Hash identifiers so raw IP addresses or emails are not retained as bucket keys."""
        return hashlib.sha256(f"{scope}\0{key}".encode()).hexdigest()

    def _schedule_expiry(self, entry_key: str) -> None:
        entries = self._entries.get(entry_key)
        window_seconds = self._windows.get(entry_key)
        if not entries or window_seconds is None:
            self._scheduled.pop(entry_key, None)
            return
        expiry = entries[0] + window_seconds
        scheduled = self._scheduled.get(entry_key)
        if scheduled is not None and scheduled[0] == expiry:
            return
        self._sequence += 1
        record = (expiry, self._sequence)
        self._scheduled[entry_key] = record
        heapq.heappush(self._expirations, (expiry, self._sequence, entry_key))
        self._compact_expirations()

    def _compact_expirations(self) -> None:
        """Bound stale heap records created by an unexpected window change for the same key."""
        compact_threshold = max(64, self._max_buckets * 2)
        if len(self._expirations) <= compact_threshold:
            return
        self._expirations = [(expiry, sequence, entry_key) for entry_key, (expiry, sequence) in self._scheduled.items()]
        heapq.heapify(self._expirations)

    def _remove_bucket(self, entry_key: str) -> None:
        self._entries.pop(entry_key, None)
        self._windows.pop(entry_key, None)
        self._scheduled.pop(entry_key, None)

    def _prune_bucket(self, entry_key: str, now: float, window_seconds: int) -> deque[float] | None:
        entries = self._entries.get(entry_key)
        if entries is None:
            return None
        while entries and entries[0] <= now - window_seconds:
            entries.popleft()
        if not entries:
            self._remove_bucket(entry_key)
            return None
        self._windows[entry_key] = window_seconds
        self._schedule_expiry(entry_key)
        return entries

    def _evict_expired(self, now: float) -> None:
        """Evict only buckets whose next timestamp has expired; never scan all active keys."""
        while self._expirations and self._expirations[0][0] <= now:
            expiry, sequence, entry_key = heapq.heappop(self._expirations)
            if self._scheduled.get(entry_key) != (expiry, sequence):
                continue
            self._scheduled.pop(entry_key, None)
            window_seconds = self._windows.get(entry_key)
            if window_seconds is not None:
                self._prune_bucket(entry_key, now, window_seconds)

    def reset(self) -> None:
        """Clear all limiter state; intended for deterministic test isolation."""
        with self._lock:
            self._entries.clear()
            self._windows.clear()
            self._scheduled.clear()
            self._expirations.clear()
            self._sequence = 0

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
        if not scope or not key:
            raise ValueError("Scope dan key rate limiter wajib diisi.")
        if limit < 1 or window_seconds < 1:
            raise ValueError("Limit dan window rate limiter wajib lebih besar dari nol.")

        now = self._clock()
        entry_key = self._entry_key(scope, key)
        with self._lock:
            self._evict_expired(now)
            entries = self._prune_bucket(entry_key, now, window_seconds)
            if entries is None:
                if len(self._entries) >= self._max_buckets:
                    # Fail closed for previously unseen keys instead of allowing unbounded memory growth.
                    return window_seconds
                entries = deque()
                self._entries[entry_key] = entries
                self._windows[entry_key] = window_seconds
            if len(entries) >= limit:
                return max(1, int(entries[0] + window_seconds - now) + 1)
            entries.append(now)
            self._schedule_expiry(entry_key)
        return None


# Global singleton for the accepted single-worker deployment topology.
RATE_LIMITER = RateLimiter(max_buckets=config.RATE_LIMIT_MAX_BUCKETS)
