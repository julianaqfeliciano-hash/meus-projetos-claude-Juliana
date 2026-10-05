import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  // Encerra apenas esta sessão (a outra, se houver, continua válida).
  await supabase.auth.signOut({ scope: "local" });
  const motivo = request.nextUrl.searchParams.get("motivo") ?? "saiu";
  return NextResponse.redirect(new URL(`/entrar?motivo=${encodeURIComponent(motivo)}`, request.url));
}

export const GET = signOut;

export async function POST(request: NextRequest) {
  const response = await signOut(request);
  // 303 faz o navegador seguir o redirecionamento com GET.
  return NextResponse.redirect(response.headers.get("location")!, 303);
}
