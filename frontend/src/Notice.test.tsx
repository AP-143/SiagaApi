import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import Credits from "./Credits";
import Landing from "./landing/Landing";
import { FIRMS_URL } from "./notice";

test("the Landing ends with a notice: unofficial, who to call, and a link to where the data comes from", () => {
  render(<Landing />);

  const notice = screen.getByText(/proyek tidak resmi/i);
  expect(notice).toHaveTextContent(/BPBD setempat atau BNPB/);
  expect(screen.getByRole("link", { name: "NASA FIRMS" })).toHaveAttribute("href", FIRMS_URL);
});

test("the map's credits carry the same notice", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));

  render(<Credits />);

  expect(screen.getByText(/proyek tidak resmi/i)).toHaveTextContent(/BPBD setempat atau BNPB/);
  vi.unstubAllGlobals();
});
