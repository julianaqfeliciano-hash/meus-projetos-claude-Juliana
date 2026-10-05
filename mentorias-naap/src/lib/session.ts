import "server-only";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Marca a sessão recém-criada como a única válida para este usuário e encerra
 * as demais. Assim, se a conta for usada em outro aparelho, o anterior é
 * desconectado.
 */
export async function claimActiveSession(supabase: SupabaseClient, session: Session) {
  // Lê as claims do token novo (os cookies da requisição ainda têm o antigo).
  const { data } = await supabase.auth.getClaims(session.access_token);
  const claims = data?.claims;
  if (!claims?.sub || !claims.session_id) return null;

  const db = createAdminClient();
  await db
    .from("profiles")
    .update({ active_session_id: claims.session_id, last_seen_at: new Date().toISOString() })
    .eq("id", claims.sub);
  await db.rpc("revoke_other_sessions", { p_user: claims.sub, p_keep: claims.session_id });
  return claims.sub;
}
