import math
from collections.abc import Callable
from datetime import datetime, timedelta

WINDOW = timedelta(minutes=1)

# Entries are dropped once the table grows past this, so a flood of distinct clients cannot
# exhaust memory.
MAX_TRACKED_CLIENTS = 10_000


class RateLimiter:
    """At most `limit` requests per client per minute (a fixed window).

    State lives in this process, which is enough for a single API instance. Running several API
    processes would need a shared store (for example Redis) to enforce one limit across them.
    """

    def __init__(self, limit: int, clock: Callable[[], datetime]):
        self.limit = limit
        self.clock = clock
        self._windows: dict[str, tuple[datetime, int]] = {}

    def check(self, client: str) -> int | None:
        """Count a request. Returns None if allowed, else the seconds until the next window."""
        now = self.clock()
        started, used = self._windows.get(client, (now, 0))
        if now - started >= WINDOW:
            started, used = now, 0
        if used >= self.limit:
            return max(1, math.ceil((started + WINDOW - now).total_seconds()))
        if len(self._windows) >= MAX_TRACKED_CLIENTS:
            self._forget_expired(now)
        self._windows[client] = (started, used + 1)
        return None

    def _forget_expired(self, now: datetime) -> None:
        self._windows = {
            client: (started, used)
            for client, (started, used) in self._windows.items()
            if now - started < WINDOW
        }
