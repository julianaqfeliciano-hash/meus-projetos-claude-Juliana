"use client";

import { saveModule } from "../actions";
import { useActionForm } from "@/lib/use-action-form";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";
import type { Module } from "@/lib/types";

export function ModuleForm({ module }: { module?: Module }) {
  const { state, onSubmit, pending } = useActionForm(saveModule);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {module && <input type="hidden" name="id" value={module.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div>
          <label className="label" htmlFor="title">Título do módulo</label>
          <input className="input" id="title" name="title" defaultValue={module?.title} placeholder="Ex.: Módulo 1 — Avaliação psicológica" required />
        </div>
        <div>
          <label className="label" htmlFor="position">Ordem</label>
          <input className="input" id="position" name="position" type="number" defaultValue={module?.position ?? 0} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">Descrição</label>
        <textarea className="input" id="description" name="description" rows={3} defaultValue={module?.description} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={module?.published ?? true} /> Publicado (visível para os alunos)
      </label>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Salvando...">{module ? "Salvar módulo" : "Criar módulo"}</SubmitButton>
    </form>
  );
}
