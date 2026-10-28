"""A fake OpenAI-compatible chat server for tests.

The real model is a third party (a local Ollama or a hosted free API), so the wire format is the only
thing these tests need to be sure about; what a real model says is judged by the manual evaluation.
"""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def completion(text: str) -> str:
    """The body of a successful chat completion carrying `text`."""
    return json.dumps({"choices": [{"index": 0, "message": {"role": "assistant", "content": text}}]})


class FakeModelServer:
    def __init__(self) -> None:
        self.status = 200
        self.body = completion("ok")
        self.delay_seconds = 0.0
        self.requests: list[dict] = []  # path, headers and JSON body of every request
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        host, port = self._server.server_address
        return f"http://{host}:{port}"

    def respond(self, body: str, status: int = 200) -> None:
        self.status, self.body = status, body

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()

    def _handler(self):
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):  # noqa: N802 (http.server API)
                length = int(self.headers.get("Content-Length", 0))
                fake.requests.append(
                    {
                        "path": self.path,
                        "headers": {k.lower(): v for k, v in self.headers.items()},
                        "json": json.loads(self.rfile.read(length) or b"{}"),
                    }
                )
                time.sleep(fake.delay_seconds)
                payload = fake.body.encode()
                try:
                    self.send_response(fake.status)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # the client gave up waiting, which is what the timeout test wants

            def log_message(self, *args):
                pass

        return Handler
