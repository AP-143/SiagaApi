/** The label/value pairs a popup shows, e.g. { "Satelit": "S-NPP" }. */
export function popupFields(node: HTMLElement): Record<string, string> {
  const fields: Record<string, string> = {};
  node.querySelectorAll("dt").forEach((term) => {
    fields[term.textContent ?? ""] = term.nextElementSibling?.textContent ?? "";
  });
  return fields;
}
