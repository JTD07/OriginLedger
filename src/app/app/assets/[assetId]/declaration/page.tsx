import Link from "next/link";
import { notFound } from "next/navigation";
import { DeclarationWizard } from "@/components/declarations/wizard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";
import { getDeclarationWorkspace } from "@/server/declarations/service";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <p>
        <Link className="underline" href={`/app/assets/${asset.id}`}>
          Back to file
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Provenance declaration
      </h1>
      <DeclarationWizard
        assetId={asset.id}
        fileName={asset.client_filename ?? "Asset"}
        workspace={loaded.workspace}
      />
    </main>
  );
}
