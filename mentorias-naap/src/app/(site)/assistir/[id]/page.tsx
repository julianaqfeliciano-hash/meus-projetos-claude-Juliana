import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/lib/config";
import { formatDate, percent } from "@/lib/format";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { Module, Video, VideoProgress } from "@/lib/types";

export default async function WatchPage(props: PageProps<"/assistir/[id]">) {
  const { id } = await props.params;
  const { profile } = await requireStudent();
  const supabase = await createClient();

  // As regras do banco só devolvem o vídeo se o aluno tiver acesso ao módulo.
  const { data: video } = await supabase.from("videos").select("*").eq("id", id).maybeSingle<Video>();
  if (!video) notFound();

  const [{ data: mod }, { data: siblings }, { data: progress }] = await Promise.all([
    supabase.from("modules").select("*").eq("id", video.module_id).single<Module>(),
    supabase.from("videos").select("id, title, position, recorded_on").eq("module_id", video.module_id).eq("published", true).order("position").order("recorded_on"),
    supabase.from("video_progress").select("*").eq("student_id", profile.id).eq("video_id", id).maybeSingle<VideoProgress>(),
  ]);

  const pct = progress ? percent(progress.max_position, progress.duration) : 0;
  const start = progress && pct < 95 ? Math.max(0, progress.max_position - 5) : 0;
  const list = siblings ?? [];
  const index = list.findIndex((v) => v.id === id);
  const next = index >= 0 ? list[index + 1] : undefined;

  return (
    <div className="space-y-5">
      <Link href={`/mentorias/${video.module_id}`} className="text-sm text-primary hover:underline">
        ← {mod?.title ?? "Voltar"}
      </Link>

      <VideoPlayer
        videoId={video.id}
        youtubeId={video.youtube_id}
        startSeconds={start}
        watermark={[brand.name, brand.email, brand.phone]}
        trackProgress={profile.role !== "admin"}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary-dark">{video.title}</h1>
          <p className="text-sm text-muted">
            {video.recorded_on && <>Gravado em {formatDate(video.recorded_on)}</>}
            {start > 0 && <> · Continuando de onde você parou</>}
          </p>
          {video.description && <p className="mt-3 whitespace-pre-line text-sm">{video.description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {video.pdf_path && (
            <a href={`/material/${video.id}`} target="_blank" rel="noopener" className="btn-outline">
              📎 {video.pdf_name || "Material em PDF"}
            </a>
          )}
          {next && <Link href={`/assistir/${next.id}`} className="btn-primary">Próximo vídeo →</Link>}
        </div>
      </div>
    </div>
  );
}
