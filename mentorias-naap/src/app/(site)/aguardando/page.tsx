import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/config";

export const metadata: Metadata = { title: "Aguardando aprovação" };

export default async function PendingPage() {
  const { profile } = await requireUser();
  if (profile.role === "admin") redirect("/admin");
  if (profile.status === "approved") redirect("/mentorias");

  const refused = profile.status === "rejected" || profile.status === "blocked";
  return (
    <div className="mx-auto max-w-lg card p-8 text-center">
      <h1 className="text-2xl font-semibold text-primary-dark">
        {refused ? "Acesso não liberado" : "Cadastro recebido!"}
      </h1>
      <p className="mt-3 text-muted">
        {refused
          ? "Seu acesso à plataforma não está liberado no momento."
          : "Seu cadastro está aguardando a aprovação da administração do NAAP. Você receberá um e-mail assim que for aprovado."}
      </p>
      <p className="mt-6 text-sm text-muted">
        Dúvidas? Fale com a gente: {brand.email} · {brand.phone}
      </p>
    </div>
  );
}
