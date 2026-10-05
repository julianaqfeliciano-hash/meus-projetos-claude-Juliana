"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Tipos mínimos da API de iframe do YouTube.
type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  pauseVideo(): void;
  destroy(): void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: { onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

const TICK_MS = 15_000;
// Cantos por onde a marca d'água circula (o canto superior direito é do botão de tela cheia).
const CORNERS = ["top-3 left-3", "top-14 right-3", "bottom-14 right-3", "bottom-14 left-3"];

export function VideoPlayer({
  videoId,
  youtubeId,
  startSeconds,
  watermark,
  trackProgress,
}: {
  videoId: string;
  youtubeId: string;
  startSeconds: number;
  watermark: string[];
  trackProgress: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const newViewRef = useRef(true);
  const [corner, setCorner] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = useCallback(async () => {
    const player = playerRef.current;
    if (!trackProgress || !player) return;
    const now = Date.now();
    const delta = lastTickRef.current ? Math.round((now - lastTickRef.current) / 1000) : 0;
    lastTickRef.current = now;
    const { error: rpcError } = await createClient().rpc("track_progress", {
      p_video: videoId,
      p_position: Math.floor(player.getCurrentTime() || 0),
      p_duration: Math.floor(player.getDuration() || 0),
      p_delta: delta,
      p_new_view: newViewRef.current,
    });
    if (rpcError) {
      // Normalmente significa que a conta foi aberta em outro aparelho.
      player.pauseVideo();
      setError("Sua sessão foi encerrada. Entre novamente para continuar assistindo.");
      return;
    }
    newViewRef.current = false;
  }, [trackProgress, videoId]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: youtubeId,
        playerVars: {
          start: Math.floor(startSeconds),
          rel: 0,
          modestbranding: 1,
          fs: 0, // tela cheia pelo nosso botão, para manter a marca d'água visível
          playsinline: 1,
        },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              lastTickRef.current = Date.now();
              clearInterval(interval);
              interval = setInterval(report, TICK_MS);
              if (newViewRef.current) void report();
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              clearInterval(interval);
              void report();
              lastTickRef.current = null;
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (lastTickRef.current) void report();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [youtubeId, startSeconds, report]);

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
        <div ref={mountRef} className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />

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
