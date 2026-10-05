import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteModule } from "../../actions";
import { ModuleForm } from "../ModuleForm";
import { VideoForm } from "../../VideoForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDate } from "@/lib/format";
import type { Module, Video } from "@/lib/types";

export default async function ModuleAdminPage(props: PageProps<"/admin/modulos/[id]">) {
  const { id } = await props.params;
  const db = createAdminClient();
  const { data: mod } = await db.from("modules").select("*").eq("id", id).maybeSingle<Module>();
  if (!mod) notFound();
  const { data: videos } = await db.from("videos").select("*").eq("module_id", id).order("position").order("recorded_on").returns<Video[]>();

  return (
    <div className="space-y-6">
      <Link href="/admin/modulos" className="text-sm text-primary hover:underline">← Módulos</Link>
      <h1 className="text-2xl font-bold text-primary">{mod.title}</h1>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Vídeos</h2>
        <table className="table">
          <thead><tr><th>Ordem</th><th>Título</th><th>Data</th><th>PDF</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {(videos ?? []).map((v) => (
              <tr key={v.id}>
                <td>{v.position}</td>
                <td>{v.title}</td>
                <td>{formatDate(v.recorded_on)}</td>
                <td>{v.pdf_path ? "📎" : "—"}</td>
                <td>{v.published ? "Publicado" : "Rascunho"}</td>
                <td className="text-right whitespace-nowrap">
                  <Link href={`/assistir/${v.id}`} className="text-primary hover:underline">Ver</Link>
                  {" · "}
                  <Link href={`/admin/modulos/${id}/videos/${v.id}`} className="text-primary hover:underline">Editar / PDF</Link>
                </td>
              </tr>
            ))}
            {(videos ?? []).length === 0 && <tr><td colSpan={6} className="text-muted">Nenhum vídeo neste módulo.</td></tr>}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">Adicionar vídeo</h2>
          <VideoForm moduleId={id} />
          <p className="mt-3 text-xs text-muted">Para anexar um PDF, salve o vídeo e clique em “Editar / PDF”.</p>
        </section>
        <section className="card space-y-6">
          <div>
            <h2 className="mb-4 font-semibold">Dados do módulo</h2>
            <ModuleForm module={mod} />
          </div>
          <form action={deleteModule.bind(null, id)} className="border-t border-line pt-4">
            <ConfirmButton message="Excluir este módulo, todos os seus vídeos, PDFs e acessos dos alunos? Esta ação não pode ser desfeita.">
              Excluir módulo
            </ConfirmButton>
          </form>
        </section>
      </div>
    </div>
  );
}
