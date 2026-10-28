"""What the chat needs from a language model: some text back for a fixed instruction and a question."""

import json
from typing import Protocol


class ModelUnavailable(Exception):
    """The model did not give a usable answer: it timed out, errored, or sent back something unreadable."""


class ModelClient(Protocol):
    def complete(self, system: str, user: str) -> str:
        """The model's text, or raises ModelUnavailable."""
        ...


def read_json_object(text: str) -> dict:
    """The JSON object in what a model said, or raises ModelUnavailable.

    Small models often wrap the object in a code fence or a sentence, so the text from the first "{" to
    the last "}" is read. Reading is lenient and what is read is not: callers still check every field.
    """
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        raise ModelUnavailable("the model did not answer with a JSON object")
    try:
        proposal = json.loads(text[start : end + 1])
    except ValueError as error:
        raise ModelUnavailable("the model did not answer in JSON") from error
    if not isinstance(proposal, dict):
        raise ModelUnavailable("the model did not answer with a JSON object")
    return proposal
