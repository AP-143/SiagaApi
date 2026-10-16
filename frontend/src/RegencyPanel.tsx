import type { RegencyCount } from "./api";
import Collapsible from "./Collapsible";
import { ListIcon } from "./icons";

type Props = {
  /** null until the first answer, or when the last request failed with nothing to fall back on. */
  counts: RegencyCount[] | null;
  /** The latest request failed: with no rows that is an error, with rows they may be out of date. */
  failed: boolean;
  open: boolean;
  onToggle: () => void;
};

const formatCount = (count: number) => count.toLocaleString("id-ID");

export default function RegencyPanel({ counts: rows, failed, open, onToggle }: Props) {
  const counts = rows ?? [];
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const busiest = Math.max(1, ...counts.map((row) => row.count));
  return (
    <section className="card regency-panel" aria-label="Titik api per kabupaten/kota">
      <Collapsible label="Ringkasan" icon={<ListIcon />} open={open} onToggle={onToggle}>
        <h2>Titik api per kabupaten/kota</h2>
        {rows === null ? (
          <p className="empty">{failed ? "Tidak dapat memuat ringkasan titik api." : "Memuat ringkasan…"}</p>
        ) : counts.length === 0 ? (
          <p className="empty">Tidak ada titik api</p>
        ) : (
          <>
            {failed && (
              <p className="field-note" role="status">
                Angka ini mungkin sudah lama: ringkasan terbaru gagal dimuat.
              </p>
            )}
            <p className="total">
              Total: <strong>{formatCount(total)}</strong> titik api
            </p>
            <ul>
              {counts.map((row) => (
                <li key={row.regency?.code ?? `unknown-${row.province.code}`}>
                  <span className="name">{row.regency?.name ?? "Kabupaten/kota tidak diketahui"}</span>
                  <span className="count">{formatCount(row.count)}</span>
                  <span className="province">{row.province.name}</span>
                  <span className="bar" aria-hidden="true">
                    <span
                      className="bar-fill"
                      style={{ width: `${Math.max(2, Math.round((row.count / busiest) * 100))}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Collapsible>
    </section>
  );
}
