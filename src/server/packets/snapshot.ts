import type { DeclarationDraft } from "@/server/declarations/schema";
import type { ChainVerification } from "@/server/evidence/verify";
import { packetAnswersFromDraft } from "./answers";
import { PACKET_DISCLAIMER } from "./disclaimer";
import {
  EVIDENCE_PACKET_SCHEMA_VERSION,
  evidencePacketV1Schema,
  type EvidencePacketV1,
} from "./schema";

export type SnapshotAsset = {
  id: string;
  organizationId: string;
  projectId: string;
  clientFilename: string | null;
  verifiedMimeType: string | null;
  byteSize: number | null;
  sha256: string | null;
  status: string;
};

export type SnapshotOrganization = {
  id: string;
  name: string;
};

export type SnapshotProject = {
  id: string;
  name: string;
};

export type SnapshotDeclaration = {
  id: string;
  versionId: string;
  versionNumber: number;
  status: EvidencePacketV1["declaration"]["status"];
  draft: DeclarationDraft;
};

export type SnapshotAssessment = {
  rulesetVersion: string;
  recommendationLevel: EvidencePacketV1["assessment"] extends infer A
    ? A extends { recommendationLevel: infer L }
      ? L
      : never
    : never;
  reasonCodes: string[];
  templateId: string;
  visibleDisclosureText: string;
  humanReviewNotice: string;
  status: NonNullable<EvidencePacketV1["assessment"]>["status"];
} | null;

export type SnapshotReview = {
  decision: NonNullable<EvidencePacketV1["review"]>["decision"];
  reviewerId: string;
  reviewedAt: string;
  notes: string | null;
} | null;

export type SnapshotEvent = {
  eventId: string;
  sequence: number;
  eventType: string;
  eventAt: string;
  actor: string;
  eventHash: string;
  previousHash: string;
  payload: Record<string, unknown>;
};

export function verificationForPacket(
  verification: ChainVerification,
): EvidencePacketV1["evidence"]["verification"] {
  if (verification.ok) {
    return {
      ok: true,
      checked: verification.checked,
      brokenSequence: null,
      reason: "ok",
    };
  }
  return {
    ok: false,
    checked: verification.checked,
    brokenSequence: verification.brokenSequence,
    reason: verification.reason,
  };
}

export function buildEvidencePacket(input: {
  generatedAt: string;
  includeRawPrompt: boolean;
  organization: SnapshotOrganization;
  project: SnapshotProject;
  asset: SnapshotAsset;
  declaration: SnapshotDeclaration;
  assessment: SnapshotAssessment;
  review: SnapshotReview;
  events: SnapshotEvent[];
  verification: ChainVerification;
}): EvidencePacketV1 {
  const ordered = [...input.events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const head = ordered.at(-1) ?? null;
  const answers = packetAnswersFromDraft(
    input.declaration.draft,
    input.includeRawPrompt,
  );
  const packet: EvidencePacketV1 = {
    schemaVersion: EVIDENCE_PACKET_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    includesRawPrompt: answers.rawPrompt !== null,
    disclaimer: {
      recordsSuppliedInformation: PACKET_DISCLAIMER.recordsSuppliedInformation,
      isCertification: PACKET_DISCLAIMER.isCertification,
      independentlyProvesClaims: PACKET_DISCLAIMER.independentlyProvesClaims,
      isBlockchain: PACKET_DISCLAIMER.isBlockchain,
      isAbsolutelyTamperProof: PACKET_DISCLAIMER.isAbsolutelyTamperProof,
      replacesLegalReview: PACKET_DISCLAIMER.replacesLegalReview,
      text: PACKET_DISCLAIMER.text,
    },
    organization: input.organization,
    project: input.project,
    client: {
      organizationId: input.organization.id,
      organizationName: input.organization.name,
    },
    asset: {
      id: input.asset.id,
      clientFilename: input.asset.clientFilename,
      verifiedMimeType: input.asset.verifiedMimeType,
      byteSize: input.asset.byteSize,
      sha256: input.asset.sha256,
      status: input.asset.status,
    },
    declaration: {
      id: input.declaration.id,
      versionId: input.declaration.versionId,
      versionNumber: input.declaration.versionNumber,
      status: input.declaration.status,
      answers,
    },
    assessment: input.assessment,
    review: input.review,
    evidence: {
      chainHead: head
        ? {
            eventId: head.eventId,
            eventHash: head.eventHash,
            sequence: head.sequence,
          }
        : null,
      verification: verificationForPacket(input.verification),
      events: ordered,
    },
  };
  return evidencePacketV1Schema.parse(packet);
}
