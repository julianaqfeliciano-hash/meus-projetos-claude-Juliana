import { LogoMark } from "@/components/Logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-white shadow-sm md:grid-cols-[1fr_1.1fr]">
      <div className="hero relative hidden flex-col justify-between overflow-hidden p-10 text-white md:flex">
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-32 h-64 w-64 rounded-full border-[10px] border-white/15" />
        <LogoMark variant="white" className="h-20 w-auto self-start" />
        <div className="relative">
          <p className="text-2xl leading-snug font-bold">Mentorias gravadas para você rever quando quiser.</p>
          <p className="mt-3 text-white/85">Ética, empatia e as melhores práticas da psicologia.</p>
        </div>
      </div>
      <div className="p-6 sm:p-10">
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
