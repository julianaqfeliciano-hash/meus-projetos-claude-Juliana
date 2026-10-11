"use client";

import { requestPasswordReset } from "../actions";
import { useActionForm } from "@/lib/use-action-form";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";

export function ForgotForm() {
  const { state, onSubmit, pending } = useActionForm(requestPasswordReset);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="btn-primary w-full" pendingText="Enviando...">Enviar link</SubmitButton>
    </form>
  );
}
