import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import Credits from "./Credits";

function screenWidth(barLayout: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width: 1px") ? barLayout : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the credits are folded behind a small 'Sumber data' button", async () => {
  screenWidth(true);
  const { container } = render(<Credits />);
  const details = container.querySelector("details")!;

  expect(screen.getByText("Sumber data")).toBeInTheDocument();
  expect(details.open).toBe(false);

  await userEvent.click(screen.getByText("Sumber data"));

  expect(details.open).toBe(true);
});

test("the folded credits still hold every credit a licence asks for", () => {
  screenWidth(true);
  render(<Credits />);

  const text = screen.getByText(/NASA FIRMS/);
  for (const credit of ["OCHA", "BPS", "BBSDLP", "NASA EOSDIS GIBS", "OpenStreetMap", "MapLibre"]) {
    expect(text).toHaveTextContent(credit);
  }
});

test("without the bar layout the credits are plain text, with nothing to open", () => {
  screenWidth(false);
  const { container } = render(<Credits />);

  expect(container.querySelector("details")).toBeNull();
  expect(screen.queryByText("Sumber data")).toBeNull();
  expect(screen.getByText(/NASA FIRMS/)).toBeInTheDocument();
});

test("the button carries an icon, which is only decoration", () => {
  screenWidth(true);
  const { container } = render(<Credits />);

  const icon = container.querySelector("summary svg");
  expect(icon).not.toBeNull();
  expect(icon).toHaveAttribute("aria-hidden", "true");
});

test("the button is only an icon on screen, but keeps its name as a tooltip", () => {
  screenWidth(true);
  render(<Credits />);

  const summary = screen.getByText("Sumber data").closest("summary")!;
  expect(summary).toHaveAttribute("title", "Sumber data");
  expect(summary.querySelector("svg")).not.toBeNull();
});
