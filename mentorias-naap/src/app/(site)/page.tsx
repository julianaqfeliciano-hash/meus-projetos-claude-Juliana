import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

export default async function HomePage() {
  const ctx = await getSessionContext();
  if (ctx) redirect(ctx.profile.role === "admin" ? "/admin" : "/mentorias");

  return (
    <section className="mx-auto max-w-3xl py-10 text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-wide text-accent">NAAP Psicologia</p>
      <h1 className="text-3xl font-semibold text-primary-dark sm:text-4xl">
        Mentorias gravadas para você rever quando quiser
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-muted">
        Assista às gravações das mentorias dos módulos que você adquiriu, no seu ritmo, com acesso
        permanente e materiais de apoio.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/cadastro" className="btn-primary px-6 py-3 text-base">Criar minha conta</Link>
        <Link href="/entrar" className="btn-outline px-6 py-3 text-base">Já tenho conta</Link>
      </div>
      <div className="mt-12 grid gap-4 text-left sm:grid-cols-3">
        {[
          ["1. Cadastre-se", "Crie sua conta com e-mail e senha."],
          ["2. Aguarde a aprovação", "A equipe NAAP libera os módulos que você adquiriu."],
          ["3. Assista", "As gravações ficam disponíveis sem prazo de expiração."],
        ].map(([title, text]) => (
          <div key={title} className="card">
            <h2 className="font-semibold text-primary-dark">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
