import { useCallback, useEffect, useState } from "react";

import { isBarViewport, isPhoneViewport } from "./viewport";

export type PanelName = "filter" | "layers" | "summary" | "legend" | "chat";

type OpenPanels = Record<PanelName, boolean>;

const ALL_CLOSED: OpenPanels = { filter: false, layers: false, summary: false, legend: false, chat: false };

/**
 * Which panels are open. In the bar layout (every real browser) panels are sheets above the bottom
 * bar: they start closed and opening one closes the others. Without it (a test environment with no
 * matchMedia) the data panels sit side by side and start open. The chat is always closed to begin
 * with: it is something you reach for, not something to look at.
 */
export function usePanels() {
  const [open, setOpen] = useState<OpenPanels>(() => {
    const startOpen = !isPhoneViewport() && !isBarViewport();
    return { filter: startOpen, layers: startOpen, summary: startOpen, legend: startOpen, chat: false };
  });

  function toggle(name: PanelName) {
    setOpen((current) => {
      if (!isPhoneViewport() && !isBarViewport()) return { ...current, [name]: !current[name] };
      return { ...ALL_CLOSED, [name]: !current[name] };
    });
  }

  /** After something is put on the map, a phone needs its panels out of the way to show it. */
  function closeOnPhone() {
    if (isPhoneViewport() || isBarViewport()) setOpen(ALL_CLOSED);
  }

  const closeAll = useCallback(() => setOpen(ALL_CLOSED), []);

  return { open, toggle, closeOnPhone, closeAll };
}

/**
 * On a wide screen a panel is a popover, so it closes the way a popover does: Escape (with focus
 * back on its button) or a press anywhere outside the bars. Pressing inside a popover keeps it open.
 */
export function useDismissPopovers(anyOpen: boolean, closeAll: () => void) {
  useEffect(() => {
    if (!anyOpen || !isBarViewport()) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const button = document.querySelector<HTMLElement>('.panel-toggle[aria-expanded="true"]');
      closeAll();
      button?.focus();
    };
    const onPress = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest?.(".overlay")) closeAll();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [anyOpen, closeAll]);
}
