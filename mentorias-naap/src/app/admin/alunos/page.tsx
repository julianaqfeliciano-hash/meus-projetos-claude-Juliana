import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { setStudentStatus } from "../actions";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { statusLabel, type Profile, type ProfileStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Alunos" };

const filters: (ProfileStatus | "all")[] = ["pending", "approved", "blocked", "rejected", "all"];

export default async function StudentsPage(props: PageProps<"/admin/alunos">) {
  const sp = await props.searchParams;
  const status = (typeof sp.status === "string" ? sp.status : "all") as ProfileStatus | "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let query = createAdminClient().from("profiles").select("*").eq("role", "student").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,email.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: students } = await query.returns<Profile[]>();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary-dark">Alunos</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1 text-sm">
          {filters.map((f) => (
            <Link
              key={f}
              href={`/admin/alunos?status=${f}`}
              className={`rounded-lg px-3 py-1.5 ${status === f ? "bg-primary text-white" : "bg-white border border-line hover:bg-soft"}`}
            >
              {f === "all" ? "Todos" : statusLabel[f]}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input className="input" name="q" placeholder="Buscar nome ou e-mail" defaultValue={q} />
          <button className="btn-outline">Buscar</button>
        </form>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>Contato</th><th>Cadastro</th><th>Situação</th><th className="text-right">Ações</th></tr>
          </thead>
          <tbody>
            {(students ?? []).map((s) => (
              <tr key={s.id}>
                <td><Link href={`/admin/alunos/${s.id}`} className="font-medium text-primary hover:underline">{s.full_name || "(sem nome)"}</Link></td>
                <td className="text-xs">{s.email}<br />{s.phone}</td>
                <td className="whitespace-nowrap">{formatDate(s.created_at)}</td>
                <td><StatusBadge status={s.status} /></td>
                <td>
                  <div className="flex justify-end gap-2">
                    {s.status !== "approved" && (
                      <form action={setStudentStatus.bind(null, s.id, "approved")}>
                        <button className="btn-primary px-3 py-1">Aprovar</button>
                      </form>
                    )}
                    {s.status === "pending" && (
                      <form action={setStudentStatus.bind(null, s.id, "rejected")}>
                        <button className="btn-outline px-3 py-1">Recusar</button>
                      </form>
                    )}
                    <Link href={`/admin/alunos/${s.id}`} className="btn-outline px-3 py-1">Abrir</Link>
                  </div>
                </td>
              </tr>
            ))}
            {(students ?? []).length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-muted">Nenhum aluno encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
