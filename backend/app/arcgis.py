import json
import logging
import os
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

# BIG Satu Peta, layer "Peta Lahan Gambut": the Kementan (BBSDLP) 1:50,000 peat map of Kalimantan.
KALIMANTAN_PEAT_LAYER_URL = (
    "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/"
    "SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer/6"
)

# About 11 m: far finer than a 375 m VIIRS pixel, but it keeps the server's work and the file small.
DEFAULT_SIMPLIFY_DEGREES = 0.0001

logger = logging.getLogger(__name__)


class ArcGisError(Exception):
    """A layer could not be downloaded completely."""


def _get_json(client: httpx.Client, url: str, params: dict, attempts: int, sleep) -> dict:
    last_error = "unknown error"
    for attempt in range(attempts):
        try:
            response = client.get(url, params=params)
            if response.status_code == 200:
                body = response.json()
                # ArcGIS reports many failures as a 200 with an "error" object
                if "error" not in body:
                    return body
                last_error = f"service error {body['error'].get('code', '')}"
            else:
                last_error = f"HTTP {response.status_code}"
        except (httpx.HTTPError, ValueError) as error:
            last_error = type(error).__name__
        if attempt < attempts - 1:
            sleep(2**attempt)
    raise ArcGisError(f"Request failed after {attempts} attempts ({last_error})")


def download_layer(
    layer_url: str,
    out_path: Path | str,
    *,
    where: str = "1=1",
    out_fields: str = "*",
    ids_per_request: int = 2,
    workers: int = 3,
    max_allowable_offset: float = DEFAULT_SIMPLIFY_DEGREES,
    attempts: int = 4,
    timeout: float = 300,
    sleep: Callable[[float], None] = time.sleep,
    keep: Callable[[dict], bool] = lambda feature: True,
) -> int:
    """Download an ArcGIS feature layer as one GeoJSON file in WGS84; returns the feature count.

    Large layers time out when fetched in one request, so this lists the object ids first and then
    fetches a few features per request, a few requests at a time. The file is written only when
    every batch succeeded, so a failure never leaves a half-finished dataset behind.
    """
    out_path = Path(out_path)
    query_url = f"{layer_url}/query"
    with httpx.Client(timeout=timeout) as client:
        listing = _get_json(
            client, query_url, {"where": where, "returnIdsOnly": "true", "f": "json"}, attempts, sleep
        )
        object_ids = sorted(listing.get("objectIds") or [])
        if not object_ids:
            raise ArcGisError("The layer returned no features")
        batches = [
            object_ids[i : i + ids_per_request] for i in range(0, len(object_ids), ids_per_request)
        ]

        def fetch(batch: list[int]) -> list[dict]:
            params = {
                "objectIds": ",".join(str(i) for i in batch),
                "outFields": out_fields,
                "returnGeometry": "true",
                "outSR": "4326",
                "maxAllowableOffset": str(max_allowable_offset),
                "geometryPrecision": "5",
                "f": "geojson",
            }
            body = _get_json(client, query_url, params, attempts, sleep)
            logger.info("downloaded features %s-%s", batch[0], batch[-1])
            return body["features"]

        with ThreadPoolExecutor(max_workers=workers) as pool:
            # map() keeps batch order, so the file is in object-id order however the replies land
            results = list(pool.map(fetch, batches))

    features = [f for batch in results for f in batch if keep(f)]
    temporary = out_path.with_suffix(out_path.suffix + ".part")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump({"type": "FeatureCollection", "features": features}, handle)
    os.replace(temporary, out_path)
    return len(features)


def _is_real_peat_row(feature: dict) -> bool:
    # The source has one junk row whose values are the column names themselves.
    return feature.get("properties", {}).get("landform") != "landform"


def download_kalimantan_peat(
    out_path: Path | str, layer_url: str = KALIMANTAN_PEAT_LAYER_URL, **options
) -> int:
    """Download the Kementan 1:50,000 peat map of Kalimantan (every polygon is organic soil)."""
    return download_layer(
        layer_url,
        out_path,
        out_fields="landform,usda1,bhnindk,relief",
        keep=_is_real_peat_row,
        **options,
    )
