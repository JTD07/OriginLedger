import { describe, expect, test } from "vitest";
import { MAX_ASSET_BYTES, declaredUploadSizeError } from "./constants";

describe("createUploadSession size gate", () => {
  test("refuses oversized declared sizes before issuing a URL", () => {
    expect(declaredUploadSizeError(MAX_ASSET_BYTES + 1)).toBe("too_large");
    expect(declaredUploadSizeError(1.5)).toBe("too_large");
    expect(declaredUploadSizeError(MAX_ASSET_BYTES)).toBeNull();
  });
});
