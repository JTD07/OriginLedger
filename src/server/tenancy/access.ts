import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const MUTATING_ROLES = ["owner", "admin", "operator"] as const;
const REVIEWING_ROLES = ["owner", "admin", "reviewer"] as const;
const BILLING_ROLES = ["owner", "admin"] as const;

export type MembershipRole = Database["public"]["Enums"]["membership_role"];

export type OrgAccess = {
  organizationId: string;
  role: MembershipRole;
  canMutate: boolean;
  canReview: boolean;
  canBill: boolean;
  canOwn: boolean;
};

export async function getOrgAccess(
  client: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
): Promise<OrgAccess | null> {
  const { data, error } = await client
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    organizationId,
    role: data.role,
    canMutate: MUTATING_ROLES.includes(
      data.role as (typeof MUTATING_ROLES)[number],
    ),
    canReview: REVIEWING_ROLES.includes(
      data.role as (typeof REVIEWING_ROLES)[number],
    ),
    canBill: BILLING_ROLES.includes(
      data.role as (typeof BILLING_ROLES)[number],
    ),
    canOwn: data.role === "owner",
  };
}
