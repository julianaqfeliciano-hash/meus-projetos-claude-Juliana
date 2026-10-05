"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, undefined);
  if (state?.success) return <FormMessage state={state} />;

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="full_name">Nome completo</label>
        <input className="input" id="full_name" name="full_name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="phone">Telefone (WhatsApp)</label>
        <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(85) 90000-0000" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirmar senha</label>
          <input className="input" id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" className="mt-1" required />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="text-primary underline">Termos de uso</Link> e a{" "}
          <Link href="/privacidade" target="_blank" className="text-primary underline">Política de privacidade</Link>.
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Cadastrando...">Criar conta</SubmitButton>
      <p className="text-center text-sm">
        Já tem conta? <Link href="/entrar" className="text-primary hover:underline">Entrar</Link>
      </p>
    </form>
  );
}
