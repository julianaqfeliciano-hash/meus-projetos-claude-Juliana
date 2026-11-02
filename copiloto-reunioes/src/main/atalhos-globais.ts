import type { AcaoAtalho } from '../shared/tipos';
import { ATALHOS_PADRAO } from './config/atalhos';

/** A parte do `globalShortcut` do Electron que o registro usa. */
export interface RegistroGlobal {
  register(a: string, fn: () => void): boolean;
  unregisterAll(): void;
}

/**
 * Troca todos os atalhos globais pelos de `atalhos`. Devolve, por ação, se o Windows aceitou o atalho:
 * `false` quando outro programa já o usa (ou quando o Electron não entende o texto do atalho).
 */
export function registrarAtalhos(
  gs: RegistroGlobal,
  atalhos: Record<AcaoAtalho, string>,
  acoes: Record<AcaoAtalho, () => void>,
): Record<AcaoAtalho, boolean> {
  gs.unregisterAll();
  const resultado = {} as Record<AcaoAtalho, boolean>;
  for (const acao of Object.keys(ATALHOS_PADRAO) as AcaoAtalho[]) {
    try {
      resultado[acao] = gs.register(atalhos[acao], acoes[acao]);
    } catch {
      // O Electron lança para um texto que não é um atalho válido: vale como recusado.
      resultado[acao] = false;
    }
  }
  return resultado;
}
