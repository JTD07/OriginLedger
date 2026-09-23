import type { SignedUploadTicket } from "@/server/assets/object-store";

export async function putSignedObject(
  ticket: SignedUploadTicket,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const url = new URL(ticket.signedUrl);
  url.searchParams.set("token", ticket.token);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Blob([Buffer.from(bytes)], { type: contentType }),
  });
  if (!response.ok) {
    throw new Error("sample_upload_failed");
  }
}
