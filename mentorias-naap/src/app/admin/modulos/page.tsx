import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ModuleForm } from "./ModuleForm";
import type { Module } from "@/lib/types";

export const metadata: Metadata = { title: "Módulos" };

export default async function ModulesPage() {
  const db = createAdminClient();
  const [{ data: modules }, { data: videos }, { data: access }] = await Promise.all([
    db.from("modules").select("*").order("position").order("created_at").returns<Module[]>(),
    db.from("videos").select("module_id"),
    db.from("module_access").select("module_id"),
  ]);
  const count = (rows: { module_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.module_id === id).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary-dark">Módulos de mentoria</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(modules ?? []).map((m) => (
          <Link key={m.id} href={`/admin/modulos/${m.id}`} className="card block hover:border-primary">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-primary-dark">{m.title}</h2>
              {!m.published && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">Rascunho</span>}
            </div>
            <p className="mt-2 text-sm text-muted">
              {count(videos, m.id)} vídeo(s) · {count(access, m.id)} aluno(s) com acesso
            </p>
          </Link>
        ))}
      </div>
      <section className="card max-w-2xl">
        <h2 className="mb-4 font-semibold">Novo módulo</h2>
        <ModuleForm />
      </section>
    </div>
  );
}
