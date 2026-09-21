import { describe, expect, it } from "vitest";
import { EVIDENCE_PACKET_V1_FIXTURE } from "./fixture";
import {
  extractPdfText,
  renderEvidencePacketPdf,
  sanitizePdfText,
} from "./pdf";
import { PACKET_DISCLAIMER_TEXT } from "./disclaimer";
import { buildEvidencePacket } from "./snapshot";
import { packetPlainText } from "./text";

describe("evidence packet PDF", () => {
  it("renders disclaimer, timestamps, and extracted text from the packet model", async () => {
    const rendered = await renderEvidencePacketPdf(EVIDENCE_PACKET_V1_FIXTURE);
    const extracted = await extractPdfText(rendered.bytes);
    expect(rendered.pageCount).toBeGreaterThanOrEqual(1);
    expect(rendered.lines.join("\n")).toContain("ORIGINLEDGER EVIDENCE PACKET");
    expect(extracted.text).toContain("NON-CERTIFICATION DISCLAIMER");
    expect(extracted.text).toContain("not a government, legal, authenticity");
    expect(extracted.text).toContain("2026-09-20T16:00:00.000Z");
    expect(extracted.text).toContain("disclosure-rules.v1");
    expect(extracted.text).toContain("Page 1");
    expect(packetPlainText(EVIDENCE_PACKET_V1_FIXTURE)).toContain(
      PACKET_DISCLAIMER_TEXT.slice(0, 40),
    );
  });

  it("paginates a large history without clipping the last event", async () => {
    const events = Array.from({ length: 80 }, (_, index) => ({
      eventId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      sequence: index + 1,
      eventType: "declaration_submitted",
      eventAt: "2026-09-20T14:00:00.000Z",
      actor: "11111111-1111-4111-8111-111111111111",
      eventHash: index.toString(16).padStart(64, "d"),
      previousHash: (index === 0 ? "0" : (index - 1).toString(16)).padStart(
        64,
        index === 0 ? "0" : "d",
      ),
      payload: {
        notes: `Long event notes ${index + 1} ${"word ".repeat(20)}`,
      },
    }));
    const packet = buildEvidencePacket({
      generatedAt: "2026-09-20T16:00:00.000Z",
      includeRawPrompt: false,
      organization: EVIDENCE_PACKET_V1_FIXTURE.organization,
      project: EVIDENCE_PACKET_V1_FIXTURE.project,
      asset: {
        id: EVIDENCE_PACKET_V1_FIXTURE.asset.id,
        organizationId: EVIDENCE_PACKET_V1_FIXTURE.organization.id,
        projectId: EVIDENCE_PACKET_V1_FIXTURE.project.id,
        clientFilename: EVIDENCE_PACKET_V1_FIXTURE.asset.clientFilename,
        verifiedMimeType: EVIDENCE_PACKET_V1_FIXTURE.asset.verifiedMimeType,
        byteSize: EVIDENCE_PACKET_V1_FIXTURE.asset.byteSize,
        sha256: EVIDENCE_PACKET_V1_FIXTURE.asset.sha256,
        status: EVIDENCE_PACKET_V1_FIXTURE.asset.status,
      },
      declaration: {
        id: EVIDENCE_PACKET_V1_FIXTURE.declaration.id,
        versionId: EVIDENCE_PACKET_V1_FIXTURE.declaration.versionId,
        versionNumber: EVIDENCE_PACKET_V1_FIXTURE.declaration.versionNumber,
        status: EVIDENCE_PACKET_V1_FIXTURE.declaration.status,
        draft: {
          creationMode: "ai_generated",
          provider: "Northwind",
          model: "OriginDraw",
          modelVersion: "3",
          generationDate: "2026-09-01",
          sourceNotes: "",
          promptSummary: "Studio photograph of a crate.",
          rawPromptCaptureEnabled: false,
          rawPrompt: "",
          humanEdits: "substantial",
          distributionRegions: ["us"],
          contentCategory: "product_documentation",
          realisticDepiction: "stylized",
          publicInterest: "none",
          editorialReview: "internally_reviewed",
        },
      },
      assessment: EVIDENCE_PACKET_V1_FIXTURE.assessment,
      review: EVIDENCE_PACKET_V1_FIXTURE.review,
      events,
      verification: { ok: true, checked: 80 },
    });
    const rendered = await renderEvidencePacketPdf(packet);
    const extracted = await extractPdfText(rendered.bytes);
    expect(rendered.pageCount).toBeGreaterThan(2);
    expect(extracted.text).toContain("Event 1");
    expect(extracted.text).toContain("Event 80");
    expect(extracted.text).toContain(`Page ${rendered.pageCount}`);
  });

  it("strips unsafe control characters from user text", () => {
    expect(sanitizePdfText("safe\u0000name<script>")).toBe("safename<script>");
  });
});
