"""A model client for any server that speaks the OpenAI chat format: Ollama, llama.cpp, Groq, OpenRouter...

Which one is used is a matter of configuration, not code (ADR 0003).
"""

import httpx

from app.chat.model import ModelUnavailable


class OpenAICompatibleClient:
    def __init__(self, base_url: str, model: str, api_key: str, timeout_seconds: float):
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._model = model
        self._api_key = api_key
        self._timeout = timeout_seconds

    def complete(self, system: str, user: str) -> str:
        """The model's text. Any failure is a ModelUnavailable that says what kind, never the key."""
        try:
            response = httpx.post(
                self._url,
                # A local server such as Ollama needs no key, and "Bearer " with nothing after it is not a valid header.
                headers={"Authorization": f"Bearer {self._api_key}"} if self._api_key else {},
                json={
                    "model": self._model,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
                timeout=self._timeout,
            )
        except httpx.TimeoutException as error:
            raise ModelUnavailable("the model did not answer in time") from error
        except httpx.HTTPError as error:
            raise ModelUnavailable(f"the model could not be reached ({type(error).__name__})") from error
        if response.status_code != 200:
            raise ModelUnavailable(f"the model answered with HTTP {response.status_code}")
        try:
            text = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as error:
            raise ModelUnavailable("the model's response was not a chat completion") from error
        if not isinstance(text, str):
            raise ModelUnavailable("the model's response had no text")
        return text
