export type LayerName = "provinces" | "regencies" | "peatlands";
export type Basemap = "map" | "satellite";

export type MapViewState = {
  layers: Record<LayerName, boolean>;
  basemap: Basemap;
};

/** Province outlines and peatland give context to every Hotspot; Regency lines are opt-in detail. */
export const DEFAULT_VIEW: MapViewState = {
  layers: { provinces: true, regencies: false, peatlands: true },
  basemap: "map",
};

export const LAYER_NAMES: LayerName[] = ["provinces", "regencies", "peatlands"];

/** Words used for each layer in the page address and in the interface. */
export const LAYER_INFO: Record<LayerName, { urlName: string; label: string; failedAs: string }> = {
  provinces: { urlName: "provinsi", label: "Batas provinsi", failedAs: "batas provinsi" },
  regencies: { urlName: "kabupaten", label: "Batas kabupaten/kota", failedAs: "batas kabupaten/kota" },
  peatlands: { urlName: "gambut", label: "Area lahan gambut", failedAs: "area lahan gambut" },
};

function sameLayers(a: MapViewState["layers"], b: MapViewState["layers"]) {
  return LAYER_NAMES.every((name) => a[name] === b[name]);
}

/** Read the map view from a page address; anything unusable falls back to the default. */
export function parseView(search: string): MapViewState {
  const params = new URLSearchParams(search);
  const basemap: Basemap = params.get("base") === "satellite" ? "satellite" : "map";

  const raw = params.get("layers");
  let layers = DEFAULT_VIEW.layers;
  if (raw === "none") {
    layers = { provinces: false, regencies: false, peatlands: false };
  } else if (raw) {
    const wanted = raw.split(",");
    const known = LAYER_NAMES.filter((name) => wanted.includes(LAYER_INFO[name].urlName));
    // A value with no recognizable layer is garbled, not a request to hide everything.
    if (known.length > 0) {
      layers = {
        provinces: known.includes("provinces"),
        regencies: known.includes("regencies"),
        peatlands: known.includes("peatlands"),
      };
    }
  }
  return { layers, basemap };
}

/** The address parameters for a view; defaults are left out to keep addresses short. */
export function viewToParams(view: MapViewState): Array<[string, string]> {
  const params: Array<[string, string]> = [];
  if (!sameLayers(view.layers, DEFAULT_VIEW.layers)) {
    const enabled = LAYER_NAMES.filter((name) => view.layers[name]);
    params.push(["layers", enabled.length ? enabled.map((n) => LAYER_INFO[n].urlName).join(",") : "none"]);
  }
  if (view.basemap !== DEFAULT_VIEW.basemap) params.push(["base", view.basemap]);
  return params;
}
