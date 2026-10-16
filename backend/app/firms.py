import csv
import logging
import io
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from app.config import Settings

# The three VIIRS near-real-time sources. MODIS is deliberately not used.
VIIRS_SOURCES = ("VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT")

# west,south,east,north around Kalimantan. Detections outside the Monitored Region are dropped later.
KALIMANTAN_BBOX = "108,-5,119.5,5"

# VIIRS 375 m CSV encodings, verified against real FIRMS samples.
SATELLITES = {"N": "S-NPP", "N20": "NOAA-20", "N21": "NOAA-21"}
CONFIDENCES = {"l": "low", "n": "nominal", "h": "high"}


# httpx logs every request URL at INFO, and a FIRMS URL carries the MAP_KEY.
logging.getLogger("httpx").setLevel(logging.WARNING)


class FirmsError(Exception):
    """A FIRMS request or response could not be used. Messages never include the MAP_KEY."""


@dataclass(frozen=True)
class Detection:
    satellite: str
    latitude: float
    longitude: float
    acquired_at: datetime
    confidence: str


def fetch_detections(settings: Settings, source: str, days: int) -> list[Detection]:
    url = (
        f"{settings.firms_base_url}/api/area/csv/{settings.firms_map_key}"
        f"/{source}/{KALIMANTAN_BBOX}/{days}"
    )
    try:
        response = httpx.get(url, timeout=60)
    except httpx.HTTPError as error:
        raise FirmsError(f"FIRMS request for {source} failed: {type(error).__name__}") from None
    if response.status_code != 200:
        raise FirmsError(f"FIRMS request for {source} failed with status {response.status_code}")
    return parse_viirs_csv(response.text, source)


def parse_viirs_csv(text: str, source: str) -> list[Detection]:
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or "latitude" not in reader.fieldnames:
        # FIRMS answers some errors (such as an invalid MAP_KEY) with a plain-text 200.
        raise FirmsError(f"FIRMS response for {source} is not a detection CSV")
    detections = []
    for row in reader:
        try:
            satellite = SATELLITES[row["satellite"]]
            confidence = CONFIDENCES[row["confidence"]]
        except KeyError as error:
            raise FirmsError(f"FIRMS response for {source} has an unexpected value: {error}") from None
        hhmm = int(row["acq_time"])
        acquired_at = datetime.strptime(row["acq_date"], "%Y-%m-%d").replace(
            hour=hhmm // 100, minute=hhmm % 100, tzinfo=timezone.utc
        )
        detections.append(
            Detection(
                satellite=satellite,
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                acquired_at=acquired_at,
                confidence=confidence,
            )
        )
    return detections
