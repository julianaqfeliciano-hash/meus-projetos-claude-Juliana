export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  // Datas puras (AAAA-MM-DD) não devem sofrer ajuste de fuso.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

/** Segundos no formato de relógio: 1:05:09 ou 32:10. */
export function formatClock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Domínios do player do Panda Video (ex.: player-vz-xxxx.tv.pandavideo.com.br). */
export function isPandaHost(hostname: string) {
  return /(^|\.)pandavideo\.com(\.br)?$/.test(hostname);
}

/**
 * Aceita o link de incorporação do Panda Video, ou o código <iframe> inteiro
 * copiado do painel, e devolve o link normalizado (…/embed/?v=ID).
 */
export function parsePandaEmbedUrl(input: string): string | null {
  const value = input.trim();
  const src = value.match(/src=["']([^"']+)["']/i)?.[1] ?? value;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || !isPandaHost(url.hostname)) return null;
    const id = url.searchParams.get("v");
    if (!id || !/^[\w-]{8,64}$/.test(id)) return null;
    return `https://${url.hostname}/embed/?v=${id}`;
  } catch {
    return null;
  }
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return (
    "﻿" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const s = cell === null || cell === undefined ? "" : String(cell);
            return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(";"),
      )
      .join("\n")
  );
}
