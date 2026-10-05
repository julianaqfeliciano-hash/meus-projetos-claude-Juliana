import { SiteShell } from "@/components/SiteShell";

export default function HomeLayout({ children }: LayoutProps<"/">) {
  return <SiteShell bare>{children}</SiteShell>;
}
