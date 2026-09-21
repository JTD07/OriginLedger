import type { EvidenceExportFormat } from "./constants";

export type EvidenceExportView = {
  id: string;
  assetId: string;
  format: EvidenceExportFormat;
  schemaVersion: string;
  contentSha256: string;
  chainHeadEventId: string | null;
  chainHeadEventHash: string | null;
  chainHeadSequence: number | null;
  includesRawPrompt: boolean;
  generatedAt: string;
  createdBy: string;
};

export type ShareLinkView = {
  id: string;
  exportId: string;
  status: "active" | "revoked";
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
