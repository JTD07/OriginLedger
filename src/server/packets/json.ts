import { evidencePacketV1Schema, type EvidencePacketV1 } from "./schema";

export function serializeEvidencePacketJson(
  packet: EvidencePacketV1,
): Uint8Array {
  const validated = evidencePacketV1Schema.parse(packet);
  const text = `${JSON.stringify(validated, null, 2)}\n`;
  return new TextEncoder().encode(text);
}

export function parseEvidencePacketJson(bytes: Uint8Array): EvidencePacketV1 {
  const text = new TextDecoder().decode(bytes);
  return evidencePacketV1Schema.parse(JSON.parse(text));
}
