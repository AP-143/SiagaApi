import maplibregl, { type ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import type { Hotspot } from "../api";
import type { LayerData } from "../layers";
import { satelliteTileUrl } from "../satellite";
import { LAYER_NAMES, type MapViewState } from "../view";
import { basemapPaint } from "./basemap";
import { FrameIcon, MinusIcon, PlusIcon } from "../icons";
import { FRAME_PADDING, KALIMANTAN_BOUNDS } from "./kalimantan";
import { OVERLAY_LAYERS, overlayLayerSpecs } from "./overlays";
import { buildHotspotPopup } from "./popup";

const HOTSPOT_SOURCE = "hotspots";
const GLOW_LAYER = "hotspots-glow";
const STREET_LAYER = "osm";
const SATELLITE_LAYER = "satellite";

// More confident detections are bigger and more opaque, so reliability reads at a glance.
const RADIUS: ExpressionSpecification = [
  "match",
  ["get", "confidence"],
  "low",
  3,
  "nominal",
  5,
  "high",
  7,
  5,
];
const OPACITY: ExpressionSpecification = [
  "match",
  ["get", "confidence"],
  "low",
  0.45,
  "nominal",
  0.75,
  "high",
  1,
  0.75,
];
// Peat is the most dangerous terrain, so peat Hotspots get their own unmistakable color.
const COLOR: ExpressionSpecification = ["case", ["get", "peat_hotspot"], "#a855f7", "#f97316"];

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function visibility(shown: boolean): "visible" | "none" {
  return shown ? "visible" : "none";
}

function basemapStyle(view: MapViewState, satelliteDate: string) {
  return {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
      satellite: {
        type: "raster" as const,
        tiles: [satelliteTileUrl(satelliteDate)],
        tileSize: 256,
        maxzoom: 9, // GIBS' finest level; the map enlarges it beyond that
        attribution: "Citra: NASA EOSDIS GIBS",
      },
    },
    layers: [
      {
        id: STREET_LAYER,
        type: "raster" as const,
        source: "osm",
        layout: { visibility: visibility(view.basemap === "map") },
        paint: basemapPaint(),
      },
      {
        id: SATELLITE_LAYER,
        type: "raster" as const,
        source: "satellite",
        layout: { visibility: visibility(view.basemap === "satellite") },
      },
    ],
  };
}

/** Fit the map to Kalimantan with room for the bars around it. */
function frameKalimantan(map: maplibregl.Map, animate: boolean) {
  map.fitBounds(KALIMANTAN_BOUNDS, { padding: FRAME_PADDING, animate, duration: 700 });
}

function toCollection(hotspots: Hotspot[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: hotspots };
}

type Props = {
  hotspots: Hotspot[];
  view: MapViewState;
  layerData: LayerData;
  satelliteDate: string;
};

export default function MapView({ hotspots, view, layerData, satelliteDate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  // Always the latest values, so map callbacks never see stale ones.
  const latest = useRef({ hotspots, view, layerData, satelliteDate });
  latest.current = { hotspots, view, layerData, satelliteDate };

  useEffect(() => {
    if (!containerRef.current) return;
    const { view: initialView, satelliteDate: date } = latest.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyle(initialView, date),
      bounds: KALIMANTAN_BOUNDS,
      // The map's own attribution button is off: the "Sumber data" chip carries every credit, so there
      // is a single info button instead of two.
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      // The container may not have had its final size when the map was built, so frame again now.
      map.resize();
      frameKalimantan(map, false);
      const current = latest.current;
      // Boundary and peatland layers go in first, so everything below is drawn under the Hotspots.
      for (const name of LAYER_NAMES) {
        map.addSource(name, { type: "geojson", data: current.layerData[name] ?? EMPTY });
      }
      for (const spec of overlayLayerSpecs()) {
        const layer = OVERLAY_LAYERS.find((candidate) => candidate.id === spec.id)!.layer;
        map.addLayer({ ...spec, layout: { visibility: visibility(current.view.layers[layer]) } });
      }

      map.addSource(HOTSPOT_SOURCE, { type: "geojson", data: toCollection(current.hotspots) });
      // A soft halo under each point makes clusters glow and individual points easy to find.
      map.addLayer({
        id: GLOW_LAYER,
        type: "circle",
        source: HOTSPOT_SOURCE,
        paint: {
          "circle-radius": ["*", RADIUS, 2.4],
          "circle-color": COLOR,
          "circle-opacity": 0.16,
          "circle-blur": 0.8,
        },
      });
      map.addLayer({
        id: HOTSPOT_SOURCE,
        type: "circle",
        source: HOTSPOT_SOURCE,
        paint: {
          "circle-radius": RADIUS,
          "circle-opacity": OPACITY,
          "circle-color": COLOR,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.85,
        },
      });
      map.on("click", HOTSPOT_SOURCE, (event) => {
        // MapLibre flattens nested properties to strings, so look the Hotspot up by id.
        const id = event.features?.[0]?.properties?.id;
        const hotspot = latest.current.hotspots.find((h) => h.properties.id === id);
        if (!hotspot) return;
        new maplibregl.Popup({ closeButton: true, maxWidth: "300px", offset: 10 })
          .setLngLat(hotspot.geometry.coordinates as [number, number])
          .setDOMContent(buildHotspotPopup(hotspot))
          .addTo(map);
      });
      // Show that points are tappable.
      map.on("mouseenter", HOTSPOT_SOURCE, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", HOTSPOT_SOURCE, () => {
        map.getCanvas().style.cursor = "";
      });
      setReady(true);
    });

    return () => {
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource(HOTSPOT_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(toCollection(hotspots));
  }, [hotspots]);

  // Boundary and peatland data arrives after the map is built, whenever a layer is first switched on.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const name of LAYER_NAMES) {
      const collection = layerData[name];
      if (collection) (map.getSource(name) as maplibregl.GeoJSONSource).setData(collection);
    }
  }, [layerData, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const { id, layer } of OVERLAY_LAYERS) {
      map.setLayoutProperty(id, "visibility", visibility(view.layers[layer]));
    }
  }, [view.layers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty(STREET_LAYER, "visibility", visibility(view.basemap === "map"));
    map.setLayoutProperty(SATELLITE_LAYER, "visibility", visibility(view.basemap === "satellite"));
  }, [view.basemap, ready]);

  return (
    <>
      <div ref={containerRef} className="map" aria-label="Peta Kalimantan" />
      {/* One group of three buttons of the same size, drawn by us so they are always the same distance apart. */}
      <div className="map-controls" role="group" aria-label="Kontrol peta">
        <button type="button" aria-label="Perbesar" title="Perbesar" onClick={() => mapRef.current?.zoomIn()}>
          <PlusIcon />
        </button>
        <button type="button" aria-label="Perkecil" title="Perkecil" onClick={() => mapRef.current?.zoomOut()}>
          <MinusIcon />
        </button>
        <button
          type="button"
          aria-label="Tampilkan seluruh Kalimantan"
          title="Tampilkan seluruh Kalimantan"
          onClick={() => mapRef.current && frameKalimantan(mapRef.current, true)}
        >
          <FrameIcon />
        </button>
      </div>
    </>
  );
}
