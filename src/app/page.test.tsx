import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("landing page renders the product name", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "OriginLedger" }),
  ).toBeDefined();
});
