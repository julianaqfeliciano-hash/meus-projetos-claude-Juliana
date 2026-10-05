import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

const steps = [
  ["1", "Cadastre-se", "Crie sua conta com e-mail e senha."],
  ["2", "Aguarde a aprovação", "A equipe NAAP libera os módulos que você adquiriu."],
  ["3", "Assista quando quiser", "As gravações ficam disponíveis sem prazo de expiração."],
];

export default async function HomePage() {
  const ctx = await getSessionContext();
  if (ctx) redirect(ctx.profile.role === "admin" ? "/admin" : "/mentorias");

  return (
    <>
      <section className="hero relative overflow-hidden text-white">
        {/* Círculos decorativos, como as fotos redondas do site */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full border-[10px] border-white/15" />
        <div aria-hidden className="pointer-events-none absolute -right-10 bottom-[-120px] h-72 w-72 rounded-full bg-white/10" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h1 className="max-w-2xl text-3xl leading-tight font-bold sm:text-5xl sm:leading-tight">
            Mentorias NAAP — Núcleo de Atendimento e Avaliação Psicológica
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/90">
            Reveja as gravações das mentorias dos módulos que você adquiriu, no seu ritmo, com acesso
            permanente e materiais de apoio.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/cadastro" className="btn-light">
              <CheckIcon /> Criar minha conta
            </Link>
            <Link href="/entrar" className="inline-flex items-center justify-center rounded-xl border-2 border-white/70 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold text-primary">Como funciona</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {steps.map(([n, title, text]) => (
            <div key={n} className="card text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-soft text-xl font-bold text-brand">
                {n}
              </span>
              <h3 className="mt-3 font-semibold text-primary">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </svg>
  );
}
