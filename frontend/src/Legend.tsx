import { useState } from "react";

import { ChevronIcon } from "./icons";
import { isNarrowViewport } from "./viewport";
import type { MapViewState } from "./view";

type Props = { view: MapViewState };

/**
 * Explains what is drawn: always the Hotspot colors, plus each layer that is switched on. It belongs
 * to the map rather than to a panel, so it is still there when the filters are folded away. A wide
 * screen starts with it open along the bottom of the map; a narrow one starts with just its title.
 */
export default function Legend({ view }: Props) {
  const [open, setOpen] = useState(() => !isNarrowViewport());
  return (
    <section className="legend" aria-label="Keterangan">
      <button type="button" className="legend-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>Keterangan</span>
        <span className="chevron">
          <ChevronIcon />
        </span>
      </button>
      {open && (
        <ul>
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
      )}
    </section>
  );
}
