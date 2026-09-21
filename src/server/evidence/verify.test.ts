import { describe, expect, test } from "vitest";
import { GENESIS_PREVIOUS_HASH, hashEvidenceEvent } from "./canon";
import { verifyEvidenceChain, type EvidenceRecord } from "./verify";

async function event(
  sequence: number,
  previous_hash: string,
  overrides: Partial<EvidenceRecord> = {},
): Promise<EvidenceRecord> {
  const base = {
    sequence,
    organization_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    asset_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    event_type: "declaration_submitted",
    event_payload: { action: "submit", versionNumber: sequence },
    actor: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    timestamp: "2026-09-20T22:00:00.000Z",
    previous_hash,
    event_hash: "",
    ...overrides,
  };
  const event_hash = await hashEvidenceEvent({
    organization_id: base.organization_id,
    asset_id: base.asset_id,
    event_type: base.event_type,
    event_payload: base.event_payload,
    actor: base.actor,
    timestamp: base.timestamp,
    previous_hash: base.previous_hash,
  });
  return { ...base, event_hash };
}

describe("verifyEvidenceChain", () => {
  test("accepts a valid genesis chain", async () => {
    const first = await event(1, GENESIS_PREVIOUS_HASH);
    const second = await event(2, first.event_hash, {
      event_type: "review_approved",
      event_payload: { action: "approve" },
    });
    const result = await verifyEvidenceChain([second, first]);
    expect(result).toEqual({ ok: true, checked: 2 });
  });

  test("detects a tampered payload", async () => {
    const first = await event(1, GENESIS_PREVIOUS_HASH);
    const tampered = {
      ...first,
      event_payload: { action: "submit", extra: "nope" },
    };
    const result = await verifyEvidenceChain([tampered]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("hash");
      expect(result.brokenSequence).toBe(1);
    }
  });

  test("detects tampered actor, timestamp, type, or previous hash", async () => {
    const first = await event(1, GENESIS_PREVIOUS_HASH);
    const actor = await verifyEvidenceChain([
      { ...first, actor: "dddddddd-dddd-dddd-dddd-dddddddddddd" },
    ]);
    const timestamp = await verifyEvidenceChain([
      { ...first, timestamp: "2026-09-20T22:00:01.000Z" },
    ]);
    const type = await verifyEvidenceChain([
      { ...first, event_type: "review_rejected" },
    ]);
    const previous = await verifyEvidenceChain([
      { ...first, previous_hash: "1".repeat(64) },
    ]);
    expect(actor.ok).toBe(false);
    expect(timestamp.ok).toBe(false);
    expect(type.ok).toBe(false);
    expect(previous.ok).toBe(false);
    if (!previous.ok) {
      expect(previous.reason).toBe("genesis");
    }
  });

  test("detects missing, reordered sequence, and inserted events", async () => {
    const first = await event(1, GENESIS_PREVIOUS_HASH);
    const second = await event(2, first.event_hash);
    const missing = await verifyEvidenceChain([second]);
    const gap = await verifyEvidenceChain([first, { ...second, sequence: 3 }]);
    expect(missing.ok).toBe(false);
    expect(gap.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.reason).toBe("sequence");
    }
    if (!gap.ok) {
      expect(gap.reason).toBe("sequence");
    }
  });

  test("rejects a non-genesis first previous_hash", async () => {
    const first = await event(1, "a".repeat(64));
    const result = await verifyEvidenceChain([first]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("genesis");
    }
  });
});
