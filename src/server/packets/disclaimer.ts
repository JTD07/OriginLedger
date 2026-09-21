export const EVIDENCE_PACKET_SCHEMA_VERSION = "evidence-packet.v1" as const;

export const PACKET_DISCLAIMER_TEXT =
  "This packet records supplied provenance information and review history. It is not a government, legal, authenticity, ownership, or regulatory certification. It does not independently prove that every submitted claim is true. OriginLedger is not blockchain-based and is not absolutely tamper-proof. This packet does not replace legal or compliance review. OriginLedger supports documentation and transparency workflows.";

export const PACKET_DISCLAIMER = {
  recordsSuppliedInformation: true,
  isCertification: false,
  independentlyProvesClaims: false,
  isBlockchain: false,
  isAbsolutelyTamperProof: false,
  replacesLegalReview: false,
  text: PACKET_DISCLAIMER_TEXT,
} as const;
