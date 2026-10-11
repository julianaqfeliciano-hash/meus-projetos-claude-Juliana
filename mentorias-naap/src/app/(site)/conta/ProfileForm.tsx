"use client";

import { updateProfile } from "./actions";
import { useActionForm } from "@/lib/use-action-form";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const { state, onSubmit, pending } = useActionForm(updateProfile);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="full_name">Nome completo</label>
        <input className="input" id="full_name" name="full_name" defaultValue={fullName} required />
      </div>
      <div>
        <label className="label" htmlFor="phone">Telefone</label>
        <input className="input" id="phone" name="phone" type="tel" defaultValue={phone} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Salvando...">Salvar</SubmitButton>
    </form>
  );
}
