import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Pagina = 'index' | 'painel';

export interface OrigemPaginas {
  /** Caminhos dos HTML das páginas no disco. */
  arquivos: string[];
  /** Em desenvolvimento, o endereço do servidor do Vite (`ELECTRON_RENDERER_URL`). */
  servidorDev: string | undefined;
}

function caminhoSemExtras(url: string): string {
  return decodeURIComponent(new URL(url).pathname);
}

/**
 * `url` é uma das páginas do app? Âncora e parâmetros não contam. Em desenvolvimento vale qualquer página do
 * servidor do Vite; fora dele, só os dois HTML exatos (nenhum outro arquivo local, como um documento arrastado).
 */
export function ehPaginaDoApp(url: string, origem: OrigemPaginas): boolean {
  try {
    const alvo = new URL(url);
    if (origem.servidorDev) return alvo.origin === new URL(origem.servidorDev).origin;
    if (alvo.protocol !== 'file:') return false;
    const caminho = caminhoSemExtras(url);
    return origem.arquivos.some((a) => caminhoSemExtras(pathToFileURL(a).href) === caminho);
  } catch {
    return false;
  }
}

/** O HTML de uma página no build (`out/renderer`, ao lado de `out/main`, onde este código roda). */
export function arquivoDaPagina(pagina: Pagina): string {
  return join(__dirname, `../renderer/${pagina}.html`);
}

/** Atalho para o app em execução: as páginas do build, ou o servidor do Vite em desenvolvimento. */
export function ehPaginaDesteApp(url: string): boolean {
  return ehPaginaDoApp(url, {
    arquivos: [arquivoDaPagina('index'), arquivoDaPagina('painel')],
    servidorDev: process.env['ELECTRON_RENDERER_URL'],
  });
}
