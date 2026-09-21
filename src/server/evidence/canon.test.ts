import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  CANONICALIZATION_VERSION,
  CanonicalizationError,
  GENESIS_PREVIOUS_HASH,
  HASH_VERSION,
  canonicalEvidenceBytes,
  canonicalize,
  formatEvidenceTimestamp,
  hashEvidenceEvent,
} from "./canon";

const VECTOR_INPUT = {
  organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  asset_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  event_type: "declaration_submitted",
  event_payload: {
    notes: "",
    action: "submit",
    toStatus: "pending_review",
    fromStatus: "draft",
    versionNumber: 1,
  },
  actor: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  timestamp: "2026-09-20T22:00:00.000Z",
  previous_hash: GENESIS_PREVIOUS_HASH,
};

describe("canon-json.v1", () => {
  test("sorts object keys and ignores insertion order", () => {
    const first = canonicalize({ b: 1, a: 2 });
    const second = canonicalize({ a: 2, b: 1 });
    expect(first).toBe('{"a":2,"b":1}');
    expect(first).toBe(second);
  });

  test("preserves array order and encodes null", () => {
    expect(canonicalize(["b", null, "a"])).toBe('["b",null,"a"]');
  });

  test("treats omitted keys as absent, not null", () => {
    expect(canonicalize({ a: 1 })).toBe('{"a":1}');
    expect(canonicalize({ a: 1, b: null })).toBe('{"a":1,"b":null}');
  });

  test("encodes unicode and JSON-escapes strings", () => {
    expect(canonicalize("café")).toBe(JSON.stringify("café"));
    expect(canonicalize("line\nbreak")).toBe('"line\\nbreak"');
    expect(canonicalize('quote"')).toBe('"quote\\""');
  });

  test("encodes safe integers and rejects floats", () => {
    expect(canonicalize(0)).toBe("0");
    expect(canonicalize(-2)).toBe("-2");
    expect(() => canonicalize(1.5)).toThrow(CanonicalizationError);
    expect(() => canonicalize(Number.NaN)).toThrow(CanonicalizationError);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(
      CanonicalizationError,
    );
  });

  test("formats timestamps as UTC milliseconds", () => {
    expect(formatEvidenceTimestamp(new Date("2026-09-20T22:00:00.000Z"))).toBe(
      "2026-09-20T22:00:00.000Z",
    );
  });

  test("stable evidence hash vector", async () => {
    const canonical = canonicalEvidenceBytes(VECTOR_INPUT);
    const expectedCanonical =
      '{"actor":"cccccccc-cccc-cccc-cccc-cccccccccccc","asset_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","event_payload":{"action":"submit","fromStatus":"draft","notes":"","toStatus":"pending_review","versionNumber":1},"event_type":"declaration_submitted","organization_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","previous_hash":"0000000000000000000000000000000000000000000000000000000000000000","timestamp":"2026-09-20T22:00:00.000Z"}';
    expect(canonical).toBe(expectedCanonical);
    const hash = await hashEvidenceEvent(VECTOR_INPUT);
    const nodeHash = createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex");
    expect(hash).toBe(nodeHash);
    expect(hash).toBe(
      "917a223b28454a9db94046b37904687f8d5536dfd132642a9ac6318ea03b48c4",
    );
    expect(CANONICALIZATION_VERSION).toBe("canon-json.v1");
    expect(HASH_VERSION).toBe("sha256-hex.v1");
  });

  test("equivalent payloads with different key order hash the same", async () => {
    const reordered = {
      ...VECTOR_INPUT,
      event_payload: {
        versionNumber: 1,
        fromStatus: "draft",
        action: "submit",
        toStatus: "pending_review",
        notes: "",
      },
    };
    expect(await hashEvidenceEvent(VECTOR_INPUT)).toBe(
      await hashEvidenceEvent(reordered),
    );
  });
});
