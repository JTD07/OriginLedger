import { describe, expect, test } from "vitest";
import { buildOrganizationExport, sanitizeExportRow } from "./export-builder";
import { ORGANIZATION_EXPORT_SCHEMA_VERSION } from "./constants";

describe("organization export schema", () => {
  test("omits secrets, tokens, signed URLs, storage paths, and raw prompts by default", () => {
    const row = sanitizeExportRow(
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        storage_key: "org/project/asset",
        token_hash: "abc",
        public_token: "visible-token",
        raw_prompt: "secret prompt",
        name: "Org",
      },
      false,
    );
    expect(row).toEqual({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Org",
    });
  });

  test("includes raw prompts only when requested and checksums the archive", async () => {
    const built = await buildOrganizationExport({
      organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      generatedAt: "2026-09-21T12:00:00.000Z",
      includeRawPrompts: true,
      tables: {
        provenance_declaration_versions: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            raw_prompt: "keep this prompt",
            storage_key: "should-omit",
          },
        ],
      },
      objects: [
        {
          bucket: "origin-assets",
          objectId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          bytes: new Uint8Array([1, 2, 3, 4]),
          contentType: "image/png",
        },
      ],
    });
    expect(built.manifest.schemaVersion).toBe(
      ORGANIZATION_EXPORT_SCHEMA_VERSION,
    );
    expect(built.manifest.includeRawPrompts).toBe(true);
    expect(built.manifest.checksums.archiveSha256).toBe(built.archiveSha256);
    expect(built.manifest.objects[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(built.manifest)).not.toContain("should-omit");
    expect(JSON.stringify(built.manifest.omitted)).toContain("operationalJobs");
    const asText = new TextDecoder().decode(built.archive);
    expect(asText).toContain("keep this prompt");
    expect(asText).not.toContain("should-omit");
  });
});
