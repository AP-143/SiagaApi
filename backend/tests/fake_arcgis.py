"""A fake ArcGIS REST layer: just enough of /query to page through features by object id."""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


class FakeArcGisLayer:
    def __init__(self, features: list[dict]):
        # Each feature: {"objectid": int, "properties": {...}, "geometry": {...}}
        self.features = {f["objectid"]: f for f in features}
        self.requests: list[dict] = []
        self.failures_left: dict[tuple, int] = {}  # object-id tuple -> times to answer 500
        self.always_fail: set[tuple] = set()
        self._server = ThreadingHTTPServer(("127.0.0.1", 0), self._handler())
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        host, port = self._server.server_address
        return f"http://{host}:{port}/MapServer/0"

    def start(self):
        self._thread.start()

    def stop(self):
        self._server.shutdown()
        self._server.server_close()

    def _handler(self):
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def _send(self, status, body):
                payload = json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_GET(self):  # noqa: N802 (http.server API)
                query = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
                fake.requests.append(query)
                if query.get("returnIdsOnly") == "true":
                    return self._send(
                        200, {"objectIdFieldName": "objectid", "objectIds": sorted(fake.features)}
                    )
                ids = tuple(int(i) for i in query["objectIds"].split(","))
                if ids in fake.always_fail:
                    return self._send(500, {"error": "boom"})
                if fake.failures_left.get(ids, 0) > 0:
                    fake.failures_left[ids] -= 1
                    return self._send(500, {"error": "temporary"})
                # Later chunks answer faster, so results arrive out of order
                time.sleep(0.05 * (10 - min(ids)) / 10)
                self._send(
                    200,
                    {
                        "type": "FeatureCollection",
                        "features": [
                            {
                                "type": "Feature",
                                "id": i,
                                "properties": fake.features[i]["properties"],
                                "geometry": fake.features[i]["geometry"],
                            }
                            for i in ids
                        ],
                    },
                )

            def log_message(self, *args):
                pass

        return Handler
