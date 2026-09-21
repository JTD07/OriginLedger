import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SiteFooter } from "@/components/legal/site-footer";
import {
  CreateOrganizationForm,
  CreateProjectForm,
} from "@/components/assets/workspace-forms";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { getOrgAccess } from "@/server/tenancy/access";
import { listProjects } from "@/server/assets/service";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Workspace</h1>
          <p className="text-zinc-700">
            Signed in{user.email ? ` as ${user.email}` : ""}. OriginLedger
            supports documentation and transparency workflows. It does not
            certify legal or regulatory compliance.
          </p>
        </div>
        <SignOutButton />
      </div>

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
          {access?.canBill ? (
            <p>
              <Link className="underline" href="/app/billing">
                Billing
              </Link>
            </p>
          ) : (
            <p>
              <Link className="underline" href="/app/billing">
                View plan usage
              </Link>
            </p>
          )}
          {access?.canOwn ? (
            <p>
              <Link className="underline" href="/app/data-handling">
                Data handling
              </Link>
            </p>
          ) : (
            <p>
              <Link className="underline" href="/app/data-handling">
                Data handling
              </Link>
            </p>
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

      <section
        className="flex flex-col gap-3"
        aria-labelledby="projects-heading"
      >
        <h2 id="projects-heading" className="text-xl font-semibold">
          Projects
        </h2>
        {projects.length === 0 ? (
          <p>No projects yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  className="underline"
                  href={`/app/projects/${project.id}`}
                >
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
