import Link from "next/link";
import { notFound } from "next/navigation";
import { ExportPanel } from "@/components/packets/export-panel";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { listEvidenceExports } from "@/server/packets/service";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <p>
        <Link className="underline" href={`/app/assets/${asset.id}`}>
          Back to file
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Evidence packets
      </h1>
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
    </main>
  );
}
