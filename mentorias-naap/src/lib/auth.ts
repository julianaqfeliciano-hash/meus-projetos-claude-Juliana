import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export type SessionContext = {
  userId: string;
  sessionId: string | null;
  profile: Profile;
};

/** Usuário logado e seu perfil, ou null. Não redireciona. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("*")
    .eq("id", claims.sub)
    .single<Profile>();
  if (!profile) return null;

  return {
    userId: claims.sub,
    sessionId: (claims.session_id as string | undefined) ?? null,
    profile,
  };
}

/** Garante que o usuário está logado e que esta é a sessão mais recente dele. */
export async function requireUser(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/entrar");

  if (ctx.profile.active_session_id && ctx.profile.active_session_id !== ctx.sessionId) {
    // A conta foi acessada em outro aparelho: encerra esta sessão.
    redirect("/sair?motivo=outra-sessao");
  }
  return ctx;
}

/** Aluno aprovado (ou administrador). */
export async function requireStudent(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin" && ctx.profile.status !== "approved") {
    redirect("/aguardando");
  }
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/mentorias");
  return ctx;
}
