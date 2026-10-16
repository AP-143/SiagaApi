# 12: Detailed map layers and satellite imagery

**What to build:** Anyone looking at the map can see for themselves where a Hotspot lies: peatland areas and Province and Regency boundaries can be drawn under the Hotspots, and the base map can be switched to recent satellite imagery. Hotspots always stay on top. Added after the first release at the request of the project owner, so that viewers understand what they see and field staff can place a Hotspot in its surroundings. See `spec.md`.

**Blocked by:** None (all earlier tickets are done)

**Status:** ready-for-agent

- [x] The API serves Province outlines, Regency outlines and Peatland polygons as GeoJSON, simplified for the browser, cacheable for an hour
- [x] Display copies of the boundaries are created when a boundary dataset is loaded, and for databases filled earlier when the API starts; Hotspot tagging keeps using the full-detail geometry
- [x] The UI has a "Lapisan" panel with switches for Batas provinsi, Batas kabupaten/kota and Area lahan gambut; Province lines and peatland are on by default, Regency lines are off
- [x] A layer is downloaded only the first time it is switched on, and never twice; a layer that fails to load is reported without alarm and retried when switched off and on
- [x] Hotspots are always drawn above every boundary and peatland layer
- [x] The base map can be switched between the street map and NASA GIBS satellite imagery; the date of the imagery is shown whenever it is in use
- [x] Boundary lines stay readable on the light map, the dark map and satellite imagery
- [x] The chosen layers and base map are reflected in the page address and restored from it; defaults leave the address untouched; a garbled value falls back to the defaults
- [x] The legend explains each layer that is switched on, and NASA GIBS is credited
- [x] On a phone the layers get their own panel so no single panel needs long scrolling
- [x] Seam 1 tests cover the layer endpoints; Seam 2 tests cover the panel, the base map switch, the address and the failure handling

## Not done, and why

- **Field navigation** (copyable coordinates, a "directions" link, how old a Hotspot is, a note that a satellite position is only accurate to about 375 m) was offered and not chosen. It would help staff who travel to a Hotspot and is the natural next step.
- **Sensor details** (fire radiative power, brightness temperature, day/night) were not chosen. They are in the FIRMS data but are not stored yet, so only Hotspots ingested after that change would have them.
- **Named labels** on the boundary lines were skipped: MapLibre labels need a font server, which would add a third-party dependency.
