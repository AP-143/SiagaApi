import { useEffect } from "react";

import Hero from "./Hero";
import PhotoCredits from "./PhotoCredits";
import QuickFacts from "./QuickFacts";
import Statement from "./Statement";
import "./landing.css";

export default function Landing() {
  // The browser's own bar takes the paper colour while the Landing is open, whatever the system theme.
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const before = metas.map((meta) => meta.content);
    for (const meta of metas) meta.content = "#ece3d1";
    return () => metas.forEach((meta, i) => (meta.content = before[i]));
  }, []);

  return (
    // Always the light paper look, whatever theme the map was last left in.
    <main className="landing" data-theme="light" aria-label="Beranda SiagaApi">
      <Hero />
      <Statement />
      <QuickFacts />
      <PhotoCredits />
    </main>
  );
}
