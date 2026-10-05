"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveVideo } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";
import type { Video } from "@/lib/types";

export function VideoForm({ moduleId, video }: { moduleId: string; video?: Video }) {
  const [state, action] = useActionState(saveVideo, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success && !video) formRef.current?.reset();
  }, [state, video]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="module_id" value={moduleId} />
      {video && <input type="hidden" name="id" value={video.id} />}
      <div>
        <label className="label" htmlFor="title">Título</label>
        <input className="input" id="title" name="title" defaultValue={video?.title} placeholder="Ex.: Mentoria 05/10 — Estudo de caso" required />
      </div>
      <div>
        <label className="label" htmlFor="youtube">Link do YouTube (não listado)</label>
        <input
          className="input"
          id="youtube"
          name="youtube"
          defaultValue={video ? `https://youtu.be/${video.youtube_id}` : ""}
          placeholder="https://youtu.be/..."
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="recorded_on">Data da mentoria</label>
          <input className="input" id="recorded_on" name="recorded_on" type="date" defaultValue={video?.recorded_on ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="duration_minutes">Duração (min)</label>
          <input className="input" id="duration_minutes" name="duration_minutes" type="number" min="0" defaultValue={video?.duration_minutes ?? ""} />
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
      <SubmitButton pendingText="Salvando...">{video ? "Salvar vídeo" : "Adicionar vídeo"}</SubmitButton>
    </form>
  );
}
