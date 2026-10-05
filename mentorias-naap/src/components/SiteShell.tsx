import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSessionContext } from "@/lib/auth";

export async function SiteShell({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const ctx = await getSessionContext();
  return (
    <>
      <Header profile={ctx?.profile} />
      {bare ? (
        <main className="flex-1">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      )}
      <Footer />
    </>
  );
}
