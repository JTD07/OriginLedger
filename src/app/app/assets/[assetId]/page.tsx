import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/a11y/page-shell";
import { StatusBadge } from "@/components/a11y/status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { isInlinePreviewMime } from "@/server/assets/constants";
import { processAssetAction } from "@/server/assets/actions";

const FAILURE_COPY: Record<string, string> = {
  too_large: "The stored file is larger than 25 MB.",
  invalid_signature: "The file contents could not be verified.",
  disallowed_type: "That file type is not allowed.",
  excessive_dimensions: "The image is too large to process.",
  missing_object: "The stored object was missing. Upload the file again.",
};

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  await requireUser();
  const { assetId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) {
    notFound();
  }

  const { data: project } = await supabase
    .from("projects")
    .select("is_sample")
    .eq("id", asset.project_id)
    .maybeSingle();

  let duplicateCount = 0;
  if (asset.status === "ready" && asset.sha256) {
    const { count } = await supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", asset.organization_id)
      .eq("sha256", asset.sha256)
      .eq("status", "ready")
      .neq("id", asset.id);
    duplicateCount = count ?? 0;
  }

  const inline =
    asset.status === "ready" &&
    asset.verified_mime_type &&
    isInlinePreviewMime(asset.verified_mime_type);

  const statusTone =
    asset.status === "ready"
      ? "success"
      : asset.status === "processing_failed"
        ? "danger"
        : asset.status === "processing" || asset.status === "pending_upload"
          ? "busy"
          : "neutral";

  return (
    <>
      <p>
        <Link
          className="min-h-11 underline"
          href={`/app/projects/${asset.project_id}`}
        >
          Back to project
        </Link>
      </p>
      <PageHeading>{asset.client_filename ?? "Asset"}</PageHeading>
      {project?.is_sample ? (
        <StatusBadge tone="warning">
          Synthetic sample file. This is not a real origin record.
        </StatusBadge>
      ) : null}
      <StatusBadge tone={statusTone}>
        {asset.status.replaceAll("_", " ")}
      </StatusBadge>
      {asset.status === "processing_failed" ? (
        <p role="alert">
          {FAILURE_COPY[asset.failure_code ?? ""] ??
            "Processing failed. You can retry after uploading the file again."}
        </p>
      ) : null}
      {asset.status === "ready" && (duplicateCount ?? 0) > 0 ? (
        <p role="status">
          This organization already has {duplicateCount} other ready file
          {(duplicateCount ?? 0) === 1 ? "" : "s"} with the same contents. The
          new upload was kept.
        </p>
      ) : null}
      {asset.status === "ready" ? (
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <dt>Verified type</dt>
          <dd>{asset.verified_mime_type}</dd>
          <dt>Size</dt>
          <dd>{asset.byte_size} bytes</dd>
        </dl>
      ) : null}
      {asset.status === "ready" ? (
        <nav aria-label="Asset actions" className="flex flex-col gap-2">
          <Link
            className="min-h-11 underline"
            href={`/app/assets/${asset.id}/declaration`}
          >
            Provenance declaration
          </Link>
          <Link
            className="min-h-11 underline"
            href={`/app/assets/${asset.id}/exports`}
          >
            Evidence packets
          </Link>
        </nav>
      ) : null}
      {inline ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Verified image preview of the uploaded origin-record file"
          src={`/app/assets/${asset.id}/preview`}
          className="max-w-full border border-zinc-200"
        />
      ) : null}
      {asset.status === "ready" && !inline ? (
        <p>
          This format is not rendered inline.{" "}
          <a
            className="min-h-11 underline"
            href={`/app/assets/${asset.id}/preview`}
          >
            Download the file
          </a>
        </p>
      ) : null}
      {asset.status === "processing_failed" ||
      asset.status === "pending_upload" ? (
        <form
          action={async () => {
            "use server";
            await processAssetAction(asset.id);
          }}
        >
          <button
            type="submit"
            className="min-h-11 rounded-md border border-zinc-300 px-4 py-2"
          >
            Retry processing
          </button>
        </form>
      ) : null}
    </>
  );
}
