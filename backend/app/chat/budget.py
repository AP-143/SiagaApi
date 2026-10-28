"""A budget for model calls, so a free quota is not used up by a few visitors.

The limits apply to the whole application, not to one client, because that is how free tiers count
(the per-client chat limit is a separate thing in `ratelimit.py`). The windows are rolling: a call
counts for the next minute, or the next 24 hours. State lives in this process.
"""

import logging
import threading
from collections import deque
from collections.abc import Callable
from datetime import datetime, timedelta

from app.chat.model import ModelClient, ModelUnavailable

logger = logging.getLogger(__name__)

MINUTE = timedelta(minutes=1)
DAY = timedelta(days=1)


class BudgetedModel:
    """A model client that refuses to call the real one once a limit is spent."""

    def __init__(
        self,
        model: ModelClient,
        per_minute: int,
        per_day: int,
        clock: Callable[[], datetime],
    ):
        self._model = model
        self._per_minute = per_minute
        self._per_day = per_day
        self._clock = clock
        self._calls: deque[datetime] = deque()
        self._lock = threading.Lock()

    def complete(self, system: str, user: str) -> str:
        with self._lock:
            now = self._clock()
            while self._calls and now - self._calls[0] >= DAY:
                self._calls.popleft()
            in_the_last_minute = sum(1 for call in self._calls if now - call < MINUTE)
            # Nothing about the question is logged: only that a call did not happen, and why.
            if in_the_last_minute >= self._per_minute:
                logger.info("model call skipped: the per-minute limit is spent")
                raise ModelUnavailable("the per-minute limit of model calls is spent")
            if len(self._calls) >= self._per_day:
                logger.info("model call skipped: the per-day limit is spent")
                raise ModelUnavailable("the per-day limit of model calls is spent")
            self._calls.append(now)
        return self._model.complete(system, user)
