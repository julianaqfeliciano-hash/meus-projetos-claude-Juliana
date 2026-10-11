"use client";

import { useEffect, useRef } from "react";
import { saveVideo } from "./actions";
import { useActionForm } from "@/lib/use-action-form";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";
import type { Video } from "@/lib/types";

export function VideoForm({ moduleId, video }: { moduleId: string; video?: Video }) {
  const { state, onSubmit, pending } = useActionForm(saveVideo);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success && !video) formRef.current?.reset();
  }, [state, video]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="module_id" value={moduleId} />
      {video && <input type="hidden" name="id" value={video.id} />}
      <div>
        <label className="label" htmlFor="title">Título</label>
        <input className="input" id="title" name="title" defaultValue={video?.title} placeholder="Ex.: Mentoria 05/10 — Estudo de caso" required />
      </div>
      <div>
        <label className="label" htmlFor="video_url">Link de incorporação do Panda Video</label>
        <input
          className="input"
          id="video_url"
          name="video_url"
          defaultValue={video?.video_url ?? ""}
          placeholder="https://player-vz-….tv.pandavideo.com.br/embed/?v=…"
          required
        />
        <p className="mt-1 text-xs text-muted">
          No Panda: abra o vídeo → Incorporar (embed) → copie o link ou o código &lt;iframe&gt; inteiro e cole aqui.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="recorded_on">Data da mentoria</label>
          <input className="input" id="recorded_on" name="recorded_on" type="date" defaultValue={video?.recorded_on ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="duration_minutes">Duração (min)</label>
          <input className="input" id="duration_minutes" name="duration_minutes" type="number" min="1" defaultValue={video?.duration_minutes ?? ""} required />
        </div>
        <div>
          <label className="label" htmlFor="position">Ordem</label>
          <input className="input" id="position" name="position" type="number" defaultValue={video?.position ?? 0} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">Descrição</label>
        <textarea className="input" id="description" name="description" rows={3} defaultValue={video?.description} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={video?.published ?? true} /> Publicado
      </label>
      {!video?.notified_at && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notify" defaultChecked /> Avisar por e-mail os alunos deste módulo
        </label>
      )}
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Salvando...">{video ? "Salvar vídeo" : "Adicionar vídeo"}</SubmitButton>
    </form>
  );
}
