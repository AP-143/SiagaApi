import { Suspense, lazy } from "react";

import { pathInSite } from "./base";
import Landing from "./landing/Landing";

// The map is its own chunk so the Landing never downloads MapLibre.
const App = lazy(() => import("./App"));

/** The map answers at /peta, and at / when the address carries filters (links shared earlier). */
function showsMap({ pathname, search }: Pick<Location, "pathname" | "search">) {
  const path = pathInSite(pathname);
  return path === "/peta" || (path === "/" && search.length > 1);
}

export default function Root() {
  if (!showsMap(window.location)) return <Landing />;
  return (
    <Suspense fallback={<p role="status" className="map-loading">Memuat peta…</p>}>
      <App />
    </Suspense>
  );
}
