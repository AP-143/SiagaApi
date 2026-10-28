"""A stand-in for the language model: it says what the test told it to say and records what it was asked."""


class FakeModel:
    def __init__(self):
        self._replies: list = []
        self.calls: list[tuple[str, str]] = []

    def will_say(self, *replies):
        """Queue replies; an Exception in the queue is raised instead of returned."""
        self._replies.extend(replies)

    def complete(self, system: str, user: str) -> str:
        self.calls.append((system, user))
        reply = self._replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply
