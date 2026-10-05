import type { Metadata } from "next";
import { AuthCard } from "../AuthCard";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      <ForgotForm />
    </AuthCard>
  );
}
