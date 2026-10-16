# SiagaApi

A public, near-real-time map of satellite-detected heat anomalies across Indonesian Kalimantan, built for wildfire responders. "Api" in the name is Indonesian for fire; it is not an API.

## Language

**Hotspot**:
A single satellite detection of a thermal anomaly at one location and time. It is a signal of possible fire, not proof of one. The UI may show it as "titik api" or "titik panas".
_Avoid_: Fire, fire point, burn

**Fire**:
A Hotspot that has been confirmed as an actual wildfire. Not used until the product supports confirmation.
_Avoid_: Hotspot (when confirmation is meant)

**Monitored Region**:
The five Indonesian provinces of Kalimantan: Kalimantan Barat, Tengah, Selatan, Timur, and Utara. Hotspots outside it are ignored.
_Avoid_: Borneo, Kalimantan island

**Province**:
A first-level administrative area of Indonesia. The Monitored Region consists of five Provinces.
_Avoid_: State, region

**Regency**:
A second-level administrative area below a Province, covering both a kabupaten and a kota.
_Avoid_: District, county, city (when either kind is meant)

**Peatland**:
Land covered by peat soil, which burns deeply and is the hardest to extinguish. Represented as polygons.
_Avoid_: Peat area, bog

**Peat Hotspot**:
A Hotspot whose center point falls inside a Peatland polygon. A binary property: a Hotspot either is one or is not, with no buffer and no peat depth or type.
_Avoid_: Hotspot on peat, peat fire

**Confidence**:
The satellite's own rating of how likely a Hotspot is a real fire: low, nominal, or high. All Hotspots are stored; low-Confidence ones are hidden on the map by default.
_Avoid_: Accuracy, probability, certainty

**Responder**:
A person who acts on Hotspots in the field or in coordination, such as BPBD, Manggala Agni, or local government staff. The primary audience; the map itself is open to the public without login.
_Avoid_: User (when the primary audience is meant), operator
