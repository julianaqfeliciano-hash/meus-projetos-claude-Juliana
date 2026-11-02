import { release } from 'node:os';
import { BrowserWindow, screen, type Rectangle } from 'electron';
import { CANAIS } from '../../shared/ipc';
import type { Preferencias, TipoAviso } from '../../shared/tipos';
import { carregarPagina, PREFERENCIAS_WEB_SEGURAS, protegerNavegacao } from './janela-principal';
import { suportaExclusaoCaptura } from './versao-windows';

type LimitesPainel = NonNullable<Preferencias['painel']>;

export interface OpcoesPainel {
  preferencias(): Preferencias;
  /** Posição e tamanho novos, 500 ms depois do último movimento ou redimensionamento. */
  aoMudarLimites(l: LimitesPainel): void;
  /** A página do painel terminou de carregar e já pode receber o estado. */
  aoCarregar(): void;
  avisar(tipo: TipoAviso): void;
}

export interface ControlePainel {
  /** Cria o painel, se preciso, e mostra sem tirar o foco da janela atual. */
  mostrar(): void;
  esconder(): void;
  /** Atalho "Ocultar": esconde ou mostra de novo. */
  alternar(): void;
  /** Atalho "Digitar pergunta": o painel recebe foco e abre o campo. */
  digitar(): void;
  terminarDigitacao(): void;
  aplicarPreferencias(p: Preferencias): void;
  enviar(canal: string, ...args: unknown[]): void;
}

const LARGURA_PADRAO = 420;
const ALTURA_PADRAO = 640;
const ESPERA_SALVAR_LIMITES_MS = 500;

/** A posição salva, se ainda cair em alguma tela (o monitor externo pode ter sido desligado); senão, o padrão. */
function limitesIniciais(salvo: Preferencias['painel']): Rectangle | { width: number; height: number } {
  const padrao = { width: LARGURA_PADRAO, height: ALTURA_PADRAO };
  if (!salvo || ![salvo.x, salvo.y, salvo.largura, salvo.altura].every(Number.isFinite)) return padrao;
  const l = {
    x: Math.round(salvo.x),
    y: Math.round(salvo.y),
    width: Math.round(salvo.largura),
    height: Math.round(salvo.altura),
  };
  const visivel = screen
    .getAllDisplays()
    .some(({ workArea: a }) => l.x < a.x + a.width && l.x + l.width > a.x && l.y < a.y + a.height && l.y + l.height > a.y);
  return visivel ? l : padrao;
}

function aplicarNaJanela(janela: BrowserWindow, p: Preferencias): void {
  janela.setContentProtection(p.invisivelNoCompartilhamento);
  janela.setOpacity(p.opacidadePainel);
}

export function criarControlePainel(o: OpcoesPainel): ControlePainel {
  let janela: BrowserWindow | null = null;

  function criar(): BrowserWindow {
    const p = o.preferencias();
    const nova = new BrowserWindow({
      ...limitesIniciais(p.painel),
      frame: false,
      transparent: false,
      resizable: true,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: false,
      show: false,
      webPreferences: PREFERENCIAS_WEB_SEGURAS,
    });
    protegerNavegacao(nova);
    nova.setAlwaysOnTop(true, 'screen-saver');
    aplicarNaJanela(nova, p);

    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const agendarSalvar = (): void => {
      if (temporizador !== null) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        if (nova.isDestroyed()) return;
        const { x, y, width, height } = nova.getBounds();
        o.aoMudarLimites({ x, y, largura: width, altura: height });
      }, ESPERA_SALVAR_LIMITES_MS);
    };
    nova.on('move', agendarSalvar);
    nova.on('resize', agendarSalvar);
    nova.on('closed', () => {
      if (temporizador !== null) clearTimeout(temporizador);
      if (janela === nova) janela = null;
    });
    nova.webContents.on('did-finish-load', () => o.aoCarregar());
    carregarPagina(nova, 'painel');

    if (process.platform === 'win32' && !suportaExclusaoCaptura(release())) o.avisar('windows-antigo');
    return nova;
  }

  function existente(): BrowserWindow | null {
    return janela && !janela.isDestroyed() ? janela : null;
  }

  function garantir(): BrowserWindow {
    janela = existente() ?? criar();
    return janela;
  }

  return {
    mostrar() {
      garantir().showInactive();
    },

    esconder() {
      const j = existente();
      if (!j) return;
      j.setFocusable(false);
      j.hide();
    },

    alternar() {
      const j = garantir();
      if (j.isVisible()) j.hide();
      else j.showInactive();
    },

    digitar() {
      const j = garantir();
      j.setFocusable(true);
      j.show();
      j.focus();
      j.webContents.send(CANAIS.painelDigitar);
    },

    terminarDigitacao() {
      const j = existente();
      if (!j) return;
      j.setFocusable(false);
      j.blur();
    },

    aplicarPreferencias(p) {
      const j = existente();
      if (!j) return;
      aplicarNaJanela(j, p);
      j.webContents.send(CANAIS.painelPreferencias, p);
    },

    enviar(canal, ...args) {
      existente()?.webContents.send(canal, ...args);
    },
  };
}
