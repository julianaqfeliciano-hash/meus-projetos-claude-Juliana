import { desktopCapturer, type Session } from 'electron';

/**
 * Atende o `getDisplayMedia` da janela principal sem mostrar seletor: a tela inteira com o som do computador
 * (`loopback`). O renderer descarta o vídeo e usa só o áudio. As únicas permissões concedidas são o microfone
 * (`media`) e essa captura (`display-capture`).
 */
export function configurarCaptura(sessao: Session): void {
  sessao.setDisplayMediaRequestHandler((_pedido, responder) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((fontes) => responder(fontes[0] ? { video: fontes[0], audio: 'loopback' } : null))
      .catch((erro: unknown) => {
        console.warn('Não consegui listar as telas para capturar o som do computador:', erro);
        responder(null);
      });
  });

  sessao.setPermissionRequestHandler((_conteudo, permissao, responder) => {
    responder(permissao === 'media' || permissao === 'display-capture');
  });
}
