import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteVideo } from "../../../../actions";
import { VideoForm } from "../../../../VideoForm";
import { PdfUpload } from "../../../../PdfUpload";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateTime } from "@/lib/format";
import type { Video } from "@/lib/types";

export default async function VideoAdminPage(props: PageProps<"/admin/modulos/[id]/videos/[videoId]">) {
  const { id, videoId } = await props.params;
  const { data: video } = await createAdminClient().from("videos").select("*").eq("id", videoId).eq("module_id", id).maybeSingle<Video>();
  if (!video) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/admin/modulos/${id}`} className="text-sm text-primary hover:underline">← Voltar ao módulo</Link>
      <h1 className="text-2xl font-bold text-primary">{video.title}</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">Dados do vídeo</h2>
          <VideoForm moduleId={id} video={video} />
          {video.notified_at && (
            <p className="mt-3 text-xs text-muted">Aviso por e-mail enviado em {formatDateTime(video.notified_at)}.</p>
          )}
        </section>
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-4 font-semibold">Material em PDF</h2>
            <PdfUpload videoId={video.id} currentName={video.pdf_path ? video.pdf_name || "material.pdf" : null} />
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">Excluir</h2>
            <form action={deleteVideo.bind(null, video.id, id)}>
              <ConfirmButton message="Excluir este vídeo e o progresso dos alunos nele? (O vídeo continua no YouTube.)">Excluir vídeo</ConfirmButton>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
