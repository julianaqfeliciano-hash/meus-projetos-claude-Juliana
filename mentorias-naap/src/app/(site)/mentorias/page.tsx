import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/lib/config";
import { percent } from "@/lib/format";
import type { Module, Video, VideoProgress } from "@/lib/types";

export const metadata: Metadata = { title: "Minhas mentorias" };

export default async function MyModulesPage() {
  const { profile } = await requireStudent();
  const supabase = await createClient();

  const [{ data: modules }, { data: access }, { data: videos }, { data: progress }] = await Promise.all([
    supabase.from("modules").select("*").eq("published", true).order("position").order("created_at").returns<Module[]>(),
    supabase.from("module_access").select("module_id").eq("student_id", profile.id),
    supabase.from("videos").select("id, module_id, duration_minutes").eq("published", true).returns<Pick<Video, "id" | "module_id" | "duration_minutes">[]>(),
    supabase.from("video_progress").select("video_id, max_position, duration").eq("student_id", profile.id).returns<Pick<VideoProgress, "video_id" | "max_position" | "duration">[]>(),
  ]);

  const owned = new Set((access ?? []).map((a) => a.module_id));
  const progressByVideo = new Map((progress ?? []).map((p) => [p.video_id, p]));
  const mine = (modules ?? []).filter((m) => owned.has(m.id));
  const others = (modules ?? []).filter((m) => !owned.has(m.id));

  return (
    <div className="space-y-10">
      <div className="hero relative overflow-hidden rounded-3xl px-6 py-8 text-white sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full border-[8px] border-white/15" />
        <h1 className="relative text-2xl font-bold sm:text-3xl">
          Olá, {profile.full_name.split(" ")[0] || "aluno(a)"}!
        </h1>
        <p className="relative mt-1 text-white/90">Estas são as mentorias liberadas para você.</p>
      </div>

      {mine.length === 0 ? (
        <div className="card text-center text-muted">
          Nenhum módulo liberado ainda. Assim que a sua compra for registrada pela administração, os
          módulos aparecerão aqui.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((m) => {
            const list = (videos ?? []).filter((v) => v.module_id === m.id);
            const done = list.filter((v) => {
              const p = progressByVideo.get(v.id);
              return p && percent(p.max_position, p.duration) >= 90;
            }).length;
            return (
              <Link key={m.id} href={`/mentorias/${m.id}`} className="card block transition hover:border-primary hover:shadow-md">
                <h2 className="font-bold text-primary">{m.title}</h2>
                {m.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{m.description}</p>}
                <p className="mt-4 text-xs text-muted">
                  {list.length} {list.length === 1 ? "vídeo" : "vídeos"} · {done} concluído{done === 1 ? "" : "s"}
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-soft">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${percent(done, list.length)}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-primary">Outros módulos disponíveis</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((m) => (
              <div key={m.id} className="card bg-soft/40">
                <h3 className="font-semibold">{m.title}</h3>
                {m.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{m.description}</p>}
                <p className="mt-4 text-xs text-muted">
                  🔒 Para adquirir, fale com o NAAP: {brand.phone}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
