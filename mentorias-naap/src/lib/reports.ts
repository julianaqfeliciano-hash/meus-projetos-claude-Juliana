import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { percent } from "@/lib/format";
import type { Module, Profile, Sale, Video, VideoProgress } from "@/lib/types";

type Access = { student_id: string; module_id: string; sale_id: string | null; granted_at: string };

/** Carrega tudo o que os relatórios usam. O volume do NAAP é pequeno, então
 *  as contas são feitas aqui mesmo, sem consultas especiais no banco. */
export async function loadReportData() {
  const db = createAdminClient();
  const [profiles, modules, videos, sales, access, progress] = await Promise.all([
    db.from("profiles").select("*").eq("role", "student").order("created_at", { ascending: false }).returns<Profile[]>(),
    db.from("modules").select("*").order("position").order("created_at").returns<Module[]>(),
    db.from("videos").select("*").order("position").returns<Video[]>(),
    db.from("sales").select("*").order("sold_on", { ascending: false }).returns<Sale[]>(),
    db.from("module_access").select("*").returns<Access[]>(),
    db.from("video_progress").select("*").returns<VideoProgress[]>(),
  ]);
  return {
    students: profiles.data ?? [],
    modules: modules.data ?? [],
    videos: videos.data ?? [],
    sales: sales.data ?? [],
    access: access.data ?? [],
    progress: progress.data ?? [],
  };
}

export type ReportData = Awaited<ReturnType<typeof loadReportData>>;

export function studentStats(data: ReportData) {
  return data.students.map((s) => {
    const mine = data.progress.filter((p) => p.student_id === s.id);
    const modules = data.access.filter((a) => a.student_id === s.id).length;
    const paid = data.sales.filter((x) => x.student_id === s.id).reduce((sum, x) => sum + x.amount_cents, 0);
    const avg = mine.length
      ? Math.round(mine.reduce((sum, p) => sum + percent(p.max_position, p.duration), 0) / mine.length)
      : 0;
    const lastWatch = mine.reduce<string | null>((max, p) => (!max || p.last_watched_at > max ? p.last_watched_at : max), null);
    return {
      ...s,
      modules,
      paid,
      videosStarted: mine.length,
      videosCompleted: mine.filter((p) => percent(p.max_position, p.duration) >= 90).length,
      avgPercent: avg,
      secondsWatched: mine.reduce((sum, p) => sum + p.seconds_watched, 0),
      lastAccess: [s.last_seen_at, lastWatch].filter(Boolean).sort().at(-1) ?? null,
    };
  });
}

export function videoStats(data: ReportData) {
  const moduleTitle = new Map(data.modules.map((m) => [m.id, m.title]));
  return data.videos
    .map((v) => {
      const rows = data.progress.filter((p) => p.video_id === v.id);
      const eligible = data.access.filter((a) => a.module_id === v.module_id).length;
      return {
        ...v,
        moduleTitle: moduleTitle.get(v.module_id) ?? "—",
        viewers: rows.length,
        eligible,
        views: rows.reduce((sum, p) => sum + p.view_count, 0),
        completed: rows.filter((p) => percent(p.max_position, p.duration) >= 90).length,
        avgPercent: rows.length
          ? Math.round(rows.reduce((sum, p) => sum + percent(p.max_position, p.duration), 0) / rows.length)
          : 0,
        secondsWatched: rows.reduce((sum, p) => sum + p.seconds_watched, 0),
      };
    })
    .sort((a, b) => b.viewers - a.viewers || b.views - a.views);
}

export function moduleStats(data: ReportData) {
  return data.modules.map((m) => {
    const acc = data.access.filter((a) => a.module_id === m.id);
    return {
      ...m,
      students: acc.length,
      soldAccesses: acc.filter((a) => a.sale_id).length,
      videos: data.videos.filter((v) => v.module_id === m.id).length,
    };
  });
}

/** Vendas agrupadas por mês (AAAA-MM), mais recente primeiro. */
export function salesByMonth(sales: Sale[]) {
  const map = new Map<string, { count: number; total: number }>();
  for (const s of sales) {
    const key = s.sold_on.slice(0, 7);
    const row = map.get(key) ?? { count: 0, total: 0 };
    row.count++;
    row.total += s.amount_cents;
    map.set(key, row);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({ month, ...v }));
}

export function salesByMethod(sales: Sale[]) {
  const map = new Map<string, { count: number; total: number }>();
  for (const s of sales) {
    const row = map.get(s.payment_method) ?? { count: 0, total: 0 };
    row.count++;
    row.total += s.amount_cents;
    map.set(s.payment_method, row);
  }
  return [...map.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total);
}

export function filterSales(sales: Sale[], from?: string, to?: string) {
  return sales.filter((s) => (!from || s.sold_on >= from) && (!to || s.sold_on <= to));
}

export function monthLabel(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1, 15).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

/** Alunos que assistiram a algo nos últimos `days` dias. */
export function activeStudentCount(data: ReportData, days: number) {
  const cutoff = Date.now() - days * 864e5;
  return new Set(
    data.progress.filter((p) => new Date(p.last_watched_at).getTime() >= cutoff).map((p) => p.student_id),
  ).size;
}
