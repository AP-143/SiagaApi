import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "siagaapi-theme";

function storedTheme(): Theme | null {
  // Storage can be missing or blocked (private windows, cleared site data), so never rely on it.
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Let the colours cross-fade for a moment, so switching theme never flashes. */
function fadeColours() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.documentElement;
  root.classList.add("theme-fade");
  window.setTimeout(() => root.classList.remove("theme-fade"), 400);
}

/** The page theme: a remembered choice if there is one, otherwise whatever the system uses. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    fadeColours();
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }

  return { theme, toggle };
}
