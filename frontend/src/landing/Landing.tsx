import Hero from "./Hero";
import PhotoCredits from "./PhotoCredits";
import QuickFacts from "./QuickFacts";
import Statement from "./Statement";
import "./landing.css";

export default function Landing() {
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
