const ESPERAS_MS = [1000, 2000, 4000, 8000];
const ESPERA_MAXIMA_MS = 15_000;

/** Espera, em ms, antes da tentativa de reconexão de número `tentativa` (a primeira é a 0). */
export function atrasoReconexao(tentativa: number): number {
  const indice = Math.max(0, Math.floor(tentativa)) || 0;
  return ESPERAS_MS[indice] ?? ESPERA_MAXIMA_MS;
}
