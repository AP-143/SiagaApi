"""A fake NASA FIRMS Area API server for tests.

It is the only thing in the backend tests that is faked: FIRMS is a third party that needs a
real MAP_KEY and network access. Everything else (PostGIS, the app) is real.
"""

import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CSV_HEADER = (
    "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,"
    "confidence,version,bright_ti5,frp,daynight"
)


def csv_row(lat, lon, date, time, satellite="N", confidence="n") -> str:
    return f"{lat},{lon},340.1,0.4,0.4,{date},{time},{satellite},VIIRS,{confidence},2.0NRT,300.2,10.5,D"


def firms_csv(*rows: str) -> str:
    return "\n".join([CSV_HEADER, *rows]) + "\n"


class FakeFirms:
    def __init__(self) -> None:
        self.responses: dict[str, tuple[int, str]] = {}
        self.requests: list[str] = []
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        host, port = self._server.server_address
        return f"http://{host}:{port}"

    def respond(self, source: str, body: str, status: int = 200) -> None:
        self.responses[source] = (status, body)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()

    def _handler(self):
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802 (http.server API)
                fake.requests.append(self.path)
                # /api/area/csv/{MAP_KEY}/{SOURCE}/{bbox}/{days}
                parts = self.path.split("/")
                source = parts[5] if len(parts) > 5 else ""
                status, body = fake.responses.get(source, (200, firms_csv()))
                payload = body.encode()
                self.send_response(status)
                self.send_header("Content-Type", "text/csv")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *args):
                pass

        return Handler
