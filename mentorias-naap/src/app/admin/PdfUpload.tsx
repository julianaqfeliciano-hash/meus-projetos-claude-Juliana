"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setVideoPdf } from "./actions";

/** Envia o PDF direto do navegador para o armazenamento (sem limite do servidor). */
export function PdfUpload({ videoId, currentName }: { videoId: string; currentName: string | null }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf") return setError("Envie um arquivo PDF.");
    if (file.size > 50 * 1024 * 1024) return setError("O PDF deve ter no máximo 50 MB.");

    const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
    const path = `${videoId}/${Date.now()}-${safe}`;
    startTransition(async () => {
      const { error: uploadError } = await createClient()
        .storage.from("materiais")
        .upload(path, file, { contentType: "application/pdf" });
      if (uploadError) {
        setError("Falha ao enviar o arquivo. Tente novamente.");
        return;
      }
      await setVideoPdf(videoId, path, file.name.replace(/\.pdf$/i, ""));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {currentName ? (
        <p className="text-sm">
          Arquivo atual: <a href={`/material/${videoId}`} target="_blank" className="text-primary underline">{currentName}</a>
        </p>
      ) : (
        <p className="text-sm text-muted">Nenhum PDF anexado.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="btn-outline cursor-pointer">
          {busy ? "Enviando..." : currentName ? "Substituir PDF" : "Anexar PDF"}
          <input type="file" accept="application/pdf" className="hidden" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {currentName && (
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() =>
              confirm("Remover o PDF deste vídeo?") &&
              startTransition(async () => {
                await setVideoPdf(videoId, null, null);
                router.refresh();
              })
            }
          >
            Remover PDF
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
