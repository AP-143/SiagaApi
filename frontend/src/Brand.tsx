import { MoonIcon, SunIcon } from "./icons";
import LogoMark from "./LogoMark";
import SplitText from "./landing/SplitText";
import type { Theme } from "./theme";

type Props = { theme: Theme; onToggleTheme: () => void };

export default function Brand({ theme, onToggleTheme }: Props) {
  const next = theme === "dark" ? "terang" : "gelap";
  return (
    <header className="card brand">
      <span className="brand-mark">
        <LogoMark />
      </span>
      <div className="brand-text">
        <h1 translate="no">
          <SplitText text="SiagaApi" as="span" on="load" stagger={0.06} delay={0.15} rise={0.4} tilt={0} duration={0.7} />
        </h1>
        <p>Pantau titik api Kalimantan</p>
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label={`Ganti ke tema ${next}`}
        onClick={onToggleTheme}
      >
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}
