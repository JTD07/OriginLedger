import { z } from "zod";
import {
  CONTENT_CATEGORIES,
  CREATION_MODES,
  DISTRIBUTION_REGIONS,
  EDITORIAL_REVIEW_STATUSES,
  HUMAN_EDITS,
  PUBLIC_INTEREST_STATUSES,
  REALISTIC_DEPICTIONS,
} from "@/server/declarations/schema";
import { DECLARATION_VERSION_STATUSES } from "@/server/review/transitions";
import {
  EVIDENCE_PACKET_SCHEMA_VERSION,
  PACKET_DISCLAIMER,
} from "./disclaimer";

export { EVIDENCE_PACKET_SCHEMA_VERSION, PACKET_DISCLAIMER };

export const PACKET_RECOMMENDATION_LEVELS = [
  "none",
  "limited",
  "prominent",
] as const;

export const PACKET_ASSESSMENT_STATUSES = [
  "current",
  "superseded",
  "invalidated",
] as const;

export const PACKET_REVIEW_DECISIONS = [
  "accepted",
  "returned",
  "rejected",
] as const;

export const PACKET_VERIFICATION_REASONS = [
  "ok",
  "empty",
  "genesis",
  "sequence",
  "link",
  "hash",
  "identity",
  "canonicalization",
] as const;

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const isoTimestamp = z.string().min(1);

export const packetDisclaimerSchema = z
  .object({
    recordsSuppliedInformation: z.literal(true),
    isCertification: z.literal(false),
    independentlyProvesClaims: z.literal(false),
    isBlockchain: z.literal(false),
    isAbsolutelyTamperProof: z.literal(false),
    replacesLegalReview: z.literal(false),
    text: z.string().min(1),
  })
  .strict();

export const packetAnswersSchema = z
  .object({
    creationMode: z.enum(CREATION_MODES).nullable(),
    provider: z.string().nullable(),
    model: z.string().nullable(),
    modelVersion: z.string().nullable(),
    generationDate: z.string().nullable(),
    sourceNotes: z.string().nullable(),
    promptSummary: z.string().nullable(),
    rawPrompt: z.string().nullable(),
    humanEdits: z.enum(HUMAN_EDITS).nullable(),
    distributionRegions: z.array(z.enum(DISTRIBUTION_REGIONS)),
    contentCategory: z.enum(CONTENT_CATEGORIES).nullable(),
    realisticDepiction: z.enum(REALISTIC_DEPICTIONS).nullable(),
    publicInterest: z.enum(PUBLIC_INTEREST_STATUSES).nullable(),
    editorialReview: z.enum(EDITORIAL_REVIEW_STATUSES).nullable(),
  })
  .strict();

export const packetAssessmentSchema = z
  .object({
    rulesetVersion: z.string().min(1),
    recommendationLevel: z.enum(PACKET_RECOMMENDATION_LEVELS),
    reasonCodes: z.array(z.string().min(1)),
    templateId: z.string().min(1),
    visibleDisclosureText: z.string().min(1),
    humanReviewNotice: z.string().min(1),
    status: z.enum(PACKET_ASSESSMENT_STATUSES),
  })
  .strict();

export const packetReviewSchema = z
  .object({
    decision: z.enum(PACKET_REVIEW_DECISIONS),
    reviewerId: z.uuid(),
    reviewedAt: isoTimestamp,
    notes: z.string().nullable(),
  })
  .strict();

export const packetChainHeadSchema = z
  .object({
    eventId: z.uuid(),
    eventHash: sha256Hex,
    sequence: z.number().int().positive(),
  })
  .strict();

export const packetVerificationSchema = z
  .object({
    ok: z.boolean(),
    checked: z.number().int().nonnegative(),
    brokenSequence: z.number().int().positive().nullable(),
    reason: z.enum(PACKET_VERIFICATION_REASONS),
  })
  .strict();

export const packetEvidenceEventSchema = z
  .object({
    eventId: z.uuid(),
    sequence: z.number().int().positive(),
    eventType: z.string().min(1),
    eventAt: isoTimestamp,
    actor: z.string().min(1),
    eventHash: sha256Hex,
    previousHash: sha256Hex,
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export const evidencePacketV1Schema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PACKET_SCHEMA_VERSION),
    generatedAt: isoTimestamp,
    includesRawPrompt: z.boolean(),
    disclaimer: packetDisclaimerSchema,
    organization: z
      .object({
        id: z.uuid(),
        name: z.string().min(1),
      })
      .strict(),
    project: z
      .object({
        id: z.uuid(),
        name: z.string().min(1),
      })
      .strict(),
    client: z
      .object({
        organizationId: z.uuid(),
        organizationName: z.string().min(1),
      })
      .strict(),
    asset: z
      .object({
        id: z.uuid(),
        clientFilename: z.string().nullable(),
        verifiedMimeType: z.string().nullable(),
        byteSize: z.number().int().nonnegative().nullable(),
        sha256: z.string().nullable(),
        status: z.string().min(1),
      })
      .strict(),
    declaration: z
      .object({
        id: z.uuid(),
        versionId: z.uuid(),
        versionNumber: z.number().int().positive(),
        status: z.enum(DECLARATION_VERSION_STATUSES),
        answers: packetAnswersSchema,
      })
      .strict(),
    assessment: packetAssessmentSchema.nullable(),
    review: packetReviewSchema.nullable(),
    evidence: z
      .object({
        chainHead: packetChainHeadSchema.nullable(),
        verification: packetVerificationSchema,
        events: z.array(packetEvidenceEventSchema),
      })
      .strict(),
  })
  .strict()
  .superRefine((packet, ctx) => {
    if (
      packet.includesRawPrompt &&
      packet.declaration.answers.rawPrompt === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["includesRawPrompt"],
        message: "includesRawPrompt is true only when a raw prompt is present.",
      });
    }
    if (
      !packet.includesRawPrompt &&
      packet.declaration.answers.rawPrompt !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["declaration", "answers", "rawPrompt"],
        message: "A raw prompt cannot appear unless includesRawPrompt is true.",
      });
    }
    const events = packet.evidence.events;
    for (let index = 1; index < events.length; index += 1) {
      if (events[index].sequence <= events[index - 1].sequence) {
        ctx.addIssue({
          code: "custom",
          path: ["evidence", "events", index, "sequence"],
          message: "Evidence events must stay in chronological sequence order.",
        });
      }
    }
    const head = packet.evidence.chainHead;
    if (head && events.length > 0) {
      const last = events[events.length - 1];
      if (
        last.eventId !== head.eventId ||
        last.eventHash !== head.eventHash ||
        last.sequence !== head.sequence
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["evidence", "chainHead"],
          message: "History must end at the recorded chain head.",
        });
      }
    }
    if (head === null && events.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["evidence", "chainHead"],
        message: "A non-empty history requires a recorded chain head.",
      });
    }
  });

export type EvidencePacketV1 = z.infer<typeof evidencePacketV1Schema>;

export function validateEvidencePacketV1(value: unknown): EvidencePacketV1 {
  return evidencePacketV1Schema.parse(value);
}
