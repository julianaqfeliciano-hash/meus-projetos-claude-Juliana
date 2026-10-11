"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isPandaHost } from "@/lib/format";

// Eventos que o player do Panda Video envia à página por postMessage
// (ex.: { message: "panda_timeupdate", currentTime: 12.3, video: "<id>" }).
type PandaEvent = { message?: string; currentTime?: number; duration?: number };

const TICK_MS = 15_000;
// Cantos por onde a marca d'água circula (o canto superior direito é do botão de tela cheia).
const CORNERS = ["top-3 left-3", "top-14 right-3", "bottom-14 right-3", "bottom-14 left-3"];

export function VideoPlayer({
  videoId,
  embedUrl,
  durationSeconds,
  watermark,
  trackProgress,
}: {
  videoId: string;
  embedUrl: string;
  /** Duração cadastrada pela administração; usada se o player não informar. */
  durationSeconds: number;
  watermark: string[];
  trackProgress: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(durationSeconds);
  const playingRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  const newViewRef = useRef(true);
  const [corner, setCorner] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = useCallback(async () => {
    if (!trackProgress) return;
    const now = Date.now();
    const delta = lastTickRef.current ? Math.round((now - lastTickRef.current) / 1000) : 0;
    lastTickRef.current = playingRef.current ? now : null;
    const { error: rpcError } = await createClient().rpc("track_progress", {
      p_video: videoId,
      p_position: Math.floor(positionRef.current),
      p_duration: Math.floor(durationRef.current),
      p_delta: delta,
      p_new_view: newViewRef.current,
    });
    if (rpcError) {
      // Normalmente significa que a conta foi aberta em outro aparelho.
      setError("Sua sessão foi encerrada. Entre novamente para continuar assistindo.");
      return;
    }
    newViewRef.current = false;
  }, [trackProgress, videoId]);

  // Escuta os eventos do player do Panda.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      try {
        if (!isPandaHost(new URL(e.origin).hostname)) return;
      } catch {
        return;
      }
      let data: PandaEvent = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      if (typeof data.currentTime === "number") positionRef.current = data.currentTime;
      if (typeof data.duration === "number" && data.duration > 0) durationRef.current = data.duration;

      switch (data.message) {
        case "panda_play":
          if (!playingRef.current) {
            playingRef.current = true;
            lastTickRef.current = Date.now();
            if (newViewRef.current) void report();
          }
          break;
        case "panda_timeupdate":
          // Alguns players não enviam "play" ao retomar; o avanço do tempo basta.
          if (!playingRef.current) {
            playingRef.current = true;
            lastTickRef.current = Date.now();
          }
          break;
        case "panda_pause":
        case "panda_ended":
          if (playingRef.current) {
            void report();
            playingRef.current = false;
            lastTickRef.current = null;
          }
          break;
      }
    }
    window.addEventListener("message", onMessage);
    const interval = setInterval(() => {
      if (playingRef.current) void report();
    }, TICK_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(interval);
      if (playingRef.current) void report();
    };
  }, [report]);

  // A marca d'água muda de canto periodicamente.
  useEffect(() => {
    const t = setInterval(() => setCorner((c) => (c + 1) % CORNERS.length), 20_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (el.requestFullscreen) {
      await el.requestFullscreen().catch(() => setFullscreen((f) => !f));
    } else {
      // iPhone não permite tela cheia em <div>: ocupa a janela inteira.
      setFullscreen((f) => !f);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex items-center justify-center bg-black"
          : "relative overflow-hidden rounded-xl bg-black shadow-lg"
      }
    >
      <div className={fullscreen ? "relative aspect-video max-h-full w-full" : "relative aspect-video w-full"}>
        {!error && (
          // Sem "allowfullscreen": a tela cheia é feita pelo nosso botão, para a
          // marca d'água continuar visível.
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title="Vídeo da mentoria"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}

        {/* Marca d'água: não bloqueia cliques no player. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute ${CORNERS[corner]} select-none rounded-md bg-black/35 px-2.5 py-1.5 text-[10px] leading-tight text-white/85 transition-all duration-700 sm:text-xs`}
        >
          {watermark.map((line) => (
            <span key={line} className="block">{line}</span>
          ))}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
        >
          <span className="-rotate-12 text-center text-base leading-snug font-semibold text-white/10 sm:text-3xl">
            {watermark.map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/80"
        >
          {fullscreen ? "Sair da tela cheia" : "⛶ Tela cheia"}
        </button>

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white">
            <p>{error}</p>
            <a href="/sair?motivo=outra-sessao" className="btn-primary">Entrar novamente</a>
          </div>
        )}
      </div>
    </div>
  );
}
