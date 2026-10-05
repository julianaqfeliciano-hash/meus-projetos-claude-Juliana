import type { Metadata } from "next";
import { AuthCard } from "../AuthCard";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Entrar" };

const reasons: Record<string, string> = {
  "outra-sessao":
    "Sua conta foi acessada em outro aparelho e esta sessão foi encerrada. Cada conta pode ficar conectada em apenas um aparelho por vez.",
  saiu: "Você saiu da sua conta.",
  "link-invalido": "O link expirou ou já foi usado. Entre novamente ou solicite um novo link.",
};

export default async function SignInPage(props: PageProps<"/entrar">) {
  const { motivo } = await props.searchParams;
  const notice = typeof motivo === "string" ? reasons[motivo] : undefined;
  return (
    <AuthCard title="Entrar" subtitle="Acesse a área de mentorias do NAAP.">
      {notice && <p className="mb-4 rounded-lg bg-soft px-3 py-2 text-sm text-primary">{notice}</p>}
      <SignInForm />
    </AuthCard>
  );
}
