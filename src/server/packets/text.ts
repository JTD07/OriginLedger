import { PACKET_DISCLAIMER_TEXT } from "./disclaimer";
import type { EvidencePacketV1 } from "./schema";

export const PACKET_LINE_WIDTH = 88;

export function wrapPacketText(
  text: string,
  width: number = PACKET_LINE_WIDTH,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      if (word.length > width) {
        if (current) {
          lines.push(current);
          current = "";
        }
        for (let index = 0; index < word.length; index += width) {
          lines.push(word.slice(index, index + width));
        }
        continue;
      }
      const next = current ? `${current} ${word}` : word;
      if (next.length > width) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) {
      lines.push(current);
    }
  }
  return lines.length > 0 ? lines : [""];
}

export function packetPlainText(packet: EvidencePacketV1): string {
  return packetPlainLines(packet).join("\n");
}

export function packetPlainLines(packet: EvidencePacketV1): string[] {
  const lines: string[] = [
    "ORIGINLEDGER EVIDENCE PACKET",
    `Schema: ${packet.schemaVersion}`,
    `Generated: ${packet.generatedAt}`,
    `Includes raw prompt: ${packet.includesRawPrompt ? "yes" : "no"}`,
    "",
    "DISCLAIMER",
    ...wrapPacketText(PACKET_DISCLAIMER_TEXT),
    "",
    "ORGANIZATION",
    `ID: ${packet.organization.id}`,
    `Name: ${packet.organization.name}`,
    "",
    "CLIENT",
    `Organization ID: ${packet.client.organizationId}`,
    `Organization name: ${packet.client.organizationName}`,
    "",
    "PROJECT",
    `ID: ${packet.project.id}`,
    `Name: ${packet.project.name}`,
    "",
    "ASSET",
    `ID: ${packet.asset.id}`,
    `Filename: ${packet.asset.clientFilename ?? "null"}`,
    `Verified MIME type: ${packet.asset.verifiedMimeType ?? "null"}`,
    `Byte size: ${packet.asset.byteSize ?? "null"}`,
    `SHA-256: ${packet.asset.sha256 ?? "null"}`,
    `Status: ${packet.asset.status}`,
    "",
    "DECLARATION",
    `ID: ${packet.declaration.id}`,
    `Version ID: ${packet.declaration.versionId}`,
    `Version number: ${packet.declaration.versionNumber}`,
    `Status: ${packet.declaration.status}`,
    `creationMode: ${packet.declaration.answers.creationMode ?? "null"}`,
    `provider: ${packet.declaration.answers.provider ?? "null"}`,
    `model: ${packet.declaration.answers.model ?? "null"}`,
    `modelVersion: ${packet.declaration.answers.modelVersion ?? "null"}`,
    `generationDate: ${packet.declaration.answers.generationDate ?? "null"}`,
    ...wrapPacketText(
      `sourceNotes: ${packet.declaration.answers.sourceNotes ?? "null"}`,
    ),
    ...wrapPacketText(
      `promptSummary: ${packet.declaration.answers.promptSummary ?? "null"}`,
    ),
    `rawPrompt: ${
      packet.includesRawPrompt
        ? (packet.declaration.answers.rawPrompt ?? "null")
        : "omitted"
    }`,
    `humanEdits: ${packet.declaration.answers.humanEdits ?? "null"}`,
    `distributionRegions: ${packet.declaration.answers.distributionRegions.join(",") || "none"}`,
    `contentCategory: ${packet.declaration.answers.contentCategory ?? "null"}`,
    `realisticDepiction: ${packet.declaration.answers.realisticDepiction ?? "null"}`,
    `publicInterest: ${packet.declaration.answers.publicInterest ?? "null"}`,
    `editorialReview: ${packet.declaration.answers.editorialReview ?? "null"}`,
    "",
    "ASSESSMENT",
  ];

  if (!packet.assessment) {
    lines.push("No assessment in this snapshot.");
  } else {
    lines.push(`Ruleset version: ${packet.assessment.rulesetVersion}`);
    lines.push(
      `Recommendation level: ${packet.assessment.recommendationLevel}`,
    );
    lines.push(`Reason codes: ${packet.assessment.reasonCodes.join(",")}`);
    lines.push(`Template ID: ${packet.assessment.templateId}`);
    lines.push(`Status: ${packet.assessment.status}`);
    lines.push(
      ...wrapPacketText(
        `Visible disclosure: ${packet.assessment.visibleDisclosureText}`,
      ),
    );
    lines.push(
      ...wrapPacketText(
        `Human review notice: ${packet.assessment.humanReviewNotice}`,
      ),
    );
  }

  lines.push("", "HUMAN REVIEW");
  if (!packet.review) {
    lines.push("No human-review decision in this snapshot.");
  } else {
    lines.push(`Decision: ${packet.review.decision}`);
    lines.push(`Reviewer ID: ${packet.review.reviewerId}`);
    lines.push(`Reviewed at: ${packet.review.reviewedAt}`);
    lines.push(...wrapPacketText(`Notes: ${packet.review.notes ?? "null"}`));
  }

  lines.push("", "EVIDENCE CHAIN");
  if (!packet.evidence.chainHead) {
    lines.push("Chain head: none");
  } else {
    lines.push(`Chain head event ID: ${packet.evidence.chainHead.eventId}`);
    lines.push(`Chain head hash: ${packet.evidence.chainHead.eventHash}`);
    lines.push(`Chain head sequence: ${packet.evidence.chainHead.sequence}`);
  }
  lines.push(
    `Verification: ${packet.evidence.verification.ok ? "ok" : "failed"}`,
  );
  lines.push(`Verification reason: ${packet.evidence.verification.reason}`);
  lines.push(`Events checked: ${packet.evidence.verification.checked}`);
  if (packet.evidence.verification.brokenSequence !== null) {
    lines.push(
      `Broken sequence: ${packet.evidence.verification.brokenSequence}`,
    );
  }

  lines.push("", "EVIDENCE EVENTS");
  if (packet.evidence.events.length === 0) {
    lines.push("No evidence events through the recorded chain head.");
  }
  for (const event of packet.evidence.events) {
    lines.push(`Event ${event.sequence}`);
    lines.push(`ID: ${event.eventId}`);
    lines.push(`Type: ${event.eventType}`);
    lines.push(`At: ${event.eventAt}`);
    lines.push(`Actor: ${event.actor}`);
    lines.push(`Hash: ${event.eventHash}`);
    lines.push(`Previous hash: ${event.previousHash}`);
    lines.push(...wrapPacketText(`Payload: ${JSON.stringify(event.payload)}`));
    lines.push("");
  }

  return lines;
}
