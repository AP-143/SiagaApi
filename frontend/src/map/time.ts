export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type Zone = "WIB" | "WITA";

const IANA_ZONES: Record<Zone, string> = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar" };

/** "16 Okt 2026, 12.40 WIB": a UTC instant shown in an Indonesian time zone. */
export function formatInZone(isoUtc: string, zone: Zone): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IANA_ZONES[zone],
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoUtc));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const month = MONTHS[Number(part("month")) - 1];
  return `${Number(part("day"))} ${month} ${part("year")}, ${part("hour")}.${part("minute")} ${zone}`;
}
