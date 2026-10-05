import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
        N
      </span>
      <span className="leading-tight">
        <span className="block text-base font-semibold text-primary-dark">NAAP</span>
        <span className="block text-xs text-muted">Mentorias</span>
      </span>
    </Link>
  );
}
