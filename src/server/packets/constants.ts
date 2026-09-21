export const EVIDENCE_PACKET_BUCKET = "evidence-packets";
export const EVIDENCE_EXPORT_FORMATS = ["json", "pdf"] as const;
export type EvidenceExportFormat = (typeof EVIDENCE_EXPORT_FORMATS)[number];

export const SHARE_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
export const SHARE_RATE_LIMIT_MAX_REQUESTS = 20;

export const SHARE_PAGE_TITLE = "Shared document";
export const SHARE_PAGE_DESCRIPTION =
  "A documentation packet is available through a private link.";
export const SHARE_UNAVAILABLE_MESSAGE = "This shared document is unavailable.";

export const RAW_PROMPT_EXPORT_WARNING =
  "The raw prompt may contain sensitive information. Include it only when you intend to share that text with the recipient of this export.";
