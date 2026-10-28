import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, test } from "vitest";

import RegencyPanel from "./RegencyPanel";
import { installReducedMotion, setReducedMotion } from "./test/reducedMotion";

beforeAll(installReducedMotion);

const KALBAR = { code: "ID61", name: "Kalimantan Barat" };
const COUNTS = [
  { regency: { code: "ID6101", name: "Sambas" }, province: KALBAR, count: 12 },
  { regency: { code: "ID6102", name: "Bengkayang" }, province: KALBAR, count: 3 },
];

const rowOf = (name: string) => screen.getByText(name).closest("li")!;

test("when the panel is opened the rows fade in one after another", async () => {
  setReducedMotion(false);
  const { rerender } = render(<RegencyPanel counts={COUNTS} failed={false} open={false} onToggle={() => {}} />);
  rerender(<RegencyPanel counts={COUNTS} failed={false} open onToggle={() => {}} />);

  expect(rowOf("Bengkayang")).not.toBeVisible();
  await waitFor(() => expect(rowOf("Sambas")).toBeVisible());
  await waitFor(() => expect(rowOf("Bengkayang")).toBeVisible());
});

test("with reduced motion every row is there at once", () => {
  setReducedMotion(true);
  render(<RegencyPanel counts={COUNTS} failed={false} open onToggle={() => {}} />);

  expect(rowOf("Sambas")).toBeVisible();
  expect(rowOf("Bengkayang")).toBeVisible();
});
