import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/a11y/page-shell";
import { EmptyState, StatusBadge } from "@/components/a11y/status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { EVIDENCE_EVENT_LABELS } from "@/server/evidence/labels";
import {
  EVIDENCE_PAGE_SIZE,
  listEvidencePage,
} from "@/server/evidence/service";
import type { ChainVerification } from "@/server/evidence/verify";

export const metadata = { title: "Evidence history" };

function verificationCopy(verification: ChainVerification, total: number) {
  if (total === 0) {
    return {
      status: "incomplete" as const,
      text: "No evidence events are recorded yet, so integrity verification could not be completed.",
    };
  }
  if (verification.ok) {
    return {
      status: "success" as const,
      text: `Server-side integrity verification succeeded for ${verification.checked} events. This checks stored hashes and links. It does not prove a database administrator never rewrote the chain.`,
    };
  }
  return {
    status: "failed" as const,
    text: `Server-side integrity verification failed at sequence ${verification.brokenSequence ?? "unknown"} (${verification.reason}). History was not repaired.`,
  };
}

export default async function EvidenceHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { assetId } = await params;
  const query = await searchParams;
  const page = Number.parseInt(query.page ?? "1", 10);
  const supabase = await createServerSupabaseClient();
  const loaded = await listEvidencePage(supabase, user.id, assetId, page);

  if (!loaded.ok) {
    notFound();
  }

  const banner = verificationCopy(loaded.verification, loaded.total);
  const pageCount = Math.max(1, Math.ceil(loaded.total / EVIDENCE_PAGE_SIZE));

  return (
    <>
      <p>
        <Link
          className="min-h-11 underline"
          href={`/app/assets/${assetId}/declaration`}
        >
          Back to declaration
        </Link>
      </p>
      <PageHeading>Tamper-evident evidence history</PageHeading>
      <p>
        OriginLedger supports documentation and transparency workflows. This
        timeline is integrity-verified. It is not a blockchain and is not
        absolutely tamper-proof.
      </p>
      <StatusBadge
        tone={
          banner.status === "failed"
            ? "danger"
            : banner.status === "success"
              ? "success"
              : "warning"
        }
      >
        {banner.status === "success"
          ? "Integrity verification succeeded. "
          : banner.status === "failed"
            ? "Integrity verification failed. "
            : "Integrity verification could not be completed. "}
        {banner.text}
      </StatusBadge>
      {loaded.events.length === 0 ? (
        <EmptyState title="No evidence events for this file yet">
          Events appear after a declaration is submitted or reviewed.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-4">
          {loaded.events.map((event) => {
            const payload =
              event.event_payload &&
              typeof event.event_payload === "object" &&
              !Array.isArray(event.event_payload)
                ? event.event_payload
                : {};
            const notes =
              typeof payload.notes === "string" ? payload.notes : "";
            const outcome =
              typeof payload.toStatus === "string" ? payload.toStatus : "";
            return (
              <li
                key={event.id}
                className="flex flex-col gap-2 border border-zinc-200 p-4"
              >
                <h2 className="text-lg font-semibold">
                  {EVIDENCE_EVENT_LABELS[event.event_type] ?? event.event_type}
                </h2>
                <p>Sequence {event.sequence}</p>
                <p>Actor {event.actor}</p>
                <p>
                  {new Date(event.event_at).toISOString()}
                  {outcome ? ` — outcome: ${outcome.replaceAll("_", " ")}` : ""}
                </p>
                {notes ? <p className="whitespace-pre-wrap">{notes}</p> : null}
                <details>
                  <summary>Technical integrity values</summary>
                  <p>Previous hash {event.previous_hash}</p>
                  <p>Event hash {event.event_hash}</p>
                  <p>
                    {event.canonicalization_version} / {event.hash_version}
                  </p>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {pageCount > 1 ? (
        <nav aria-label="Evidence pages" className="flex flex-wrap gap-3">
          {loaded.page > 1 ? (
            <Link
              className="min-h-11 underline"
              href={`/app/assets/${assetId}/history?page=${loaded.page - 1}`}
            >
              Previous page
            </Link>
          ) : null}
          <p>
            Page {loaded.page} of {pageCount}
          </p>
          {loaded.page < pageCount ? (
            <Link
              className="min-h-11 underline"
              href={`/app/assets/${assetId}/history?page=${loaded.page + 1}`}
            >
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
