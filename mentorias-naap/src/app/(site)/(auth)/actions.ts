"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimActiveSession } from "@/lib/session";
import { sendNewSignupEmail } from "@/lib/email";
import { siteUrl } from "@/lib/config";
import type { ActionState } from "@/lib/action-state";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const fullName = str(form, "full_name");
  const email = str(form, "email").toLowerCase();
  const phone = str(form, "phone");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (fullName.length < 3) return { error: "Informe seu nome completo." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Informe um telefone com DDD." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };
  if (form.get("terms") !== "on")
    return { error: "Para continuar, aceite os Termos de uso e a Política de privacidade." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, accepted_terms_at: new Date().toISOString() },
      emailRedirectTo: siteUrl("/auth/callback?next=/aguardando"),
    },
  });

  if (error) {
    if (/already|registered/i.test(error.message))
      return { error: "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha." };
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }

  // Supabase devolve um usuário sem identidades quando o e-mail já existe.
  if (data.user && data.user.identities?.length === 0)
    return { error: "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha." };

  await sendNewSignupEmail(fullName, email);

  if (!data.session) {
    return {
      success:
        "Cadastro recebido! Enviamos um e-mail para confirmar seu endereço. Depois disso, aguarde a aprovação da administração.",
    };
  }

  await claimActiveSession(supabase, data.session);
  redirect("/aguardando");
}

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error && /confirm/i.test(error.message))
      return { error: "Confirme seu e-mail pelo link que enviamos antes de entrar." };
    return { error: "E-mail ou senha incorretos." };
  }

  const userId = await claimActiveSession(supabase, data.session);
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role, status")
    .eq("id", userId!)
    .single();

  if (profile?.role === "admin") redirect("/admin");
  if (profile?.status === "approved") redirect("/mentorias");
  redirect("/aguardando");
}

export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  const email = str(form, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe um e-mail válido." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteUrl("/auth/callback?next=/redefinir-senha"),
  });
  // Mesma resposta exista ou não a conta, para não revelar quem é cadastrado.
  return { success: "Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha." };
}

export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Não foi possível alterar a senha. Solicite um novo link." };
  return { success: "Senha alterada com sucesso." };
}
