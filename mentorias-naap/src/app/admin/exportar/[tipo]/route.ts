import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { filterSales, loadReportData, studentStats, videoStats } from "@/lib/reports";
import { formatDate, formatDateTime, toCsv } from "@/lib/format";
import { paymentMethods, statusLabel } from "@/lib/types";

export async function GET(request: NextRequest, ctx: RouteContext<"/admin/exportar/[tipo]">) {
  const session = await getSessionContext();
  if (session?.profile.role !== "admin" || session.profile.active_session_id !== session.sessionId) {
    return new NextResponse("Não autorizado", { status: 403 });
  }

  const { tipo } = await ctx.params;
  const data = await loadReportData();
  const names = new Map(data.students.map((s) => [s.id, s]));
  const moduleTitle = new Map(data.modules.map((m) => [m.id, m.title]));
  let rows: (string | number | null)[][];

  if (tipo === "alunos") {
    rows = [
      ["Nome", "E-mail", "Telefone", "Situação", "Cadastro", "Módulos", "Total pago (R$)", "Vídeos iniciados", "Vídeos concluídos", "% médio", "Minutos assistidos", "Último acesso"],
      ...studentStats(data).map((s) => [
        s.full_name, s.email, s.phone, statusLabel[s.status], formatDate(s.created_at), s.modules,
        (s.paid / 100).toFixed(2).replace(".", ","), s.videosStarted, s.videosCompleted, s.avgPercent,
        Math.round(s.secondsWatched / 60), formatDateTime(s.lastAccess),
      ]),
    ];
  } else if (tipo === "vendas") {
    const sp = request.nextUrl.searchParams;
    const sales = filterSales(data.sales, sp.get("de") || undefined, sp.get("ate") || undefined);
    rows = [
      ["Data", "Aluno", "E-mail", "Módulos", "Valor (R$)", "Forma de pagamento", "Observações"],
      ...sales.map((s) => [
        formatDate(s.sold_on),
        names.get(s.student_id)?.full_name ?? "",
        names.get(s.student_id)?.email ?? "",
        data.access.filter((a) => a.sale_id === s.id).map((a) => moduleTitle.get(a.module_id)).join(", "),
        (s.amount_cents / 100).toFixed(2).replace(".", ","),
        paymentMethods[s.payment_method] ?? s.payment_method,
        s.notes,
      ]),
    ];
  } else if (tipo === "videos") {
    rows = [
      ["Vídeo", "Módulo", "Gravado em", "Alunos que assistiram", "Alunos com acesso", "Visualizações", "% médio assistido", "Concluíram", "Minutos assistidos"],
      ...videoStats(data).map((v) => [
        v.title, v.moduleTitle, formatDate(v.recorded_on), v.viewers, v.eligible, v.views, v.avgPercent, v.completed,
        Math.round(v.secondsWatched / 60),
      ]),
    ];
  } else {
    return new NextResponse("Relatório desconhecido", { status: 404 });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
