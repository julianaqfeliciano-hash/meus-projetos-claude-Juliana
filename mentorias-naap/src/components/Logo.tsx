import Link from "next/link";

/**
 * Logo do NAAP redesenhado em vetor a partir do site oficial.
 * Para usar o arquivo original, salve-o em public/logo.png e troque o <svg>
 * por <img src="/logo.png" alt="NAAP" />.
 */
export function LogoMark({ variant = "color", className = "" }: { variant?: "color" | "white"; className?: string }) {
  const fill = variant === "white" ? "#ffffff" : "var(--naap-brand)";
  const cut = variant === "white" ? "var(--naap-hero-from)" : "#ffffff";
  return (
    <svg viewBox="0 0 170 94" className={className} role="img" aria-label="NAAP — Núcleo de Atendimento e Avaliação Psicológica">
      {/* Nuvem de pensamento */}
      <g fill={fill}>
        <circle cx="78" cy="14" r="9" />
        <circle cx="94" cy="11" r="8.5" />
        <circle cx="70" cy="21" r="6.5" />
        <circle cx="87" cy="22" r="7.5" />
        <circle cx="100" cy="19" r="6.5" />
        <circle cx="70.5" cy="30" r="2" />
        <circle cx="68" cy="33.5" r="1.3" />
      </g>
      <g fill="none" stroke={cut} strokeWidth="0.9" opacity="0.85">
        <circle cx="92" cy="15" r="7" />
        <circle cx="96" cy="20" r="5.5" />
        <circle cx="84" cy="11" r="6" />
      </g>
      {/* NAAP */}
      <g fill="none" stroke={fill} strokeWidth="5.6" strokeLinejoin="miter" strokeLinecap="butt">
        <path d="M6.8 63V40.5L29 62V40" />
        <path d="M40 63L57.5 39.5L75 63M47 55.5H68" />
        <path d="M82 63L99.5 39.5L117 63M89 55.5H110" />
        <path d="M131 63V41.8H150.5A7.9 7.9 0 0 1 150.5 57.6H131" />
      </g>
      <text x="4" y="76" fill={fill} fontSize="6.3" fontFamily="var(--font-plex), Arial, sans-serif">
        Núcleo de Atendimento e Avaliação Psicológica
      </text>
      <text x="4" y="85" fill={fill} fontSize="6.3" fontFamily="var(--font-plex), Arial, sans-serif">
        CRP 11/316
      </text>
    </svg>
  );
}

export function Logo({ href = "/", variant = "color" }: { href?: string; variant?: "color" | "white" }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <LogoMark variant={variant} className="h-14 w-auto sm:h-[76px]" />
      <span
        className={`hidden border-l pl-3 text-sm font-semibold sm:block ${variant === "white" ? "border-white/40 text-white" : "border-line text-primary"}`}
      >
        Mentorias
      </span>
    </Link>
  );
}
