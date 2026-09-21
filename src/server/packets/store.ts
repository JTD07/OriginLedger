import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { EVIDENCE_PACKET_BUCKET } from "./constants";

export function packetStorageKey(): string {
  return `exports/${crypto.randomUUID()}`;
}

function storage() {
  return createServiceRoleClient().storage.from(EVIDENCE_PACKET_BUCKET);
}

export async function storeEvidencePacket(input: {
  key: string;
  bytes: Uint8Array;
  contentType: "application/json" | "application/pdf";
}): Promise<void> {
  const { error } = await storage().upload(input.key, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (error) {
    throw new Error("packet_store_failed");
  }
}

export async function downloadEvidencePacket(
  key: string,
): Promise<Uint8Array | null> {
  const { data, error } = await storage().download(key);
  if (error || !data) {
    return null;
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeEvidencePacket(key: string): Promise<void> {
  const { error } = await storage().remove([key]);
  if (error && !/not found|404/i.test(error.message)) {
    throw new Error("packet_remove_failed");
  }
}
