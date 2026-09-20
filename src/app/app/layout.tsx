import { requireUser } from "@/server/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  await requireUser();
  return children;
}
