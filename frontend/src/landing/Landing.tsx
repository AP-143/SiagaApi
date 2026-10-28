import "./landing.css";

export default function Landing() {
  return (
    // Always the light paper look, whatever theme the map was last left in.
    <main className="landing" data-theme="light" aria-label="Beranda SiagaApi">
      <a href="/peta">Buka peta</a>
    </main>
  );
}
