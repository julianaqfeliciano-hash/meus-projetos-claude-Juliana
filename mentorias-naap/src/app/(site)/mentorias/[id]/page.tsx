import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/lib/config";
import { formatDate, percent } from "@/lib/format";
import type { Module, Video, VideoProgress } from "@/lib/types";

export default async function ModulePage(props: PageProps<"/mentorias/[id]">) {
  const { id } = await props.params;
  const { profile } = await requireStudent();
  const supabase = await createClient();

  const { data: mod } = await supabase.from("modules").select("*").eq("id", id).maybeSingle<Module>();
  if (!mod) notFound();

  const { data: access } = await supabase
    .from("module_access")
    .select("module_id")
    .eq("student_id", profile.id)
    .eq("module_id", id)
    .maybeSingle();
  const canWatch = Boolean(access) || profile.role === "admin";

  const [{ data: videos }, { data: progress }] = await Promise.all([
    supabase.from("videos").select("*").eq("module_id", id).eq("published", true).order("position").order("recorded_on").returns<Video[]>(),
    supabase.from("video_progress").select("*").eq("student_id", profile.id).returns<VideoProgress[]>(),
  ]);
  const progressByVideo = new Map((progress ?? []).map((p) => [p.video_id, p]));

  return (
    <div className="space-y-6">
      <Link href="/mentorias" className="text-sm text-primary hover:underline">← Minhas mentorias</Link>
      <div>
        <h1 className="text-2xl font-bold text-primary">{mod.title}</h1>
        {mod.description && <p className="mt-1 whitespace-pre-line text-muted">{mod.description}</p>}
      </div>

      {!canWatch ? (
        <div className="card text-center text-muted">
          🔒 Você ainda não tem acesso a este módulo. Para adquirir, fale com o NAAP: {brand.phone}
        </div>
      ) : (videos ?? []).length === 0 ? (
        <div className="card text-center text-muted">Os vídeos deste módulo serão publicados em breve.</div>
      ) : (
        <ol className="space-y-3">
          {(videos ?? []).map((v, i) => {
            const p = progressByVideo.get(v.id);
            const pct = p ? percent(p.max_position, p.duration) : 0;
            return (
              <li key={v.id}>
                <Link href={`/assistir/${v.id}`} className="card flex items-center gap-4 transition hover:border-primary">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-soft font-semibold text-primary">
                    {pct >= 90 ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{v.title}</span>
                    <span className="block text-xs text-muted">
                      {v.recorded_on && <>Gravado em {formatDate(v.recorded_on)} · </>}
                      {v.duration_minutes && <>{v.duration_minutes} min · </>}
                      {v.pdf_path && <>📎 material em PDF · </>}
                      {p ? `${pct}% assistido` : "Não assistido"}
                    </span>
                  </span>
                  <span className="btn-primary hidden sm:inline-flex">{p ? "Continuar" : "Assistir"}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
