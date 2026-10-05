import { SiteShell } from "@/components/SiteShell";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <SiteShell>{children}</SiteShell>;
}
