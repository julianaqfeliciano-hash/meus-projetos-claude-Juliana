import type { Metadata } from "next";
import { AuthCard } from "../AuthCard";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Cadastro" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Criar conta"
      subtitle="Após o cadastro, a administração do NAAP aprova seu acesso e libera os módulos adquiridos."
    >
      <SignUpForm />
    </AuthCard>
  );
}
