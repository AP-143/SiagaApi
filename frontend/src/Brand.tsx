import LogoMark from "./LogoMark";
import SplitText from "./landing/SplitText";

/** The name of the map. It leads back to the Landing. */
export default function Brand() {
  return (
    <header className="card brand">
      <a className="brand-home" href="/" aria-label="Kembali ke beranda SiagaApi">
        <span className="brand-mark">
          <LogoMark />
        </span>
        <div className="brand-text">
          <h1 translate="no">
            <SplitText text="SiagaApi" as="span" on="load" stagger={0.06} delay={0.15} rise={0.4} tilt={0} duration={0.7} />
          </h1>
          <p>Pantau titik api Kalimantan</p>
        </div>
      </a>
    </header>
  );
}
