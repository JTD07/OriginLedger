import { inflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, type PDFPage } from "pdf-lib";
import { PACKET_DISCLAIMER_TEXT } from "./disclaimer";
import type { EvidencePacketV1 } from "./schema";
import { packetPlainLines, wrapPacketText } from "./text";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const BODY_SIZE = 10;
const HEADING_SIZE = 14;
const LINE_HEIGHT = 13;
const FOOTER_Y = 32;

export type RenderedPacketPdf = {
  bytes: Uint8Array;
  pageCount: number;
  lines: string[];
};

export function sanitizePdfText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[^\u0009\u000a\u000d\u0020-\u007e]/g, "?");
}

export async function renderEvidencePacketPdf(
  packet: EvidencePacketV1,
): Promise<RenderedPacketPdf> {
  const document = await PDFDocument.create();
  document.setTitle("Shared document");
  document.setSubject("OriginLedger evidence packet");
  document.setAuthor("OriginLedger");
  document.setCreator("OriginLedger");
  document.setProducer("OriginLedger");
  document.setKeywords([]);

  const font = await document.embedFont(StandardFonts.Helvetica);
  const headingFont = await document.embedFont(StandardFonts.HelveticaBold);
  const lines = packetPlainLines(packet).map(sanitizePdfText);
  const headingNames = new Set([
    "ORIGINLEDGER EVIDENCE PACKET",
    "DISCLAIMER",
    "ORGANIZATION",
    "CLIENT",
    "PROJECT",
    "ASSET",
    "DECLARATION",
    "ASSESSMENT",
    "HUMAN REVIEW",
    "EVIDENCE CHAIN",
    "EVIDENCE EVENTS",
  ]);

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  const disclaimerLines = wrapPacketText(
    sanitizePdfText(PACKET_DISCLAIMER_TEXT),
    78,
  );
  y = drawDisclaimerBox(page, headingFont, font, disclaimerLines, y);

  for (const line of lines) {
    const isHeading = headingNames.has(line);
    const size = isHeading ? HEADING_SIZE : BODY_SIZE;
    const usedFont = isHeading ? headingFont : font;
    const height = isHeading ? LINE_HEIGHT + 4 : LINE_HEIGHT;
    if (y - height < MARGIN + 16) {
      drawFooter(page, font, document.getPageCount());
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(line.length > 0 ? line : " ", {
      x: MARGIN,
      y: y - size,
      size,
      font: usedFont,
      maxWidth,
    });
    y -= height;
  }

  drawFooter(page, font, document.getPageCount());

  const bytes = await document.save();
  return {
    bytes,
    pageCount: document.getPageCount(),
    lines,
  };
}

function drawDisclaimerBox(
  page: PDFPage,
  headingFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  lines: string[],
  startY: number,
): number {
  const boxHeight = 28 + lines.length * 12;
  const boxY = startY - boxHeight;
  page.drawRectangle({
    x: MARGIN - 6,
    y: boxY,
    width: PAGE_WIDTH - MARGIN * 2 + 12,
    height: boxHeight,
    borderWidth: 1.5,
  });
  page.drawText("NON-CERTIFICATION DISCLAIMER", {
    x: MARGIN,
    y: startY - 16,
    size: 11,
    font: headingFont,
  });
  let y = startY - 30;
  for (const line of lines) {
    page.drawText(line, {
      x: MARGIN,
      y,
      size: 9,
      font,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    });
    y -= 12;
  }
  return boxY - 18;
}

function drawFooter(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  pageNumber: number,
) {
  page.drawText(`Page ${pageNumber}`, {
    x: PAGE_WIDTH / 2 - 20,
    y: FOOTER_Y,
    size: 9,
    font,
  });
}

export async function extractPdfText(bytes: Uint8Array): Promise<{
  pageCount: number;
  text: string;
}> {
  const document = await PDFDocument.load(bytes);
  const pages = document.getPages();
  const chunks: string[] = [];
  for (const page of pages) {
    const contents = page.node.Contents();
    if (!contents) {
      continue;
    }
    const refs = "asArray" in contents ? contents.asArray() : [contents];
    for (const ref of refs) {
      const stream = document.context.lookup(ref);
      const maybeContents =
        stream && typeof stream === "object" && "getContents" in stream
          ? (stream as { getContents: () => Uint8Array }).getContents()
          : null;
      if (!maybeContents) {
        continue;
      }
      const decoded = decodePdfStream(maybeContents);
      const literal = decoded.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g);
      for (const match of literal) {
        chunks.push(unescapePdfString(match[1] ?? ""));
      }
      const hex = decoded.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g);
      for (const match of hex) {
        chunks.push(hexToPdfText(match[1] ?? ""));
      }
    }
  }
  return {
    pageCount: pages.length,
    text: chunks.join("\n"),
  };
}

function decodePdfStream(bytes: Uint8Array): string {
  try {
    return inflateSync(Buffer.from(bytes)).toString("latin1");
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

function hexToPdfText(value: string): string {
  const bytes = Buffer.from(value, "hex");
  return bytes.toString("latin1");
}

function unescapePdfString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}
