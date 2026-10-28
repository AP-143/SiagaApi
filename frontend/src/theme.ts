import { useEffect } from "react";

/**
 * The map is dark only: the dark basemap lets Hotspots stand out, and one look is easier to keep
 * readable than two. (The Landing is a separate page with its own paper look.)
 */
export function useDarkTheme() {
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);
}
