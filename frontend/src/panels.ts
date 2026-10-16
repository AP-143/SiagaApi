import { useState } from "react";

import { isPhoneViewport } from "./viewport";

export type PanelName = "filter" | "layers" | "summary" | "chat";

type OpenPanels = Record<PanelName, boolean>;

const ALL_CLOSED: OpenPanels = { filter: false, layers: false, summary: false, chat: false };

/**
 * Which panels are open. Wide screens have room for the data panels; on a phone they would cover
 * each other and the map, so panels start closed and opening one closes the others. The chat is
 * always closed to begin with: it is something you reach for, not something to look at.
 */
export function usePanels() {
  const [open, setOpen] = useState<OpenPanels>(() => {
    const startOpen = !isPhoneViewport();
    return { filter: startOpen, layers: startOpen, summary: startOpen, chat: false };
  });

  function toggle(name: PanelName) {
    setOpen((current) => {
      if (!isPhoneViewport()) return { ...current, [name]: !current[name] };
      return { ...ALL_CLOSED, [name]: !current[name] };
    });
  }

  /** After something is put on the map, a phone needs its panels out of the way to show it. */
  function closeOnPhone() {
    if (isPhoneViewport()) setOpen(ALL_CLOSED);
  }

  return { open, toggle, closeOnPhone };
}
