import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Entrega o PDF de um vídeo por um link temporário, só para quem tem acesso.
export async function GET(request: NextRequest, ctx: RouteContext<"/material/[id]">) {
  const { id } = await ctx.params;
  const session = await getSessionContext();
  if (!session) return NextResponse.redirect(new URL("/entrar", request.url));

  // Consulta com o cliente do usuário: as regras do banco conferem o acesso.
  const supabase = await createClient();
  const { data: video } = await supabase.from("videos").select("pdf_path").eq("id", id).maybeSingle();
  if (!video?.pdf_path) return new NextResponse("Material não encontrado.", { status: 404 });

  const { data } = await createAdminClient().storage.from("materiais").createSignedUrl(video.pdf_path, 60);
  if (!data?.signedUrl) return new NextResponse("Material indisponível.", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
