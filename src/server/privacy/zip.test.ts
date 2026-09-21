import { describe, expect, test } from "vitest";
import { buildZipArchive } from "./zip";

describe("zip archives", () => {
  test("produces a zip signature and includes file names", () => {
    const archive = buildZipArchive([
      { name: "manifest.json", data: new TextEncoder().encode('{"ok":true}') },
      {
        name: "tables/organizations.json",
        data: new TextEncoder().encode("[]"),
      },
    ]);
    expect(archive[0]).toBe(0x50);
    expect(archive[1]).toBe(0x4b);
    const asText = new TextDecoder().decode(archive);
    expect(asText).toContain("manifest.json");
    expect(asText).toContain("tables/organizations.json");
  });
});
