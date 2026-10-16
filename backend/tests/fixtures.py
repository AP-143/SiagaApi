"""Small hand-made boundary features in the OCHA COD-AB property schema.

Each area is a 1x1 degree square so tests can place points inside or outside by eye.
"""


def square(west: float, south: float, size: float = 1.0) -> dict:
    east, north = west + size, south + size
    return {
        "type": "MultiPolygon",
        "coordinates": [
            [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
        ],
    }


def province(code: str, name: str, west: float, south: float, size: float = 1.0) -> dict:
    return {
        "type": "Feature",
        "properties": {"adm1_pcode": code, "adm1_name": name},
        "geometry": square(west, south, size),
    }


def regency(
    code: str,
    name: str,
    province_code: str,
    province_name: str,
    west: float,
    south: float,
    size: float = 0.5,
) -> dict:
    return {
        "type": "Feature",
        "properties": {
            "adm2_pcode": code,
            "adm2_name": name,
            "adm1_pcode": province_code,
            "adm1_name": province_name,
        },
        "geometry": square(west, south, size),
    }


# Province squares (1x1). West Kalimantan occupies lon 110-111, lat 0-1, and so on.
KALBAR = province("ID61", "Kalimantan Barat", 110.0, 0.0)
KALTENG = province("ID62", "Kalimantan Tengah", 112.0, -2.0)
KALSEL = province("ID63", "Kalimantan Selatan", 114.0, -3.0)
KALTIM = province("ID64", "Kalimantan Timur", 116.0, 0.0)
KALTARA = province("ID65", "Kalimantan Utara", 117.0, 3.0)
JABAR = province("ID32", "Jawa Barat", 107.0, -7.0)

ALL_PROVINCES = [KALBAR, KALTENG, KALSEL, KALTIM, KALTARA, JABAR]

# Regencies (0.5x0.5), two per West Kalimantan so a Province-to-Regency listing is meaningful.
SAMBAS = regency("ID6101", "Sambas", "ID61", "Kalimantan Barat", 110.0, 0.0)
PONTIANAK = regency("ID6171", "Pontianak", "ID61", "Kalimantan Barat", 110.5, 0.5)
PALANGKA_RAYA = regency("ID6271", "Palangka Raya", "ID62", "Kalimantan Tengah", 112.0, -2.0)
BANDUNG = regency("ID3273", "Bandung", "ID32", "Jawa Barat", 107.0, -7.0)

ALL_REGENCIES = [SAMBAS, PONTIANAK, PALANGKA_RAYA, BANDUNG]


def peat(west: float, south: float, size: float = 0.3) -> dict:
    """A Peatland polygon in the property-free GeoJSON shape peat datasets usually have."""
    return {"type": "Feature", "properties": {}, "geometry": square(west, south, size)}


# Covers 110-110.3 E, 0-0.3 N: the Sambas hotspot location (110.25, 0.25) but not Pontianak's.
PEAT_NEAR_SAMBAS = peat(110.0, 0.0, 0.3)
