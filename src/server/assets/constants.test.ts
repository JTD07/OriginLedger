import { describe, expect, test } from "vitest";
import {
  MAX_ASSET_BYTES,
  declaredUploadSizeError,
  sanitizeClientFilename,
  storageKeyFor,
} from "./constants";

describe("asset path helpers", () => {
  test("builds storage keys from server UUIDs only", () => {
    expect(
      storageKeyFor({
        organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        projectId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        assetId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      }),
    ).toBe(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/cccccccc-cccc-cccc-cccc-cccccccccccc",
    );
  });

  test("strips path characters from client filenames", () => {
    expect(sanitizeClientFilename("../secret.pdf")).toBe("..secret.pdf");
    expect(sanitizeClientFilename("C:\\\\temp\\\\file.png")).toBe(
      "C:tempfile.png",
    );
    expect(sanitizeClientFilename('lot"\r\n.png')).toBe("lot.png");
  });

  test("refuses oversized declared sizes before issuing a URL", () => {
    expect(declaredUploadSizeError(MAX_ASSET_BYTES + 1)).toBe("too_large");
    expect(declaredUploadSizeError(0)).toBe("too_large");
    expect(declaredUploadSizeError(MAX_ASSET_BYTES)).toBeNull();
  });
});
