import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import Credits from "./Credits";

function screenWidth(phone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width: 640px") ? phone : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("on a phone the credits are folded behind a small 'Sumber data' button", async () => {
  screenWidth(true);
  const { container } = render(<Credits />);
  const details = container.querySelector("details")!;

  expect(screen.getByText("Sumber data")).toBeInTheDocument();
  expect(details.open).toBe(false);

  await userEvent.click(screen.getByText("Sumber data"));

  expect(details.open).toBe(true);
});

test("on a phone the folded credits still hold every credit a licence asks for", () => {
  screenWidth(true);
  render(<Credits />);

  const text = screen.getByText(/NASA FIRMS/);
  for (const credit of ["OCHA", "BPS", "BBSDLP", "NASA EOSDIS GIBS"]) {
    expect(text).toHaveTextContent(credit);
  }
});

test("on a bigger screen the credits are plain text, with nothing to open", () => {
  screenWidth(false);
  const { container } = render(<Credits />);

  expect(container.querySelector("details")).toBeNull();
  expect(screen.queryByText("Sumber data")).toBeNull();
  expect(screen.getByText(/NASA FIRMS/)).toBeInTheDocument();
});
