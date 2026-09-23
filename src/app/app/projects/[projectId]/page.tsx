import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/a11y/page-shell";
import { EmptyState, StatusBadge } from "@/components/a11y/status";
import { AssetUploadForm } from "@/components/assets/upload-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { getOrgAccess } from "@/server/tenancy/access";
import { SAMPLE_PROJECT_NAME } from "@/server/samples/constants";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await requireUser();
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const access = await getOrgAccess(supabase, user.id, project.organization_id);
  const { data: assets } = await supabase
    .from("assets")
    .select("id, client_filename, status, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <p>
        <Link className="min-h-11 underline" href="/app">
          Back to workspace
        </Link>
      </p>
      <PageHeading>{project.name}</PageHeading>
      {project.is_sample ? (
        <StatusBadge tone="warning">
          Synthetic sample data. This is not a real origin record. Sample files
          count toward the monthly file limit.
        </StatusBadge>
      ) : null}
      <AssetUploadForm
        projectId={project.id}
        canUpload={Boolean(access?.canMutate)}
      />
      <section aria-labelledby="files-heading" className="flex flex-col gap-3">
        <h2 id="files-heading" className="text-xl font-semibold">
          Files
        </h2>
        {assets && assets.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <Link
                  className="min-h-11 underline"
                  href={`/app/assets/${asset.id}`}
                >
                  {asset.client_filename ?? "Untitled file"} (
                  {asset.status.replaceAll("_", " ")})
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No files in this project yet"
            action={
              access?.canMutate ? (
                <p>
                  {project.is_sample && project.name === SAMPLE_PROJECT_NAME
                    ? "If sample creation is still running, wait and refresh. Otherwise upload a PDF, JPEG, PNG, or WebP file."
                    : "Upload a PDF, JPEG, PNG, or WebP file."}
                </p>
              ) : (
                <p>Viewers can inspect files after an operator uploads them.</p>
              )
            }
          >
            Origin-record files stay private to this organization.
          </EmptyState>
        )}
      </section>
    </>
  );
}
