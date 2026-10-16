"""Download only admin levels 1 and 2 of the HDX COD-AB Indonesia archive (about 70 MB instead of 435 MB).

The full archive holds levels 0-4 and the HDX server can be very slow. The zip format lets us read
its table of contents with HTTP Range requests and fetch just the two members we need, then repack
them under the same names so `load-boundaries` accepts the result unchanged.

Usage: python scripts/fetch_hdx_boundaries.py <output.zip>
"""
import struct
import sys
import time
import zipfile
import zlib

import httpx

URL = (
    "https://data.humdata.org/dataset/84a1d98a-790b-4d66-9d14-bbfa48500802/resource/"
    "e1421da4-8f48-47d2-ac49-79ff5bfa4d24/download/idn_admin_boundaries.geojson.zip"
)
WANTED = {"idn_admin1.geojson", "idn_admin2.geojson"}
OUT = sys.argv[1]

client = httpx.Client(follow_redirects=True, timeout=120)


def fetch(start: int, end: int, attempts: int = 8) -> bytes:
    for attempt in range(attempts):
        try:
            r = client.get(URL, headers={"Range": f"bytes={start}-{end}"})
            if r.status_code == 206 and len(r.content) == end - start + 1:
                return r.content
            print(f"  unexpected {r.status_code} len={len(r.content)}", flush=True)
        except httpx.HTTPError as e:
            print(f"  retry after {type(e).__name__}", flush=True)
        time.sleep(3)
    raise SystemExit(f"failed range {start}-{end}")


probe = client.get(URL, headers={"Range": "bytes=0-0"})
total = int(probe.headers["Content-Range"].split("/")[1])
print("total size", total, flush=True)

tail_len = 4_000_000
tail = fetch(total - tail_len, total - 1)
eocd = tail.rfind(b"PK\x05\x06")
entries, cd_size, cd_offset = struct.unpack("<10xHII", tail[eocd : eocd + 20])
print("entries", entries, "central dir at", cd_offset, "size", cd_size, flush=True)
cd = tail[cd_offset - (total - tail_len) : cd_offset - (total - tail_len) + cd_size]

found = {}
pos = 0
while pos < len(cd) and cd[pos : pos + 4] == b"PK\x01\x02":
    comp, uncomp = struct.unpack("<II", cd[pos + 20 : pos + 28])
    name_len, extra_len, comment_len = struct.unpack("<HHH", cd[pos + 28 : pos + 34])
    (local_offset,) = struct.unpack("<I", cd[pos + 42 : pos + 46])
    name = cd[pos + 46 : pos + 46 + name_len].decode()
    print(" member", name, comp, uncomp, flush=True)
    if name in WANTED:
        found[name] = (local_offset, comp)
    pos += 46 + name_len + extra_len + comment_len

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as out:
    for name, (offset, comp) in found.items():
        print("fetching", name, comp, "bytes", flush=True)
        slack = 2048
        chunk_size = 6_000_000
        data = bytearray()
        want = comp + 30 + slack
        got = 0
        while got < want:
            end = min(offset + got + chunk_size, offset + want, total) - 1
            piece = fetch(offset + got, end)
            data += piece
            got += len(piece)
            print(f"  {name}: {got * 100 // want}%", flush=True)
        name_len, extra_len = struct.unpack("<HH", bytes(data[26:30]))
        body = bytes(data[30 + name_len + extra_len : 30 + name_len + extra_len + comp])
        decompressor = zlib.decompressobj(-15)
        with out.open(name, "w", force_zip64=True) as dest:
            for i in range(0, len(body), 1_000_000):
                dest.write(decompressor.decompress(body[i : i + 1_000_000]))
            dest.write(decompressor.flush())
        print("done", name, flush=True)
print("WROTE", OUT)
