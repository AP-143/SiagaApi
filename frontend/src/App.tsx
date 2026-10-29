import { useEffect, useMemo, useRef, useState } from "react";

import {
  type Area,
  type Hotspot,
  type RegencyCount,
  fetchFreshness,
  fetchHotspots,
  fetchProvinces,
  fetchRegencies,
  fetchRegencyCounts,
} from "./api";
import Brand from "./Brand";
import ChatPanel from "./ChatPanel";
import Credits from "./Credits";
import FilterPanel from "./FilterPanel";
import { type Filters, filtersToSearch, parseFilters } from "./filters";
import { useLayerData } from "./layers";
import Legend from "./Legend";
import LayersPanel from "./LayersPanel";
import MapView from "./map/MapView";
import { useDismissPopovers, usePanels } from "./panels";
import RegencyPanel from "./RegencyPanel";
import { formatSatelliteDate, latestSatelliteDate } from "./satellite";
import StatusBar, { type FreshnessState } from "./StatusBar";
import { useDarkTheme } from "./theme";
import { useStatusHeight } from "./useStatusHeight";
import { LAYER_INFO, type MapViewState, parseView, viewToParams } from "./view";

// A page left open for hours must keep up with the 30-minute ingestion.
const REFRESH_MS = 5 * 60 * 1000;

/** The per-regency summary, and which filters its rows answer (see the effect that loads it). */
type SummaryState = { rows: RegencyCount[] | null; failed: boolean; key: string };

export default function App() {
  const [filters, setFilters] = useState<Filters>(() =>
    parseFilters(window.location.search),
  );
  const [view, setView] = useState<MapViewState>(() =>
    parseView(window.location.search),
  );
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [provinces, setProvinces] = useState<Area[]>([]);
  const [regencies, setRegencies] = useState<Area[]>([]);
  const [summary, setSummary] = useState<SummaryState>({ rows: null, failed: false, key: "" });
  const [freshness, setFreshness] = useState<FreshnessState>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // "Tampilkan di peta" asks the map to move to wherever the answer's Hotspots turn out to be, once
  // they have been fetched; `focus` counts those requests.
  const pendingFocus = useRef(false);
  const [focus, setFocus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const panels = usePanels();
  useDismissPopovers(Object.values(panels.open).some(Boolean), panels.closeAll);
  useDarkTheme();
  const page = useRef<HTMLElement>(null);
  useStatusHeight(page);
  const layers = useLayerData(view.layers);
  // Fixed for the visit, so the imagery and the date shown beside it can never disagree.
  const satelliteDate = useMemo(() => latestSatelliteDate(), []);

  useEffect(() => {
    const timer = setInterval(
      () => setRefreshTick((tick) => tick + 1),
      REFRESH_MS,
    );
    return () => clearInterval(timer);
  }, []);

  // The page address mirrors the filters and the map view so a view can be shared.
  useEffect(() => {
    const params = new URLSearchParams(filtersToSearch(filters));
    for (const [key, value] of viewToParams(view)) params.set(key, value);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [filters, view]);

  useEffect(() => {
    fetchProvinces().then(setProvinces, () => setProvinces([]));
  }, []);

  useEffect(() => {
    if (!filters.province) {
      setRegencies([]);
      return;
    }
    let cancelled = false;
    fetchRegencies(filters.province).then(
      (areas) => !cancelled && setRegencies(areas),
      () => !cancelled && setRegencies([]),
    );
    return () => {
      cancelled = true;
    };
  }, [filters.province]);

  useEffect(() => {
    // Ignore a response that arrives after the filters have already changed again.
    let cancelled = false;
    setLoading(true);
    fetchHotspots(filters).then(
      (collection) => {
        if (cancelled) return;
        setHotspots(collection.features);
        setLoading(false);
        setLoadFailed(false);
        if (pendingFocus.current) {
          pendingFocus.current = false;
          setFocus((count) => count + 1);
        }
      },
      () => {
        // Keep the last known Hotspots on screen, but say they may be out of date.
        if (cancelled) return;
        setLoadFailed(true);
        setLoading(false);
        pendingFocus.current = false;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [filters, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    // Rows are kept through a failed refresh only while they still answer the same filters;
    // after the filters change they would describe another question.
    const key = filtersToSearch(filters);
    fetchRegencyCounts(filters).then(
      (rows) => !cancelled && setSummary({ rows, failed: false, key }),
      () =>
        !cancelled &&
        setSummary((previous) =>
          previous.key === key ? { ...previous, failed: true } : { rows: null, failed: true, key },
        ),
    );
    return () => {
      cancelled = true;
    };
  }, [filters, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    fetchFreshness().then(
      (value) => !cancelled && setFreshness(value),
      () => !cancelled && setFreshness("unknown"),
    );
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  return (
    <main className="app" ref={page}>
      <div className="grain" aria-hidden="true" />
      <MapView
        hotspots={hotspots}
        view={view}
        layerData={layers.data}
        satelliteDate={satelliteDate}
        focus={focus}
      />
      <div className="overlay overlay-top sheet">
        <Brand />
        <FilterPanel
          filters={filters}
          provinces={provinces}
          regencies={regencies}
          onChange={setFilters}
          open={panels.open.filter}
          onToggle={() => panels.toggle("filter")}
        />
        <LayersPanel
          view={view}
          onViewChange={setView}
          satelliteDate={satelliteDate}
          open={panels.open.layers}
          onToggle={() => panels.toggle("layers")}
        />
      </div>
      <div className="overlay overlay-bottom">
        <StatusBar
          freshness={freshness}
          loadFailed={loadFailed}
          loading={loading}
          imageryDate={view.basemap === "satellite" ? formatSatelliteDate(satelliteDate) : null}
          notes={layers.failed.map(
            (name) => `Lapisan ${LAYER_INFO[name].failedAs} gagal dimuat`,
          )}
        />
        <div className="sheet">
          <RegencyPanel
            counts={summary.rows}
            failed={summary.failed}
            open={panels.open.summary}
            onToggle={() => panels.toggle("summary")}
          />
          <Legend view={view} open={panels.open.legend} onToggle={() => panels.toggle("legend")} />
          <ChatPanel
            open={panels.open.chat}
            onToggle={() => panels.toggle("chat")}
            onShowOnMap={(view) => {
              pendingFocus.current = true;
              setFilters(view);
              panels.closeOnPhone();
            }}
          />
        </div>
        {/* After the bar in the page; drawn in the corner. */}
        <Credits />
      </div>
    </main>
  );
}
