"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Link do menu com sublinhado ciano na página atual, como no site do NAAP. */
export function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`border-b-[3px] px-3 py-2 transition ${
        active ? "border-brand-light text-primary" : "border-transparent text-muted hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
