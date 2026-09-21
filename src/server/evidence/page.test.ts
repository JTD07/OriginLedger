import { describe, expect, test } from "vitest";
import { EVIDENCE_PAGE_SIZE, evidencePageRange } from "./page";

describe("evidence timeline pagination", () => {
  test("uses a 20-event page and deterministic offsets", () => {
    expect(EVIDENCE_PAGE_SIZE).toBe(20);
    expect(evidencePageRange(1)).toEqual({ page: 1, from: 0, to: 19 });
    expect(evidencePageRange(2)).toEqual({ page: 2, from: 20, to: 39 });
  });

  test("treats missing or invalid pages as page 1", () => {
    expect(evidencePageRange(0).page).toBe(1);
    expect(evidencePageRange(-2).page).toBe(1);
    expect(evidencePageRange(1.5).page).toBe(1);
  });
});
