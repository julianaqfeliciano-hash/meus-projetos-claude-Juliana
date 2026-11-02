import { desktopCapturer, webContents, type Session } from 'electron';
import { ehPaginaDesteApp } from './janelas/paginas';

/**
 * Atende o `getDisplayMedia` da janela principal sem mostrar seletor: a tela inteira com o som do computador
 * (`loopback`). O renderer descarta o vídeo e usa só o áudio. As únicas permissões concedidas são o microfone
 * (`media`) e essa captura (`display-capture`), e só para as páginas do app.
 */
export function configurarCaptura(sessao: Session): void {
  sessao.setDisplayMediaRequestHandler((pedido, responder) => {
    const conteudo = pedido.frame ? webContents.fromFrame(pedido.frame) : undefined;
    if (!conteudo || !ehPaginaDesteApp(conteudo.getURL())) {
      responder(null);
      return;
    }
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((fontes) => responder(fontes[0] ? { video: fontes[0], audio: 'loopback' } : null))
      .catch((erro: unknown) => {
        console.warn('Não consegui listar as telas para capturar o som do computador:', erro);
        responder(null);
      });
  });

  sessao.setPermissionRequestHandler((conteudo, permissao, responder) => {
    responder((permissao === 'media' || permissao === 'display-capture') && ehPaginaDesteApp(conteudo.getURL()));
  });
}
