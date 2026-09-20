import "server-only";

import { ASSET_BUCKET, SIGNED_PREVIEW_TTL_SECONDS } from "./constants";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type SignedUploadTicket = {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
};

export type AssetObjectStore = {
  createSignedUpload(path: string): Promise<SignedUploadTicket>;
  download(path: string): Promise<Uint8Array | null>;
  sizeOf(path: string): Promise<number | null>;
  remove(path: string): Promise<void>;
  createSignedPreview(
    path: string,
    options?: { download?: string | boolean },
  ): Promise<string>;
};

function storage() {
  return createServiceRoleClient().storage.from(ASSET_BUCKET);
}

export const supabaseAssetObjectStore: AssetObjectStore = {
  async createSignedUpload(path) {
    const { data, error } = await storage().createSignedUploadUrl(path, {
      upsert: true,
    });
    if (error || !data) {
      throw new Error("upload_ticket_failed");
    }
    return {
      bucket: ASSET_BUCKET,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  },
  async download(path) {
    const { data, error } = await storage().download(path);
    if (error || !data) {
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  },
  async sizeOf(path) {
    const folder = path.split("/").slice(0, -1).join("/");
    const name = path.split("/").at(-1);
    if (!name) {
      return null;
    }
    const { data, error } = await storage().list(folder, {
      search: name,
      limit: 1,
    });
    if (error || !data?.[0]) {
      return null;
    }
    const size = data[0].metadata?.size;
    return typeof size === "number" && Number.isFinite(size) ? size : null;
  },
  async remove(path) {
    const { error } = await storage().remove([path]);
    if (error && !/not found|404/i.test(error.message)) {
      throw new Error("object_remove_failed");
    }
  },
  async createSignedPreview(path, options) {
    const { data, error } = await storage().createSignedUrl(
      path,
      SIGNED_PREVIEW_TTL_SECONDS,
      options?.download ? { download: options.download } : undefined,
    );
    if (error || !data?.signedUrl) {
      throw new Error("preview_ticket_failed");
    }
    return data.signedUrl;
  },
};
