import type { Confidence, Hotspot } from "../api";
import { formatInZone } from "./time";

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: "Rendah",
  nominal: "Sedang",
  high: "Tinggi",
};

// Kalimantan Barat and Tengah use WIB (UTC+7); the other three Provinces use WITA (UTC+8).
const WIB_PROVINCES = new Set(["ID61", "ID62"]);

/** The detection time in the Hotspot's own local time zone. */
export function formatDetectionTime(isoUtc: string, provinceCode: string): string {
  return formatInZone(isoUtc, WIB_PROVINCES.has(provinceCode) ? "WIB" : "WITA");
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Popup content built from DOM nodes (never HTML strings), so data can't inject markup. */
export function buildHotspotPopup(hotspot: Hotspot): HTMLElement {
  const { acquired_at, satellite, confidence, province, regency, peat_hotspot } =
    hotspot.properties;

  const root = element("div", "hotspot-popup");

  const header = element("header");
  header.append(element("strong", "popup-title", "Titik api"));
  header.append(element("span", `chip chip-confidence-${confidence}`, CONFIDENCE_LABELS[confidence]));
  if (peat_hotspot) header.append(element("span", "chip chip-peat", "Di lahan gambut"));
  root.append(header);

  const rows: Array<[string, string]> = [
    ["Waktu deteksi", formatDetectionTime(acquired_at, province.code)],
    ["Satelit", satellite],
    ["Kepercayaan", CONFIDENCE_LABELS[confidence]],
    ["Lahan gambut", peat_hotspot ? "Ya" : "Tidak"],
    ["Kabupaten/Kota", regency?.name ?? "Tidak diketahui"],
    ["Provinsi", province.name],
  ];
  const list = element("dl");
  for (const [label, value] of rows) {
    list.append(element("dt", undefined, label), element("dd", undefined, value));
  }
  root.append(list);
  return root;
}
