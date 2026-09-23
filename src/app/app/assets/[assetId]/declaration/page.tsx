import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/a11y/page-shell";
import { DeclarationWizard } from "@/components/declarations/wizard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { getDeclarationWorkspace } from "@/server/declarations/service";

export const metadata = { title: "Provenance declaration" };

export default async function DeclarationPage({
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

  const loaded = await getDeclarationWorkspace(supabase, user.id, asset.id);
  if (!loaded.ok) {
    notFound();
  }

  return (
    <>
      <p>
        <Link className="min-h-11 underline" href={`/app/assets/${asset.id}`}>
          Back to file
        </Link>
      </p>
      <PageHeading>Provenance declaration</PageHeading>
      <DeclarationWizard
        assetId={asset.id}
        fileName={asset.client_filename ?? "Asset"}
        workspace={loaded.workspace}
      />
    </>
  );
}
