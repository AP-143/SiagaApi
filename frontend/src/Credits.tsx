import { isPhoneViewport } from "./viewport";

const CREDITS =
  "Titik api: NASA FIRMS (VIIRS). Batas wilayah: OCHA / BPS, COD-AB Indonesia (CC BY-IGO). Lahan gambut: Kementerian Pertanian (BBSDLP) melalui BIG Satu Peta. Citra satelit: NASA EOSDIS GIBS.";

/**
 * Credits that the data licenses ask for. A phone has no room for the whole text above its bottom
 * bar, so there it is folded behind a small "Sumber data" button; the text stays in the page.
 */
export default function Credits() {
  if (isPhoneViewport()) {
    return (
      <details className="credits credits-folded">
        <summary>Sumber data</summary>
        <p>{CREDITS}</p>
      </details>
    );
  }
  return <p className="credits">{CREDITS}</p>;
}
