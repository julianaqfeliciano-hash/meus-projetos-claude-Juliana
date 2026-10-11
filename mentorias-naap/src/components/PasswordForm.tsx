"use client";

import { updatePassword } from "@/app/(site)/(auth)/actions";
import { useActionForm } from "@/lib/use-action-form";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";

export function PasswordForm() {
  const { state, onSubmit, pending } = useActionForm(updatePassword);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">Nova senha</label>
        <input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirmar nova senha</label>
        <input className="input" id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Salvando...">Salvar senha</SubmitButton>
    </form>
  );
}
