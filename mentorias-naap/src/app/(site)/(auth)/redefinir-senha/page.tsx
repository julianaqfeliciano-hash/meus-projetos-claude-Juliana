import type { Metadata } from "next";
import { AuthCard } from "../AuthCard";
import { PasswordForm } from "@/components/PasswordForm";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage() {
  await requireUser();
  return (
    <AuthCard title="Criar nova senha">
      <PasswordForm />
    </AuthCard>
  );
}
