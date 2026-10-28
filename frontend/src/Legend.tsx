import Collapsible from "./Collapsible";
import { KeyIcon } from "./icons";
import type { MapViewState } from "./view";

type Props = { view: MapViewState; open: boolean; onToggle: () => void };

/**
 * Explains what is drawn: always the Hotspot colors, plus each layer that is switched on. It is one
 * of the panels of the bottom bar, so it opens as a sheet like the others, and it belongs to the map
 * rather than to the filters: it is still there whichever other panel was used last.
 */
export default function Legend({ view, open, onToggle }: Props) {
  return (
    <section className="card legend-panel" aria-label="Keterangan">
      <Collapsible label="Keterangan" icon={<KeyIcon />} open={open} onToggle={onToggle}>
        <ul className="legend-list">
          <li>
            <span className="swatch swatch-other" aria-hidden="true" /> Titik jingga: bukan di lahan gambut
          </li>
          <li>
            <span className="swatch swatch-peat" aria-hidden="true" /> Titik ungu: di lahan gambut
          </li>
          <li>Titik lebih besar dan pekat berarti tingkat kepercayaan lebih tinggi</li>
          {view.layers.peatlands && (
            <li>
              <span className="swatch swatch-area" aria-hidden="true" /> Area ungu transparan: sebaran lahan
              gambut
            </li>
          )}
          {view.layers.provinces && (
            <li>
              <span className="swatch swatch-line-thick" aria-hidden="true" /> Garis tebal: batas provinsi
            </li>
          )}
          {view.layers.regencies && (
            <li>
              <span className="swatch swatch-line-thin" aria-hidden="true" /> Garis tipis: batas kabupaten/kota
            </li>
          )}
        </ul>
      </Collapsible>
    </section>
  );
}
