import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/config";
import { PasswordForm } from "@/components/PasswordForm";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const { profile } = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-primary-dark">Minha conta</h1>
      <section className="card space-y-4">
        <h2 className="font-semibold">Dados pessoais</h2>
        <p className="text-sm text-muted">E-mail: {profile.email}</p>
        <ProfileForm fullName={profile.full_name} phone={profile.phone} />
      </section>
      <section className="card space-y-4">
        <h2 className="font-semibold">Alterar senha</h2>
        <PasswordForm />
      </section>
      <section className="card text-sm text-muted">
        <h2 className="mb-2 font-semibold text-foreground">Seus dados (LGPD)</h2>
        Para solicitar uma cópia ou a exclusão dos seus dados, escreva para {brand.email}.
      </section>
    </div>
  );
}
