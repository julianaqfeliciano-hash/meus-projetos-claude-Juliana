import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimActiveSession } from "@/lib/session";

// Destino dos links enviados por e-mail (confirmação de cadastro e nova senha).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/mentorias";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/mentorias";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      await claimActiveSession(supabase, data.session);
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
  }
  return NextResponse.redirect(new URL("/entrar?motivo=link-invalido", request.url));
}
