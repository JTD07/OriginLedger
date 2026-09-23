import Link from "next/link";
import { PageHeading } from "@/components/a11y/page-shell";
import { EmptyState } from "@/components/a11y/status";
import {
  CreateOrganizationForm,
  CreateProjectForm,
  CreateSampleProjectForm,
  RemoveSampleProjectForm,
} from "@/components/assets/workspace-forms";
import { OnboardingChecklist } from "@/components/onboarding/checklist";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { getOrgAccess } from "@/server/tenancy/access";
import { listProjects } from "@/server/assets/service";
import { SAMPLE_PROJECT_NAME } from "@/server/samples/constants";
import { onboardingSteps } from "@/server/samples/progress";
import {
  getSampleProject,
  loadOnboardingProgress,
} from "@/server/samples/service";

export default async function AppHomePage() {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: false });
  const projects = await listProjects(supabase);
  const firstOrg = organizations?.[0];
  const access = firstOrg
    ? await getOrgAccess(supabase, user.id, firstOrg.id)
    : null;
  const sample = firstOrg
    ? await getSampleProject(supabase, firstOrg.id)
    : null;
  const progress = firstOrg
    ? await loadOnboardingProgress(supabase, firstOrg.id)
    : null;
  const steps = progress ? onboardingSteps(progress) : [];
  const completedHref =
    progress?.hasExport && progress.assetId
      ? `/app/assets/${progress.assetId}/exports`
      : null;

  return (
    <>
      <PageHeading>Workspace</PageHeading>
      <p>
        Signed in{user.email ? ` as ${user.email}` : ""}. OriginLedger supports
        documentation and transparency workflows. It does not certify legal or
        regulatory compliance.
      </p>

      {firstOrg ? (
        <section className="flex flex-col gap-3" aria-labelledby="org-heading">
          <h2 id="org-heading" className="text-xl font-semibold">
            {firstOrg.name}
          </h2>
          {access?.canMutate ? (
            <CreateProjectForm organizationId={firstOrg.id} />
          ) : (
            <p>You can view projects in this organization.</p>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="create-org">
          <h2 id="create-org" className="text-xl font-semibold">
            Create an organization
          </h2>
          <CreateOrganizationForm />
        </section>
      )}

      {firstOrg && progress ? (
        <OnboardingChecklist
          organizationId={firstOrg.id}
          steps={steps}
          completedHref={completedHref}
        />
      ) : null}

      {firstOrg && access?.canMutate ? (
        <section
          className="flex flex-col gap-3"
          aria-labelledby="sample-heading"
        >
          <h2 id="sample-heading" className="text-xl font-semibold">
            Synthetic sample
          </h2>
          {sample ? (
            <>
              <p>
                This organization has a labeled synthetic sample project. Sample
                files count toward the monthly file limit.
              </p>
              <p>
                <Link
                  className="min-h-11 underline"
                  href={`/app/projects/${sample.projectId}`}
                >
                  {SAMPLE_PROJECT_NAME}
                </Link>
              </p>
              <RemoveSampleProjectForm organizationId={firstOrg.id} />
            </>
          ) : (
            <CreateSampleProjectForm organizationId={firstOrg.id} />
          )}
        </section>
      ) : null}

      <section
        className="flex flex-col gap-3"
        aria-labelledby="projects-heading"
      >
        <h2 id="projects-heading" className="text-xl font-semibold">
          Projects
        </h2>
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            action={
              firstOrg && access?.canMutate ? (
                <p>
                  Create a project above, or create the synthetic sample
                  project.
                </p>
              ) : firstOrg ? (
                <p>Ask an operator or owner to create a project.</p>
              ) : (
                <p>Create an organization to add a project.</p>
              )
            }
          >
            Projects hold origin-record files for this organization.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  className="min-h-11 underline"
                  href={`/app/projects/${project.id}`}
                >
                  {project.name}
                  {project.is_sample ? " (synthetic sample)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
