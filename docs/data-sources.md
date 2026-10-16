# Data sources

Raw reference datasets are large and license-sensitive, so they are **not** committed. They live in `data/raw/` (git-ignored). This file records where each one comes from so anyone can fetch it again.

## Province and Regency boundaries

| | |
| --- | --- |
| Dataset | Indonesia administrative level 0-4 boundaries (COD-AB), version 01 |
| Publisher | OCHA Regional Office for Asia and the Pacific (ROAP), published on HDX |
| Original source | Badan Pusat Statistik (BPS - Statistics Indonesia) |
| Boundary year | Boundaries created 2020-04-08, valid for use from 2020-04-01, reviewed 2025-10-30 |
| Page | https://data.humdata.org/dataset/cod-ab-idn |
| License | Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO), read from the HDX API on 2026-10-16 |
| Attribution | Required. The UI must credit "OCHA / BPS (COD-AB Indonesia)" (tracked in ticket 11). |

Fallback if this ever becomes unusable: BIG (Badan Informasi Geospasial).

### Fetch and load

The full archive (`idn_admin_boundaries.geojson.zip`) is 435 MB and covers levels 0-4, but we only need levels 1 and 2. The HDX server is sometimes very slow (a few KB/s), so use the script that fetches just those two files with HTTP Range requests (about 70 MB):

```
mkdir -p data/raw/hdx-cod-ab-idn
docker compose run --rm api python scripts/fetch_hdx_boundaries.py /data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip
docker compose run --rm api python -m app.cli load-boundaries /data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip
```

On Windows with Git Bash, prefix the commands with `MSYS_NO_PATHCONV=1` so `/data/...` is not rewritten into a Windows path.

`load-boundaries` also accepts the full archive. It streams the file and keeps only the five Provinces of the Monitored Region (codes ID61 to ID65) and their Regencies. It is safe to re-run: rows are upserted by code.

Loading the real data gives 5 Provinces and 56 Regencies (Kalimantan Barat 14, Tengah 14, Selatan 13, Timur 10, Utara 5).

### Known caveats

- The boundaries date from 2020. Later changes, such as the Nusantara Capital Authority area in Kalimantan Timur, are not modeled beyond what this dataset contains.
- A Hotspot's Regency must belong to the Province it was placed in. Where a Regency polygon overlaps another Province (a border overlap or a data error) the Hotspot gets no Regency rather than one that contradicts its Province. After changing this rule or the boundaries, run the backfill to re-tag stored Hotspots.
- Province and Regency codes are the BPS codes carried by the dataset (for example `ID61` is Kalimantan Barat).
- The polygons are detailed (the level 1 file alone is about 100 MB uncompressed), which is fine for point-in-polygon with a spatial index.

## Hotspots: NASA FIRMS

| | |
| --- | --- |
| Service | FIRMS Area API, https://firms.modaps.eosdis.nasa.gov/api/area/ |
| Sources used | `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT` (near-real-time VIIRS 375 m). MODIS is not used. |
| Access | A free `MAP_KEY` in the `FIRMS_MAP_KEY` environment variable (see `.env.example`). It is never committed, logged, or returned by the API. |
| Query | Bounding box `108,-5,119.5,5` (around Kalimantan), last 2 days, every 30 minutes. A request covers at most 5 days. |

### CSV encodings (verified against real samples on 2026-10-16)

- `confidence` is a single letter: `l` = low, `n` = nominal, `h` = high. All three occur in real data.
- `satellite` is `N` (S-NPP), `N20` (NOAA-20), or `N21` (NOAA-21).
- `acq_date` is `YYYY-MM-DD` and `acq_time` is `HHMM` in UTC without leading zeros (for example `540` is 05:40).
- A response that is not CSV (for example an invalid key) can still arrive with HTTP 200; ingestion treats it as a failure.

Real volume: about 7,000 detections per 2 days across the three satellites, roughly 4,600 Hotspots per 24 hours after dropping low Confidence.

## Peatland

| | |
| --- | --- |
| Dataset | "Peta Lahan Gambut", the Kementerian Pertanian (BBSDLP) 1:50,000 peat map of Kalimantan. Every polygon is organic soil (USDA Histosol suborders such as Haplohemists and Haplosaprists, parent material "Endapan organik"). |
| Where it comes from | BIG Satu Peta ArcGIS service, layer 6: `https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer/6` (service description "IGT Sumber Daya Alam dan Lingkungan, akses masyarakat", 2024-08-08). The same map is published by Kementan at `sig02.pertanian.go.id/server/rest/services/KSP/IGT_Lahan_Gambut/MapServer/0` (layer `PETA_LAHAN_GAMBUT_PULAU_KALIMANTAN_SKALA_50K`, copyright BBSDLP Kementan), but that server fails the TLS handshake from our machines, so the BIG copy is used. |
| Size and coverage | 146 polygons, 24 landform classes, about 146,000 vertices after simplification; extent 108.86 to 118.58 E and -3.46 to 4.07 N. WGS84 (EPSG:4326). |
| Copyright text | "Sekretariat Kebijakan Satupeta" |
| License | **No license is stated on the layer.** It is published in the public-access ("akses masyarakat") tier of Satu Peta and the data.go.id listing for the same map is marked "Terbuka", but none of them name a license. Confirm the terms with the data owner before a public deployment. The UI credits "Kementerian Pertanian (BBSDLP) melalui BIG Satu Peta". |
| Not used | Peat depth. The layer's landform class carries a thickness range (for example "100 cm - < 200 cm"), but the first version only needs on/off peat. |

Other candidates that were checked and not used:

- WRI/Global Forest Watch "Global peatland extent" (CC BY 4.0, Indonesia part from Miettinen et al. 2016): a 30 m raster, so it does not fit the polygon design.
- BIG layer 48 "Peta Fungsi Ekosistem Gambut 1:50.000" (KLHK, PP 57/2016): peat ecosystem *function* zones (protected versus cultivation), a different thing from where peat soil lies.
- The data.go.id listing (`Peta Lahan Gambut.rar`) returns 404 to automated requests, and BIG Simpatig asks for a login.

### Fetch and load

The service can be slow (one large polygon took about 30 seconds in a test request), because the polygons are huge. `fetch-peat` therefore lists the object ids, asks for two polygons per request, three requests at a time, and has the server simplify the geometry by 0.0001 degrees (about 11 m, far finer than a 375 m VIIRS pixel). It retries failed batches and writes the file only if every batch succeeded.

```
mkdir -p data/raw/peat-kementan-kalimantan
docker compose run --rm api python -m app.cli fetch-peat /data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson
docker compose run --rm api python -m app.cli load-peat /data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson
docker compose run --rm api python -m app.cli backfill
```

On Windows with Git Bash, prefix those commands with `MSYS_NO_PATHCONV=1`.

`load-peat` also accepts any other GeoJSON file or zipped shapefile; if it is not in WGS84, pass its EPSG code with `--srid` (read it from the `.prj` file, do not guess). Loading replaces the whole Peatland dataset. Hotspots stored earlier keep their old flag until the backfill is run. Invalid polygons are repaired on load.

## Satellite imagery: NASA GIBS

| | |
| --- | --- |
| Service | NASA GIBS (Global Imagery Browse Services) WMTS, https://gibs.earthdata.nasa.gov |
| Layer | `VIIRS_SNPP_CorrectedReflectance_TrueColor`, the same VIIRS family that detects the Hotspots |
| Tiles | `.../epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg` (verified to answer HTTP 200 on 2026-10-16, no key needed) |
| Date | Yesterday in UTC. Today's mosaic is still being assembled, so a fixed past day keeps the picture and the date shown on screen in agreement. The date is chosen once per visit. |
| Resolution | Level 9, about 250 m per pixel. Fine for smoke, burn scars and cloud, too coarse for small roads. The map enlarges it beyond zoom 9. |
| Credit | "NASA EOSDIS GIBS", shown in the credits line and in the map attribution. |

Clouds and smoke are part of the picture. That is useful (it shows the haze) but also means the ground can be hidden.

## Map layer endpoints

The read-only API serves the overlays drawn on the map as GeoJSON, cached by browsers for an hour:

| Endpoint | Content | Real size (gzip) |
| --- | --- | --- |
| `GET /layers/provinces` | 5 Province outlines, `code` and `name` | 65 KB |
| `GET /layers/regencies` | 56 Regency outlines, `code`, `name`, `province_code` | 146 KB |
| `GET /layers/peatlands` | 146 Peatland polygons | 533 KB |

The real boundaries run to tens of megabytes, so the browser gets **display copies** simplified at load time (about 550 m for Provinces, 220 m for Regencies, 33 m for Peatland). They are only for drawing lines. Tagging a Hotspot with its Province, Regency and peat status always uses the full-detail geometry, so a line on the map can sit a few hundred metres off the true boundary while the tags stay exact. Databases filled by an older version get their display copies created automatically when the API starts.

## After replacing a dataset: backfill

Province, Regency and Peat Hotspot are computed once, when a Hotspot is ingested. After you replace the boundaries (`load-boundaries`) or the Peatland (`load-peat`), recompute them for every Hotspot already stored, using the raw coordinates that are always kept:

```
docker compose run --rm api python -m app.cli backfill
```

- It is safe to run again; a second run reports `0 changed`.
- It reports how many Hotspots it checked, how many changed, and how many now lie outside every Province.
- Those outside Hotspots are **left untouched**, not deleted. FIRMS only serves a few days back, so history cannot be fetched again, and deleting would be unrecoverable. Decide by hand what to do with them.
- Speed: about 40 ms per Hotspot with the full-resolution polygons (roughly 4 minutes for 6,800 Hotspots, measured on real data). Plan for it to grow with the history; simplifying or subdividing the polygons would be the first optimization.

## Chat knowledge base

The explanations the chat quotes live in `backend/knowledge/*.md` (committed: they are our own short texts, not copies of the sources). Each document names its source and the date we reviewed it against that source, and the chat shows both.

| Document | Source | Address |
| --- | --- | --- |
| `titik-api.md` | NASA FIRMS, Frequently Asked Questions (what a Hotspot is, accuracy, how often data arrives, Confidence) | https://www.earthdata.nasa.gov/data/tools/firms/faq |
| `gambut.md` | KLHK press release of 18 September 2017 (why peat burns, is hard to put out, and smokes) | https://ksdae.kehutanan.go.id/storages/34b959adf0844c3188fa0b7592bb9d2c.docx |
| `cara-membaca-peta.md` | This project's own documentation (how to read the map) | none |
| `tindakan-lapangan.md` | Project content policy; the one example of who puts out fires comes from the same KLHK release | none |
| `kesehatan-kemenkes.md` | Kepmenkes HK.01.07/MENKES/2321/2020 (28 September 2020): guidance for individuals on smoke, masks, oxygen houses (smoke parts only). Read from the signed copy on pasal.id because kemkes.go.id blocks automated access | https://pasal.id/peraturan/permen/kepmenkes-hk-01-07-menkes-2321 |
| `kesehatan-who.md` | WHO Europe, Public health advice during the wildfires (16 June 2023), translated into Indonesian | https://www.who.int/europe/news-room/questions-and-answers/item/public-health-advice-during-the-wildfires--how-to-protect-your-health-and-keep-safe |

Check and reload them with `docker compose run --rm api python -m app.cli load-knowledge` (the API also loads them each time it starts). How to write a document is in `docs/chatbot.md`. Their licenses have not been checked: they are short restatements written for the chat, with the source named, but if full quotations are ever added, confirm the source's terms first.
