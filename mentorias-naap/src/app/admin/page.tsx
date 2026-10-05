import type { Metadata } from "next";
import Link from "next/link";
import {
  activeStudentCount,
  filterSales,
  loadReportData,
  monthLabel,
  moduleStats,
  salesByMethod,
  salesByMonth,
  studentStats,
  videoStats,
} from "@/lib/reports";
import { formatBRL, formatDateTime, formatDuration } from "@/lib/format";
import { paymentMethods } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage(props: PageProps<"/admin">) {
  const sp = await props.searchParams;
  const from = typeof sp.de === "string" ? sp.de : "";
  const to = typeof sp.ate === "string" ? sp.ate : "";

  const data = await loadReportData();
  const sales = filterSales(data.sales, from, to);
  const students = studentStats(data);
  const videos = videoStats(data);
  const modules = moduleStats(data);
  const months = salesByMonth(sales).slice(0, 12);
  const methods = salesByMethod(sales);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  const count = (status: string) => data.students.filter((s) => s.status === status).length;
  const revenue = sales.reduce((sum, s) => sum + s.amount_cents, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const revenueMonth = data.sales.filter((s) => s.sold_on.startsWith(thisMonth)).reduce((sum, s) => sum + s.amount_cents, 0);
  const totalWatched = data.progress.reduce((sum, p) => sum + p.seconds_watched, 0);
  const activeStudents = activeStudentCount(data, 30);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Relatórios</h1>
          <p className="text-sm text-muted">Visão geral de alunos, vendas presenciais e audiência das mentorias.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <div>
            <label className="label" htmlFor="de">Vendas de</label>
            <input className="input" type="date" id="de" name="de" defaultValue={from} />
          </div>
          <div>
            <label className="label" htmlFor="ate">até</label>
            <input className="input" type="date" id="ate" name="ate" defaultValue={to} />
          </div>
          <button className="btn-primary">Filtrar</button>
          {(from || to) && <Link href="/admin" className="btn-outline">Limpar</Link>}
        </form>
      </div>

      {count("pending") > 0 && (
        <Link href="/admin/alunos?status=pending" className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          ⏳ {count("pending")} cadastro(s) aguardando aprovação — clique para revisar.
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={from || to ? "Vendas no período" : "Vendas (total)"} value={formatBRL(revenue)} hint={`${sales.length} venda(s)`} />
        <Stat label="Vendas neste mês" value={formatBRL(revenueMonth)} />
        <Stat label="Alunos aprovados" value={String(count("approved"))} hint={`${count("pending")} aguardando · ${data.students.length} cadastrados`} />
        <Stat label="Alunos ativos (30 dias)" value={String(activeStudents)} hint={`${formatDuration(totalWatched)} assistidos no total`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Vendas por mês</h2>
            <a download href={`/admin/exportar/vendas?de=${from}&ate=${to}`} className="text-sm text-primary hover:underline">Exportar CSV</a>
          </div>
          {months.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma venda registrada no período.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Mês</th><th className="w-1/2">Faturamento</th><th className="text-right">Vendas</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="hover:bg-soft/60" title={`${monthLabel(m.month)}: ${formatBRL(m.total)} em ${m.count} venda(s)`}>
                    <td className="whitespace-nowrap capitalize">{monthLabel(m.month)}</td>
                    <td>
                      <div className="h-3 rounded-r bg-soft">
                        <div className="h-3 rounded-r-[4px] bg-primary" style={{ width: `${(m.total / maxMonth) * 100}%` }} />
                      </div>
                    </td>
                    <td className="text-right">{m.count}</td>
                    <td className="text-right whitespace-nowrap">{formatBRL(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h2 className="mb-4 font-semibold">Por forma de pagamento</h2>
          {methods.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <table className="table">
              <tbody>
                {methods.map((m) => (
                  <tr key={m.method}>
                    <td>{paymentMethods[m.method] ?? m.method}</td>
                    <td className="text-right">{m.count}</td>
                    <td className="text-right whitespace-nowrap">{formatBRL(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-4 font-semibold">Módulos</h2>
        <table className="table">
          <thead>
            <tr><th>Módulo</th><th className="text-right">Vídeos</th><th className="text-right">Alunos com acesso</th><th className="text-right">Via venda</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/admin/modulos/${m.id}`} className="text-primary hover:underline">{m.title}</Link></td>
                <td className="text-right">{m.videos}</td>
                <td className="text-right">{m.students}</td>
                <td className="text-right">{m.soldAccesses}</td>
                <td>{m.published ? "Publicado" : "Rascunho"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Vídeos mais assistidos</h2>
          <a download href="/admin/exportar/videos" className="text-sm text-primary hover:underline">Exportar CSV</a>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Vídeo</th><th>Módulo</th>
              <th className="text-right">Alunos que assistiram</th>
              <th className="text-right">Visualizações</th>
              <th className="text-right">% médio assistido</th>
              <th className="text-right">Concluíram</th>
              <th className="text-right">Tempo total</th>
            </tr>
          </thead>
          <tbody>
            {videos.slice(0, 15).map((v) => (
              <tr key={v.id}>
                <td>{v.title}</td>
                <td className="text-muted">{v.moduleTitle}</td>
                <td className="text-right">{v.viewers} / {v.eligible}</td>
                <td className="text-right">{v.views}</td>
                <td className="text-right">{v.avgPercent}%</td>
                <td className="text-right">{v.completed}</td>
                <td className="text-right whitespace-nowrap">{formatDuration(v.secondsWatched)}</td>
              </tr>
            ))}
            {videos.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum vídeo cadastrado.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Alunos — último acesso e engajamento</h2>
          <a download href="/admin/exportar/alunos" className="text-sm text-primary hover:underline">Exportar CSV</a>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Aluno</th><th>Situação</th>
              <th className="text-right">Módulos</th>
              <th className="text-right">Vídeos iniciados</th>
              <th className="text-right">Concluídos</th>
              <th className="text-right">% médio</th>
              <th className="text-right">Tempo assistido</th>
              <th>Último acesso</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/admin/alunos/${s.id}`} className="text-primary hover:underline">{s.full_name || s.email}</Link>
                  <span className="block text-xs text-muted">{s.email}</span>
                </td>
                <td><StatusBadge status={s.status} /></td>
                <td className="text-right">{s.modules}</td>
                <td className="text-right">{s.videosStarted}</td>
                <td className="text-right">{s.videosCompleted}</td>
                <td className="text-right">{s.avgPercent}%</td>
                <td className="text-right whitespace-nowrap">{formatDuration(s.secondsWatched)}</td>
                <td className="whitespace-nowrap">{formatDateTime(s.lastAccess)}</td>
              </tr>
            ))}
            {students.length === 0 && <tr><td colSpan={8} className="text-muted">Nenhum aluno cadastrado.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-medium text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
