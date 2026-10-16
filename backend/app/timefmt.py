from datetime import datetime, timezone


def iso_utc(moment: datetime | None) -> str | None:
    """The one way a moment is written in API responses: ISO 8601 in UTC, to the second."""
    return None if moment is None else moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
