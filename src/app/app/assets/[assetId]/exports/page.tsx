import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/a11y/page-shell";
import { ExportPanel } from "@/components/packets/export-panel";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { listEvidenceExports } from "@/server/packets/service";

export const metadata = { title: "Evidence packets" };

export default async function AssetExportsPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const user = await requireUser();
  const { assetId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("id, client_filename")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) {
    notFound();
  }
  const listed = await listEvidenceExports(supabase, user.id, asset.id);
  if (!listed.ok) {
    notFound();
  }

  return (
    <>
      <p>
        <Link className="min-h-11 underline" href={`/app/assets/${asset.id}`}>
          Back to file
        </Link>
      </p>
      <PageHeading>Evidence packets</PageHeading>
      <p>
        OriginLedger supports documentation and transparency workflows.
        Generated packets record supplied information and review history. They
        are not a certification.
      </p>
      <ExportPanel
        assetId={asset.id}
        canMutate={listed.canMutate}
        exports={listed.exports}
        shares={listed.shares}
      />
    </>
  );
}
