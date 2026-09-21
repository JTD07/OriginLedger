import { GENESIS_PREVIOUS_HASH, hashEvidenceEvent } from "./canon";

export type EvidenceRecord = {
  sequence: number;
  organization_id: string;
  asset_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  actor: string;
  timestamp: string;
  previous_hash: string;
  event_hash: string;
};

export type ChainVerification =
  | { ok: true; checked: number }
  | {
      ok: false;
      checked: number;
      brokenSequence: number | null;
      reason:
        | "empty"
        | "genesis"
        | "sequence"
        | "link"
        | "hash"
        | "identity"
        | "canonicalization";
    };

const MAX_EVENTS = 10_000;

export async function verifyEvidenceChain(
  events: EvidenceRecord[],
): Promise<ChainVerification> {
  if (events.length === 0) {
    return { ok: false, checked: 0, brokenSequence: null, reason: "empty" };
  }
  if (events.length > MAX_EVENTS) {
    return {
      ok: false,
      checked: 0,
      brokenSequence: events[0]?.sequence ?? null,
      reason: "sequence",
    };
  }

  const ordered = [...events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const assetId = ordered[0].asset_id;
  const organizationId = ordered[0].organization_id;

  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index];
    if (
      event.asset_id !== assetId ||
      event.organization_id !== organizationId
    ) {
      return {
        ok: false,
        checked: index,
        brokenSequence: event.sequence,
        reason: "identity",
      };
    }
    if (event.sequence !== index + 1) {
      return {
        ok: false,
        checked: index,
        brokenSequence: event.sequence,
        reason: "sequence",
      };
    }
    const expectedPrevious =
      index === 0 ? GENESIS_PREVIOUS_HASH : ordered[index - 1].event_hash;
    if (event.previous_hash !== expectedPrevious) {
      return {
        ok: false,
        checked: index,
        brokenSequence: event.sequence,
        reason: index === 0 ? "genesis" : "link",
      };
    }
    try {
      const recomputed = await hashEvidenceEvent({
        organization_id: event.organization_id,
        asset_id: event.asset_id,
        event_type: event.event_type,
        event_payload: event.event_payload,
        actor: event.actor,
        timestamp: event.timestamp,
        previous_hash: event.previous_hash,
      });
      if (recomputed !== event.event_hash) {
        return {
          ok: false,
          checked: index,
          brokenSequence: event.sequence,
          reason: "hash",
        };
      }
    } catch {
      return {
        ok: false,
        checked: index,
        brokenSequence: event.sequence,
        reason: "canonicalization",
      };
    }
  }

  return { ok: true, checked: ordered.length };
}
