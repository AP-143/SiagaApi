import { useEffect, useMemo, useState } from "react";

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
import { usePanels } from "./panels";
import RegencyPanel from "./RegencyPanel";
import { formatSatelliteDate, latestSatelliteDate } from "./satellite";
import StatusBar, { type FreshnessState } from "./StatusBar";
import { useTheme } from "./theme";
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
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const panels = usePanels();
  const { theme, toggle: toggleTheme } = useTheme();
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
      },
      () => {
        // Keep the last known Hotspots on screen, but say they may be out of date.
        if (cancelled) return;
        setLoadFailed(true);
        setLoading(false);
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
    <main className="app">
      <div className="grain" aria-hidden="true" />
      <MapView
        hotspots={hotspots}
        theme={theme}
        view={view}
        layerData={layers.data}
        satelliteDate={satelliteDate}
      />
      <div className="overlay overlay-top sheet">
        <Brand theme={theme} onToggleTheme={toggleTheme} />
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
        <Legend view={view} />
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
          <ChatPanel
            open={panels.open.chat}
            onToggle={() => panels.toggle("chat")}
            onShowOnMap={(view) => {
              setFilters(view);
              panels.closeOnPhone();
            }}
          />
          <RegencyPanel
            counts={summary.rows}
            failed={summary.failed}
            open={panels.open.summary}
            onToggle={() => panels.toggle("summary")}
          />
        </div>
        <Credits />
      </div>
    </main>
  );
}
