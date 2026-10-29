"""How far apart two spellings are, for reading a slip of the keyboard without ever guessing."""


def allowed_distance(length: int) -> int:
    """How many letters a slip may be off: one for a short word, two for a longer one."""
    return 1 if length <= 7 else 2


def edit_distance(a: str, b: str, limit: int) -> int | None:
    """The number of edits between `a` and `b`, or None if it is more than `limit`.

    An edit is a letter added, removed or changed, and a swap of two neighbouring letters counts as
    one ("tengha" and "tenhga" are one edit from "tengah"), because that is the commonest slip.
    """
    if abs(len(a) - len(b)) > limit:
        return None
    previous2: list[int] | None = None
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current = [i] + [0] * len(b)
        for j, char_b in enumerate(b, start=1):
            cost = 0 if char_a == char_b else 1
            current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            if previous2 is not None and i > 1 and j > 1 and char_a == b[j - 2] and a[i - 2] == char_b:
                current[j] = min(current[j], previous2[j - 2] + 1)
        if min(current) > limit:
            return None
        previous2, previous = previous, current
    distance = previous[len(b)]
    return distance if distance <= limit else None
