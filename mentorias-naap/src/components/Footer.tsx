import Link from "next/link";
import { brand } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {brand.name} · {brand.email} · {brand.phone}
        </p>
        <nav className="flex gap-4">
          <Link href="/termos" className="hover:text-primary">Termos de uso</Link>
          <Link href="/privacidade" className="hover:text-primary">Política de privacidade</Link>
        </nav>
      </div>
    </footer>
  );
}
