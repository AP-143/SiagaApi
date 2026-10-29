import { useEffect, useState } from "react";

import type { Freshness } from "./api";
import { AlertIcon, ClockIcon } from "./icons";
import { formatInZone } from "./map/time";

// The free server sleeps when nobody has visited for a while and takes about a minute to wake. After
// this long without an answer the page says so, instead of looking stuck.
export const WAKING_AFTER_MS = 8000;

/** True once `loading` has lasted longer than WAKING_AFTER_MS; back to false as soon as it stops. */
function useWaking(loading: boolean): boolean {
  const [waking, setWaking] = useState(false);
  useEffect(() => {
    if (!loading) {
      setWaking(false);
      return;
    }
    const timer = setTimeout(() => setWaking(true), WAKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [loading]);
  return waking;
}

export type FreshnessState = Freshness | "unknown" | null;

type Props = {
  freshness: FreshnessState;
  loadFailed: boolean;
  loading: boolean;
  /** Minor problems, such as a decorative map layer that did not load. Not worth an alarm. */
  notes?: string[];
  /** The day of the satellite imagery behind the map, while it is in use. Always in view. */
  imageryDate?: string | null;
};

function Alert({ children }: { children: string }) {
  return (
    <p role="alert" className="pill pill-alert">
      <AlertIcon />
      <span>{children}</span>
    </p>
  );
}

/** When the data was last updated, and a loud warning whenever it cannot be trusted as current. */
export default function StatusBar({ freshness, loadFailed, loading, notes = [], imageryDate = null }: Props) {
  const known = freshness && freshness !== "unknown" ? freshness : null;
  const lastUpdated = known?.last_updated ?? null;
  const waking = useWaking(loading);
  return (
    <div className="status-bar">
      {loading && (
        <p role="status" className="pill pill-loading">
          <span className="spinner" aria-hidden="true" />
          <span>
            {waking
              ? "Server sedang bangun, mohon tunggu sebentar…"
              : "Memuat titik api…"}
          </span>
        </p>
      )}
      {lastUpdated && (
        <p className={`pill pill-time ${known?.stale ? "is-stale" : "is-fresh"}`}>
          <ClockIcon />
          <span>Terakhir diperbarui: {formatInZone(lastUpdated, "WIB")}</span>
        </p>
      )}
      {freshness === "unknown" && <Alert>Tidak dapat memeriksa kesegaran data.</Alert>}
      {known && known.last_updated === null && (
        <Alert>Data belum pernah diperbarui, peta mungkin kosong.</Alert>
      )}
      {known && known.last_updated !== null && known.stale && (
        <Alert>Data mungkin usang: pembaruan terakhir lebih dari 6 jam yang lalu.</Alert>
      )}
      {loadFailed && (
        <Alert>Tidak dapat memuat data terbaru dari server. Data yang tampil mungkin sudah lama.</Alert>
      )}
      {imageryDate && <p className="pill pill-note">Citra satelit: {imageryDate}</p>}
      {notes.map((note) => (
        <p key={note} className="pill pill-note" aria-live="polite">
          {note}
        </p>
      ))}
    </div>
  );
}
