import { AppHeader } from "@/components/a11y/app-header";
import { AppMain } from "@/components/a11y/page-shell";
import { SiteFooter } from "@/components/legal/site-footer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Workspace" };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id")
    .limit(1);

  return (
    <>
      <AppHeader hasOrganization={Boolean(organizations?.[0])} />
      <AppMain>{children}</AppMain>
      <SiteFooter />
    </>
  );
}
