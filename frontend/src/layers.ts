import { useEffect, useRef, useState } from "react";

import { type LayerCollection, fetchLayer } from "./api";
import { LAYER_NAMES, type LayerName } from "./view";

export type LayerData = Partial<Record<LayerName, LayerCollection>>;

/**
 * Downloads each map layer the first time it is switched on, and keeps it for the rest of the
 * visit. A layer that failed is retried when it is switched off and on again.
 */
export function useLayerData(enabled: Record<LayerName, boolean>) {
  const [data, setData] = useState<LayerData>({});
  const [failed, setFailed] = useState<LayerName[]>([]);
  const started = useRef(new Set<LayerName>());

  useEffect(() => {
    for (const name of LAYER_NAMES) {
      if (!enabled[name] || started.current.has(name)) continue;
      started.current.add(name);
      fetchLayer(name).then(
        (collection) => {
          setData((current) => ({ ...current, [name]: collection }));
          setFailed((current) => current.filter((n) => n !== name));
        },
        () => {
          started.current.delete(name); // allow a retry
          setFailed((current) => (current.includes(name) ? current : [...current, name]));
        },
      );
    }
  }, [enabled]);

  // A layer that is switched off has nothing to complain about.
  return { data, failed: failed.filter((name) => enabled[name]) };
}
