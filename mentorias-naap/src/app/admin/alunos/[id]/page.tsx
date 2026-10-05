import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantAccess, revokeAccess, setStudentStatus, deleteSale } from "../../actions";
import { SaleForm } from "../../SaleForm";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatBRL, formatDate, formatDateTime, formatDuration, percent } from "@/lib/format";
import { paymentMethods, type Module, type Profile, type Sale, type Video, type VideoProgress } from "@/lib/types";

export default async function StudentPage(props: PageProps<"/admin/alunos/[id]">) {
  const { id } = await props.params;
  const db = createAdminClient();
  const { data: student } = await db.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!student) notFound();

  const [{ data: modules }, { data: access }, { data: sales }, { data: progress }, { data: videos }] = await Promise.all([
    db.from("modules").select("*").order("position").returns<Module[]>(),
    db.from("module_access").select("module_id, sale_id, granted_at").eq("student_id", id),
    db.from("sales").select("*").eq("student_id", id).order("sold_on", { ascending: false }).returns<Sale[]>(),
    db.from("video_progress").select("*").eq("student_id", id).order("last_watched_at", { ascending: false }).returns<VideoProgress[]>(),
    db.from("videos").select("id, title, module_id").returns<Pick<Video, "id" | "title" | "module_id">[]>(),
  ]);

  const accessByModule = new Map((access ?? []).map((a) => [a.module_id, a]));
  const videoById = new Map((videos ?? []).map((v) => [v.id, v]));
  const moduleTitle = new Map((modules ?? []).map((m) => [m.id, m.title]));
  const totalPaid = (sales ?? []).reduce((sum, s) => sum + s.amount_cents, 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/alunos" className="text-sm text-primary hover:underline">← Alunos</Link>

      <section className="card flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">{student.full_name || "(sem nome)"}</h1>
          <p className="text-sm text-muted">{student.email} · {student.phone}</p>
          <p className="mt-2 text-sm">
            <StatusBadge status={student.status} />{" "}
            <span className="text-muted">
              Cadastro em {formatDate(student.created_at)} · Último acesso {formatDateTime(student.last_seen_at)} · Termos aceitos em {formatDateTime(student.accepted_terms_at)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {student.status !== "approved" && (
            <form action={setStudentStatus.bind(null, id, "approved")}><button className="btn-primary">Aprovar</button></form>
          )}
          {student.status === "pending" && (
            <form action={setStudentStatus.bind(null, id, "rejected")}><button className="btn-outline">Recusar</button></form>
          )}
          {student.status !== "blocked" && (
            <form action={setStudentStatus.bind(null, id, "blocked")}>
              <ConfirmButton message="Bloquear este aluno? Ele será desconectado e perderá o acesso aos vídeos.">Bloquear</ConfirmButton>
            </form>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Acesso aos módulos</h2>
          <ul className="divide-y divide-line">
            {(modules ?? []).map((m) => {
              const a = accessByModule.get(m.id);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {m.title}
                    {a && <span className="block text-xs text-muted">Liberado em {formatDate(a.granted_at)}{a.sale_id ? " · via venda" : " · cortesia"}</span>}
                  </span>
                  {a ? (
                    <form action={revokeAccess.bind(null, id, m.id)}>
                      <ConfirmButton message={`Remover o acesso a "${m.title}"?`} className="btn-danger px-3 py-1">Remover</ConfirmButton>
                    </form>
                  ) : (
                    <form action={grantAccess.bind(null, id, m.id)}>
                      <button className="btn-outline px-3 py-1" title="Liberar sem registrar venda">Liberar (cortesia)</button>
                    </form>
                  )}
                </li>
              );
            })}
            {(modules ?? []).length === 0 && <li className="py-2 text-sm text-muted">Nenhum módulo cadastrado.</li>}
          </ul>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Registrar venda presencial</h2>
          <SaleForm
            studentId={id}
            modules={(modules ?? []).map((m) => ({ id: m.id, label: m.title }))}
            pendingApproval={student.status !== "approved"}
          />
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Compras · total {formatBRL(totalPaid)}</h2>
        <table className="table">
          <thead><tr><th>Data</th><th>Módulos</th><th>Pagamento</th><th className="text-right">Valor</th><th /></tr></thead>
          <tbody>
            {(sales ?? []).map((s) => (
              <tr key={s.id}>
                <td>{formatDate(s.sold_on)}</td>
                <td>
                  {(access ?? []).filter((a) => a.sale_id === s.id).map((a) => moduleTitle.get(a.module_id)).join(", ") || "—"}
                  {s.notes && <span className="block text-xs text-muted">{s.notes}</span>}
                </td>
                <td>{paymentMethods[s.payment_method] ?? s.payment_method}</td>
                <td className="text-right">{formatBRL(s.amount_cents)}</td>
                <td className="text-right">
                  <form action={deleteSale.bind(null, s.id)}>
                    <ConfirmButton message="Excluir este registro de venda? O acesso aos módulos é mantido." className="text-xs text-red-700 hover:underline">Excluir</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {(sales ?? []).length === 0 && <tr><td colSpan={5} className="text-muted">Nenhuma venda registrada.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Vídeos assistidos</h2>
        <table className="table">
          <thead><tr><th>Vídeo</th><th>Módulo</th><th className="text-right">% assistido</th><th className="text-right">Tempo</th><th className="text-right">Vezes</th><th>Última vez</th></tr></thead>
          <tbody>
            {(progress ?? []).map((p) => {
              const v = videoById.get(p.video_id);
              return (
                <tr key={p.video_id}>
                  <td>{v?.title ?? "—"}</td>
                  <td className="text-muted">{v ? moduleTitle.get(v.module_id) : "—"}</td>
                  <td className="text-right">{percent(p.max_position, p.duration)}%</td>
                  <td className="text-right">{formatDuration(p.seconds_watched)}</td>
                  <td className="text-right">{p.view_count}</td>
                  <td className="whitespace-nowrap">{formatDateTime(p.last_watched_at)}</td>
                </tr>
              );
            })}
            {(progress ?? []).length === 0 && <tr><td colSpan={6} className="text-muted">Ainda não assistiu a nenhum vídeo.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
