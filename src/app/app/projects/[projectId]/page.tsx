import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetUploadForm } from "@/components/assets/upload-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { getOrgAccess } from "@/server/tenancy/access";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <p>
        <Link className="underline" href="/app">
          Back to workspace
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
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
                <Link className="underline" href={`/app/assets/${asset.id}`}>
                  {asset.client_filename ?? "Untitled file"} ({asset.status})
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No files in this project yet.</p>
        )}
      </section>
    </main>
  );
}
