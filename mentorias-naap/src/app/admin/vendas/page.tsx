import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteSale } from "../actions";
import { SaleForm } from "../SaleForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatBRL, formatDate } from "@/lib/format";
import { paymentMethods, type Module, type Profile, type Sale } from "@/lib/types";

export const metadata: Metadata = { title: "Vendas" };

export default async function SalesPage() {
  const db = createAdminClient();
  const [{ data: sales }, { data: students }, { data: modules }, { data: access }] = await Promise.all([
    db.from("sales").select("*").order("sold_on", { ascending: false }).order("created_at", { ascending: false }).limit(200).returns<Sale[]>(),
    db.from("profiles").select("*").eq("role", "student").neq("status", "rejected").order("full_name").returns<Profile[]>(),
    db.from("modules").select("*").order("position").returns<Module[]>(),
    db.from("module_access").select("module_id, sale_id").not("sale_id", "is", null),
  ]);
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const moduleTitle = new Map((modules ?? []).map((m) => [m.id, m.title]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary-dark">Vendas presenciais</h1>
        <a download href="/admin/exportar/vendas" className="btn-outline">Exportar CSV</a>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Registrar nova venda</h2>
        <p className="mb-4 text-sm text-muted">
          O aluno precisa ter se cadastrado no site antes. Ao registrar, os módulos escolhidos são liberados na hora.
        </p>
        <SaleForm
          students={(students ?? []).map((s) => ({ id: s.id, label: `${s.full_name || "(sem nome)"} — ${s.email}` }))}
          modules={(modules ?? []).map((m) => ({ id: m.id, label: m.title }))}
        />
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Últimas vendas</h2>
        <table className="table">
          <thead><tr><th>Data</th><th>Aluno</th><th>Módulos</th><th>Pagamento</th><th className="text-right">Valor</th><th /></tr></thead>
          <tbody>
            {(sales ?? []).map((s) => {
              const st = studentById.get(s.student_id);
              return (
                <tr key={s.id}>
                  <td className="whitespace-nowrap">{formatDate(s.sold_on)}</td>
                  <td>{st ? <Link href={`/admin/alunos/${st.id}`} className="text-primary hover:underline">{st.full_name || st.email}</Link> : "—"}</td>
                  <td>{(access ?? []).filter((a) => a.sale_id === s.id).map((a) => moduleTitle.get(a.module_id)).join(", ") || "—"}</td>
                  <td>{paymentMethods[s.payment_method] ?? s.payment_method}</td>
                  <td className="text-right whitespace-nowrap">{formatBRL(s.amount_cents)}</td>
                  <td className="text-right">
                    <form action={deleteSale.bind(null, s.id)}>
                      <ConfirmButton message="Excluir este registro de venda? O acesso aos módulos é mantido." className="text-xs text-red-700 hover:underline">Excluir</ConfirmButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {(sales ?? []).length === 0 && <tr><td colSpan={6} className="text-muted">Nenhuma venda registrada.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
