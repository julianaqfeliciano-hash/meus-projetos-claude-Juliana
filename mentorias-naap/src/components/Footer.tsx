import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { brand } from "@/lib/config";

export function Footer() {
  return (
    <footer className="hero mt-auto text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <LogoMark variant="white" className="h-12 w-auto" />
        </div>
        <div className="space-y-1 text-white/85 sm:text-right">
          <p>{brand.email} · {brand.phone}</p>
          <p>
            <Link href="/termos" className="hover:text-white hover:underline">Termos de uso</Link>
            {" · "}
            <Link href="/privacidade" className="hover:text-white hover:underline">Política de privacidade</Link>
          </p>
          <p className="text-xs text-white/70">© {new Date().getFullYear()} {brand.name}</p>
        </div>
      </div>
    </footer>
  );
}
