import type { Filters } from "./filters";

export type Confidence = "low" | "nominal" | "high";

export type Hotspot = GeoJSON.Feature<
  GeoJSON.Point,
  {
    id: number;
    acquired_at: string;
    satellite: string;
    confidence: Confidence;
    province: { code: string; name: string };
    regency: { code: string; name: string } | null;
    peat_hotspot: boolean;
  }
>;

export type HotspotCollection = GeoJSON.FeatureCollection<GeoJSON.Point, Hotspot["properties"]> & {
  features: Hotspot[];
};

export type Area = { code: string; name: string };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error(`Request for ${path} failed with status ${response.status}`);
  return response.json();
}

/** The query string shared by the Hotspot list and the per-Regency counts. */
function filterQuery(filters: Filters): URLSearchParams {
  const params = new URLSearchParams({ window: filters.window });
  if (filters.province) params.set("province", filters.province);
  if (filters.province && filters.regency) params.set("regency", filters.regency);
  // Without min_confidence the server hides low-Confidence Hotspots by default.
  if (filters.showLowConfidence) params.set("min_confidence", "low");
  if (filters.peatOnly) params.set("peat_only", "true");
  return params;
}

export function fetchProvinces(): Promise<Area[]> {
  return getJson("/provinces");
}

export function fetchRegencies(provinceCode: string): Promise<Area[]> {
  return getJson(`/provinces/${encodeURIComponent(provinceCode)}/regencies`);
}

export function fetchHotspots(filters: Filters): Promise<HotspotCollection> {
  return getJson(`/hotspots?${filterQuery(filters)}`);
}

export type RegencyCount = { regency: Area | null; province: Area; count: number };

export function fetchRegencyCounts(filters: Filters): Promise<RegencyCount[]> {
  return getJson(`/hotspots/counts?${filterQuery(filters)}`);
}

export type Freshness = { last_updated: string | null; stale: boolean };

export function fetchFreshness(): Promise<Freshness> {
  return getJson("/freshness");
}

export type LayerCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export function fetchLayer(name: "provinces" | "regencies" | "peatlands"): Promise<LayerCollection> {
  return getJson(`/layers/${name}`);
}

export type ChatReply = {
  kind: string;
  answer: string;
  data: {
    suggestions?: string[];
    candidates?: Array<{ name: string }>;
    /** Where a quoted answer comes from; `url` is null for our own documentation. */
    sources?: Array<{ title?: string; source?: string; url?: string | null }>;
    /** Headings of other passages that also fit the question. */
    related?: string[];
  } & Record<string, unknown>;
};

/** The chat could not be answered: `status` is 0 for a network failure. */
export class ChatError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(`Chat request failed (${status})`);
  }
}

export async function sendChat(message: string): Promise<ChatReply> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch {
    throw new ChatError(0);
  }
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ChatError(response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
  }
  try {
    return await response.json();
  } catch {
    throw new ChatError(response.status);
  }
}
