import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/a11y/page-shell";
import { StatusBadge } from "@/components/a11y/status";
import {
  DeletionCancelForm,
  DeletionRetryForm,
  OrganizationDeletionForm,
  OrganizationExportForm,
} from "@/components/privacy/privacy-forms";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireUser } from "@/server/auth/session";
import { getOrgAccess } from "@/server/tenancy/access";
import { RAW_PROMPT_HANDLING_OMITTED } from "@/server/privacy/export-schema";
import { getOrganizationDeletionJob } from "@/server/privacy/deletion-service";
import { listOrganizationExports } from "@/server/privacy/export-service";
import { canCancelDeletion } from "@/server/privacy/deletion-runner";
import {
  deletionProcessingCopy,
  deletionRetentionCopy,
  exportExpirationCopy,
  loadRetentionPolicy,
} from "@/server/privacy/retention";
import { getServerEnv } from "@/env/server";

export const metadata = { title: "Data handling" };

export default async function DataHandlingPage() {
  const user = await requireUser("/app/data-handling");
  const supabase = await createServerSupabaseClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: false });
  const organization = organizations?.[0];
  if (!organization) {
    notFound();
  }
  const access = await getOrgAccess(supabase, user.id, organization.id);
  const policy = loadRetentionPolicy({
    organizationExportExpiresHours:
      getServerEnv().organizationExportExpiresHours,
    organizationDeletionRetentionDays:
      getServerEnv().organizationDeletionRetentionDays,
  });
  const service = createServiceRoleClient();
  const exports = access?.canOwn
    ? await listOrganizationExports(supabase, service, user.id, organization.id)
    : { ok: true as const, exports: [] };
  const deletion = access?.canOwn
    ? await getOrganizationDeletionJob(
        supabase,
        service,
        user.id,
        organization.id,
      )
    : { ok: true as const, job: null };

  return (
    <>
      <p>
        <Link className="min-h-11 underline" href="/app">
          Back to workspace
        </Link>
      </p>
      <header className="flex flex-col gap-2">
        <PageHeading>Data handling</PageHeading>
        <p>
          {organization.name}. OriginLedger supports documentation and
          transparency workflows. It does not certify legal or regulatory
          compliance.
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="how-data">
        <h2 id="how-data" className="text-xl font-semibold">
          How this workspace handles data
        </h2>
        <p>
          Files stay in private storage. Share links open only the packet they
          were created for. Error reports are scrubbed before they leave the
          application. {exportExpirationCopy(policy)} {deletionProcessingCopy()}{" "}
          {deletionRetentionCopy(policy)}
        </p>
        <p>{RAW_PROMPT_HANDLING_OMITTED}</p>
      </section>

      {access?.canOwn ? (
        <>
          <section className="flex flex-col gap-3" aria-labelledby="export">
            <h2 id="export" className="text-xl font-semibold">
              Organization export
            </h2>
            <OrganizationExportForm
              organizationId={organization.id}
              organizationName={organization.name}
              rawPromptWarning={RAW_PROMPT_HANDLING_OMITTED}
            />
            {exports.ok && exports.exports.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {exports.exports.map((item) => (
                  <li key={item.id}>
                    {item.status}
                    {item.status === "ready" || item.status === "downloaded" ? (
                      <>
                        {" "}
                        <a
                          className="underline"
                          href={`/app/organizations/${organization.id}/exports/${item.id}/download`}
                        >
                          Download
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          <section className="flex flex-col gap-3" aria-labelledby="deletion">
            <h2 id="deletion" className="text-xl font-semibold">
              Organization deletion
            </h2>
            {deletion.ok && deletion.job ? (
              <StatusBadge
                tone={
                  deletion.job.status === "failed"
                    ? "danger"
                    : deletion.job.status === "completed"
                      ? "success"
                      : "busy"
                }
              >
                {deletion.job.status}. Step {deletion.job.currentStep}.
                {deletion.job.correlationId
                  ? ` Reference ${deletion.job.correlationId}.`
                  : ""}
              </StatusBadge>
            ) : null}
            {deletion.ok &&
            deletion.job?.status === "failed" &&
            deletion.job.correlationId ? (
              <DeletionRetryForm organizationId={organization.id} />
            ) : null}
            {deletion.ok &&
            deletion.job &&
            canCancelDeletion(deletion.job.currentStep) &&
            deletion.job.status !== "completed" ? (
              <DeletionCancelForm organizationId={organization.id} />
            ) : null}
            {deletion.ok && !deletion.job ? (
              <OrganizationDeletionForm
                organizationId={organization.id}
                organizationName={organization.name}
                deletionCopy={deletionProcessingCopy()}
              />
            ) : null}
          </section>
        </>
      ) : (
        <p>Only the organization owner can export or delete this workspace.</p>
      )}
    </>
  );
}
