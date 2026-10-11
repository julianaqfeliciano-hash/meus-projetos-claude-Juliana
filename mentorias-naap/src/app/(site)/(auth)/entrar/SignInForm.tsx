"use client";

import Link from "next/link";
import { signIn } from "../actions";
import { useActionForm } from "@/lib/use-action-form";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";

export function SignInForm() {
  const { state, onSubmit, pending } = useActionForm(signIn);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="btn-primary w-full" pendingText="Entrando...">Entrar</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/esqueci-senha" className="text-primary hover:underline">Esqueci minha senha</Link>
        <Link href="/cadastro" className="text-primary hover:underline">Criar conta</Link>
      </div>
    </form>
  );
}
