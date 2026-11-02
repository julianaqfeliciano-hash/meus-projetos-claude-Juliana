import { join } from 'node:path';
import { app, BrowserWindow, dialog, shell } from 'electron';

const TITULO = 'Copiloto de Reuniões';

/** Preferências de segurança comuns às duas janelas: só o preload fala com o processo principal. */
export const PREFERENCIAS_WEB_SEGURAS = {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
} as const;

export function carregarPagina(janela: BrowserWindow, pagina: 'index' | 'painel'): void {
  const servidorDev = process.env['ELECTRON_RENDERER_URL'];
  const carregamento = servidorDev
    ? janela.loadURL(`${servidorDev}/${pagina}.html`)
    : janela.loadFile(join(__dirname, `../renderer/${pagina}.html`));
  carregamento.catch((erro: unknown) => console.error(`Não consegui carregar a página ${pagina}:`, erro));
}

/** Endereço fora do app (as páginas do app são arquivos locais ou, em desenvolvimento, o servidor do Vite). */
function ehExterno(url: string): boolean {
  try {
    const destino = new URL(url);
    const servidorDev = process.env['ELECTRON_RENDERER_URL'];
    if (servidorDev && destino.origin === new URL(servidorDev).origin) return false;
    return destino.protocol !== 'file:';
  } catch {
    return true;
  }
}

/**
 * Links externos (ex.: os painéis da Anthropic e da Soniox nas Configurações) abrem no navegador. Sem isso o
 * Electron os abriria numa janela do app, com o preload e a API do Copiloto à disposição do site.
 */
export function protegerNavegacao(janela: BrowserWindow): void {
  const abrirNoNavegador = (url: string): void => {
    if (url.startsWith('https://')) {
      shell.openExternal(url).catch((erro: unknown) => console.warn('Não consegui abrir o link:', erro));
    }
  };
  janela.webContents.setWindowOpenHandler(({ url }) => {
    abrirNoNavegador(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (evento, url) => {
    if (!ehExterno(url)) return;
    evento.preventDefault();
    abrirNoNavegador(url);
  });
}

/** O que a janela principal precisa saber da reunião para confirmar a saída. */
export interface ReuniaoNaSaida {
  /** `'ativa'`: pergunta o que fazer; `'encerrando'`: espera o resumo em andamento; `null`: fecha direto. */
  situacao(): 'ativa' | 'encerrando' | null;
  encerrar(): Promise<unknown>;
  descartar(): void;
}

const BOTOES_SAIDA = ['Gerar resumo e sair', 'Sair sem resumo', 'Cancelar'];
const GERAR_RESUMO = 0;
const SEM_RESUMO = 1;
const CANCELAR = 2;

/** Faz o que a usuária escolheu; devolve `true` se o app deve sair. */
async function decidirSaida(janela: BrowserWindow, reuniao: ReuniaoNaSaida): Promise<boolean> {
  let escolha = GERAR_RESUMO;
  if (reuniao.situacao() === 'ativa') {
    const resposta = await dialog.showMessageBox(janela, {
      type: 'question',
      title: TITULO,
      message: 'Gerar o resumo antes de sair?',
      detail: 'A reunião ainda está em andamento.',
      buttons: BOTOES_SAIDA,
      defaultId: GERAR_RESUMO,
      cancelId: CANCELAR,
      noLink: true,
    });
    escolha = resposta.response;
  }
  if (escolha === CANCELAR) return false;
  if (escolha === SEM_RESUMO) {
    reuniao.descartar();
    return true;
  }
  try {
    await reuniao.encerrar();
  } catch (erro) {
    await dialog.showMessageBox(janela, {
      type: 'error',
      title: TITULO,
      message: erro instanceof Error ? erro.message : String(erro),
    });
  }
  return true;
}

export function criarJanelaPrincipal(reuniao: ReuniaoNaSaida): BrowserWindow {
  const janela = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: { ...PREFERENCIAS_WEB_SEGURAS, backgroundThrottling: false },
  });
  protegerNavegacao(janela);

  // Depois da escolha, o fechamento seguinte (o do app.quit) passa direto, sem perguntar de novo.
  let liberada = false;
  let decidindo = false;
  janela.on('close', (evento) => {
    if (liberada || reuniao.situacao() === null) return;
    evento.preventDefault();
    if (decidindo) return;
    decidindo = true;
    decidirSaida(janela, reuniao)
      .then((sair) => {
        if (!sair) return;
        liberada = true;
        app.quit();
      })
      .catch((erro: unknown) => console.error('Falha ao confirmar a saída:', erro))
      .finally(() => {
        decidindo = false;
      });
  });

  carregarPagina(janela, 'index');
  return janela;
}
