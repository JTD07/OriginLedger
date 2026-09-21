import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { getOrgAccess } from "@/server/tenancy/access";
import { formatEvidenceTimestamp } from "./canon";
import { EVIDENCE_PAGE_SIZE, evidencePageRange } from "./page";
import { verifyEvidenceChain, type EvidenceRecord } from "./verify";

export { EVIDENCE_PAGE_SIZE };

function asPayload(value: Json): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function toRecord(
  row: Database["public"]["Tables"]["evidence_events"]["Row"],
): EvidenceRecord {
  return {
    sequence: row.sequence,
    organization_id: row.organization_id,
    asset_id: row.asset_id,
    event_type: row.event_type,
    event_payload: asPayload(row.event_payload),
    actor: row.actor,
    timestamp: formatEvidenceTimestamp(new Date(row.event_at)),
    previous_hash: row.previous_hash,
    event_hash: row.event_hash,
  };
}

export async function listEvidencePage(
  client: SupabaseClient<Database>,
  userId: string,
  assetId: string,
  page: number,
): Promise<
  | {
      ok: true;
      events: Database["public"]["Tables"]["evidence_events"]["Row"][];
      total: number;
      page: number;
      pageSize: number;
      verification: Awaited<ReturnType<typeof verifyEvidenceChain>>;
    }
  | { ok: false; error: "not_found" }
> {
  const { data: asset } = await client
    .from("assets")
    .select("id, organization_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) {
    return { ok: false, error: "not_found" };
  }
  const access = await getOrgAccess(client, userId, asset.organization_id);
  if (!access) {
    return { ok: false, error: "not_found" };
  }

  const { page: safePage, from, to } = evidencePageRange(page);

  const list = await client
    .from("evidence_events")
    .select("*", { count: "exact" })
    .eq("asset_id", asset.id)
    .eq("organization_id", asset.organization_id)
    .order("sequence", { ascending: true })
    .range(from, to);

  const chain = await client
    .from("evidence_events")
    .select("*")
    .eq("asset_id", asset.id)
    .eq("organization_id", asset.organization_id)
    .order("sequence", { ascending: true })
    .limit(10_000);

  const verification = await verifyEvidenceChain(
    (chain.data ?? []).map(toRecord),
  );

  return {
    ok: true,
    events: list.data ?? [],
    total: list.count ?? 0,
    page: safePage,
    pageSize: EVIDENCE_PAGE_SIZE,
    verification,
  };
}
