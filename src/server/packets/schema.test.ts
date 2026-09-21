import { describe, expect, it } from "vitest";
import { eventsThroughHead } from "./answers";
import { packetAnswersFromDraft } from "./answers";
import { EVIDENCE_PACKET_V1_FIXTURE } from "./fixture";
import { parseEvidencePacketJson, serializeEvidencePacketJson } from "./json";
import {
  EVIDENCE_PACKET_SCHEMA_VERSION,
  evidencePacketV1Schema,
  validateEvidencePacketV1,
} from "./schema";
import { sha256HexBytes } from "./hash";
import {
  emptyDraft,
  type DeclarationDraft,
} from "@/server/declarations/schema";

describe("evidence-packet.v1 schema", () => {
  it("accepts the stable v1 fixture", () => {
    const parsed = validateEvidencePacketV1(EVIDENCE_PACKET_V1_FIXTURE);
    expect(parsed.schemaVersion).toBe(EVIDENCE_PACKET_SCHEMA_VERSION);
    expect(parsed.includesRawPrompt).toBe(false);
    expect(parsed.declaration.answers.rawPrompt).toBeNull();
    expect(parsed.disclaimer.isCertification).toBe(false);
    expect(parsed.evidence.events.map((event) => event.sequence)).toEqual([
      1, 2,
    ]);
  });

  it("rejects a missing required field", () => {
    const broken = { ...EVIDENCE_PACKET_V1_FIXTURE };
    delete (broken as { generatedAt?: string }).generatedAt;
    expect(evidencePacketV1Schema.safeParse(broken).success).toBe(false);
  });

  it("rejects a silent schema version change", () => {
    expect(
      evidencePacketV1Schema.safeParse({
        ...EVIDENCE_PACKET_V1_FIXTURE,
        schemaVersion: "evidence-packet.v2",
      }).success,
    ).toBe(false);
  });

  it("rejects localized display strings as machine-readable values", () => {
    expect(
      evidencePacketV1Schema.safeParse({
        ...EVIDENCE_PACKET_V1_FIXTURE,
        assessment: {
          ...EVIDENCE_PACKET_V1_FIXTURE.assessment,
          recommendationLevel: "Limited disclosure recommended",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects a raw prompt when includesRawPrompt is false", () => {
    expect(
      evidencePacketV1Schema.safeParse({
        ...EVIDENCE_PACKET_V1_FIXTURE,
        includesRawPrompt: false,
        declaration: {
          ...EVIDENCE_PACKET_V1_FIXTURE.declaration,
          answers: {
            ...EVIDENCE_PACKET_V1_FIXTURE.declaration.answers,
            rawPrompt: "secret prompt",
          },
        },
      }).success,
    ).toBe(false);
  });

  it("round-trips JSON and keeps chronological event order", async () => {
    const bytes = serializeEvidencePacketJson(EVIDENCE_PACKET_V1_FIXTURE);
    const parsed = parseEvidencePacketJson(bytes);
    expect(parsed.evidence.events.map((event) => event.eventType)).toEqual([
      "declaration_submitted",
      "review_approved",
    ]);
    expect(await sha256HexBytes(bytes)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps history only through the recorded chain head", () => {
    const later = {
      sequence: 3,
      eventType: "later",
    };
    expect(
      eventsThroughHead(
        [...EVIDENCE_PACKET_V1_FIXTURE.evidence.events, later],
        2,
      ).map((event) => event.sequence),
    ).toEqual([1, 2]);
  });

  it("omits raw prompts unless the exporter opted in for this export", () => {
    const draft: DeclarationDraft = {
      ...emptyDraft(),
      creationMode: "ai_generated",
      rawPromptCaptureEnabled: true,
      rawPrompt: "sensitive prompt text",
      humanEdits: "none",
      distributionRegions: ["us"],
      contentCategory: "other",
      realisticDepiction: "unknown",
      publicInterest: "none",
      editorialReview: "not_reviewed",
    };
    expect(packetAnswersFromDraft(draft, false).rawPrompt).toBeNull();
    expect(packetAnswersFromDraft(draft, true).rawPrompt).toBe(
      "sensitive prompt text",
    );
  });
});
