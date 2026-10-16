import type { Freshness } from "./api";
import { AlertIcon, ClockIcon } from "./icons";
import { formatInZone } from "./map/time";

export type FreshnessState = Freshness | "unknown" | null;

type Props = {
  freshness: FreshnessState;
  loadFailed: boolean;
  loading: boolean;
  /** Minor problems, such as a decorative map layer that did not load. Not worth an alarm. */
  notes?: string[];
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
export default function StatusBar({ freshness, loadFailed, loading, notes = [] }: Props) {
  const known = freshness && freshness !== "unknown" ? freshness : null;
  const lastUpdated = known?.last_updated ?? null;
  return (
    <div className="status-bar">
      {loading && (
        <p role="status" className="pill pill-loading">
          <span className="spinner" aria-hidden="true" />
          <span>Memuat titik api…</span>
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
      {notes.map((note) => (
        <p key={note} className="pill pill-note" aria-live="polite">
          {note}
        </p>
      ))}
    </div>
  );
}
