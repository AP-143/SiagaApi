import { type RefObject, useEffect } from "react";

/**
 * Keeps `--status-h` on the page as tall as the status pills ("Terakhir diperbarui" and any warning
 * or note beside it), so the rail of icons can sit just under them whatever their height.
 */
export function useStatusHeight(page: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = page.current;
    const bar = root?.querySelector<HTMLElement>(".status-bar");
    if (!root || !bar || typeof ResizeObserver === "undefined") return;
    const apply = () => root.style.setProperty("--status-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [page]);
}
