import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { PHOTO_CREDITS } from "./credits";
import PhotoCredits from "./PhotoCredits";

test("every photograph is credited with its author and licence", () => {
  render(<PhotoCredits />);

  for (const credit of PHOTO_CREDITS) {
    const entry = screen.getByText(credit.subject, { exact: false }).closest("li")!;
    expect(entry).toHaveTextContent(credit.author);
    expect(entry).toHaveTextContent(credit.license);
  }
});

test("each credit links to where the photograph came from", () => {
  render(<PhotoCredits />);

  for (const credit of PHOTO_CREDITS) {
    expect(screen.getByRole("link", { name: new RegExp(credit.subject, "i") })).toHaveAttribute(
      "href",
      credit.source,
    );
  }
});
