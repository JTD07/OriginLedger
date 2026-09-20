"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import {
  createUploadSessionAction,
  processAssetAction,
} from "@/server/assets/actions";
import {
  ALLOWED_ASSET_MIME_TYPES,
  MAX_ASSET_BYTES,
  declaredMimeFromFilename,
} from "@/server/assets/constants";

function signedUploadTarget(signedUrl: string, token: string): string {
  const url = new URL(signedUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function uploadWithProgress(
  signedUrl: string,
  token: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUploadTarget(signedUrl, token));
    request.setRequestHeader("Content-Type", contentType);
    request.setRequestHeader("x-upsert", "true");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(new Error("expired_upload"));
    };
    request.onerror = () => reject(new Error("expired_upload"));
    request.send(file);
  });
}

export function AssetUploadForm({
  projectId,
  canUpload,
}: {
  projectId: string;
  canUpload: boolean;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">(
    "idle",
  );
  const [progress, setProgress] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);

  if (!canUpload) {
    return (
      <p role="status">
        Viewers can inspect ready files but cannot upload. Ask an operator or
        owner if you need to add a file.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setDuplicateCount(0);
    const form = event.currentTarget;
    const file = form.elements.namedItem("file") as HTMLInputElement;
    const selected = file.files?.[0];
    if (!selected) {
      setMessage("Choose a PDF, JPEG, PNG, or WebP file.");
      return;
    }
    if (selected.size > MAX_ASSET_BYTES) {
      setMessage("Files must be 25 MB or smaller.");
      return;
    }

    const declaredMimeType =
      declaredMimeFromFilename(selected.name) ??
      (ALLOWED_ASSET_MIME_TYPES.includes(
        selected.type as (typeof ALLOWED_ASSET_MIME_TYPES)[number],
      )
        ? selected.type
        : null);

    setPhase("uploading");
    setProgress(0);

    const session = await createUploadSessionAction({
      projectId,
      declaredByteSize: selected.size,
      declaredMimeType,
      clientFilename: selected.name,
    });

    if (!session.ok) {
      setPhase("idle");
      setMessage(session.message);
      return;
    }

    try {
      await uploadWithProgress(
        session.data.signedUrl,
        session.data.token,
        selected,
        declaredMimeType ?? "application/octet-stream",
        setProgress,
      );
    } catch {
      const retry = await createUploadSessionAction({
        projectId,
        declaredByteSize: selected.size,
        declaredMimeType,
        clientFilename: selected.name,
        existingAssetId: session.data.assetId,
      });
      if (!retry.ok) {
        setPhase("idle");
        setMessage("The upload URL expired. Try again.");
        return;
      }
      try {
        await uploadWithProgress(
          retry.data.signedUrl,
          retry.data.token,
          selected,
          declaredMimeType ?? "application/octet-stream",
          setProgress,
        );
      } catch {
        setPhase("idle");
        setMessage("The upload URL expired. Try again.");
        return;
      }
    }

    setPhase("processing");
    const processed = await processAssetAction(session.data.assetId);
    if (!processed.ok) {
      setPhase("idle");
      setMessage(processed.message);
      if (processed.data?.assetId) {
        router.push(`/app/assets/${processed.data.assetId}`);
      }
      return;
    }

    setDuplicateCount(processed.data.duplicateCount);
    router.push(`/app/assets/${processed.data.assetId}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-sm font-medium">
          File
        </label>
        <input
          id={fieldId}
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          required
        />
        <p className="text-sm text-zinc-600">
          PDF, JPEG, PNG, or WebP. 25 MB maximum. OriginLedger supports
          documentation and transparency workflows.
        </p>
      </div>
      {phase === "uploading" ? (
        <p role="status" aria-live="polite">
          Uploading to storage: {progress}%
        </p>
      ) : null}
      {phase === "processing" ? (
        <p role="status" aria-live="polite">
          Processing on the server. This is separate from the upload progress.
        </p>
      ) : null}
      {duplicateCount > 0 ? (
        <p role="status" aria-live="polite">
          This organization already has {duplicateCount} file
          {duplicateCount === 1 ? "" : "s"} with the same contents. The new
          upload was kept.
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={phase !== "idle"}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        Upload file
      </button>
    </form>
  );
}
