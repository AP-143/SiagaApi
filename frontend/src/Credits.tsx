import { InfoIcon } from "./icons";
import { isBarViewport } from "./viewport";

const CREDITS =
  "Titik api: NASA FIRMS (VIIRS). Batas wilayah: OCHA / BPS, COD-AB Indonesia (CC BY-IGO). Lahan gambut: Kementerian Pertanian (BBSDLP) melalui BIG Satu Peta. Citra satelit: NASA EOSDIS GIBS. Peta dasar: © OpenStreetMap contributors. Peta ditenagai MapLibre.";

/**
 * Credits that the data licenses ask for, including the base map's own attribution: the map's built-in
 * attribution button is switched off (see MapView), so this is the one place to look.
 * With the bar layout there is no room for the whole text
 * above the bottom bar, so it is folded behind a small "Sumber data" button; the text stays in the page.
 */
export default function Credits() {
  if (isBarViewport()) {
    return (
      <details className="credits credits-folded">
        <summary title="Sumber data">
          <InfoIcon />
          {/* Only the icon shows while folded; the name stays for screen readers and as a heading when open. */}
          <span className="credits-label">Sumber data</span>
        </summary>
        <p>{CREDITS}</p>
      </details>
    );
  }
  return <p className="credits">{CREDITS}</p>;
}
