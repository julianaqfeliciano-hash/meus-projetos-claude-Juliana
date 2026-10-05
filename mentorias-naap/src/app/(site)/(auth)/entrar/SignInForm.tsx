"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";

export function SignInForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Senha</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Entrando...">Entrar</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/esqueci-senha" className="text-primary hover:underline">Esqueci minha senha</Link>
        <Link href="/cadastro" className="text-primary hover:underline">Criar conta</Link>
      </div>
    </form>
  );
}
