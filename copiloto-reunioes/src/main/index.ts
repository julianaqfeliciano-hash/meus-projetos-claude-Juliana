import { app, dialog, globalShortcut, safeStorage, session, type BrowserWindow } from 'electron';
import { configurarCaptura } from './captura';
import { criarCofreChaves, type Cripto } from './config/chaves';
import { lerPreferencias } from './config/preferencias';
import { criarHistorico } from './historico/historico';
import { iniciarIpc } from './ipc';
import { criarJanelaPrincipal } from './janelas/janela-principal';

/** As chaves são criptografadas pelo Windows (DPAPI), via `safeStorage`. */
const criptoDoWindows: Cripto = {
  disponivel: () => safeStorage.isEncryptionAvailable(),
  criptografar: (texto) => safeStorage.encryptString(texto),
  descriptografar: (bytes) => safeStorage.decryptString(bytes),
};

let principal: BrowserWindow | null = null;

async function abrir(): Promise<void> {
  const dir = app.getPath('userData');
  const preferencias = await lerPreferencias(dir);
  configurarCaptura(session.defaultSession);

  const reuniao = iniciarIpc({
    dir,
    cofre: criarCofreChaves(dir, criptoDoWindows),
    historico: criarHistorico(dir),
    preferencias,
    principal: () => principal,
  });
  principal = criarJanelaPrincipal(reuniao);
  // O painel escondido continua aberto: fechar a janela principal é o que encerra o app.
  principal.on('closed', () => {
    principal = null;
    app.quit();
  });
}

// Uma segunda instância disputaria os atalhos, o config.json e o microfone: ela só traz a primeira para a frente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const janela = principal;
    if (!janela || janela.isDestroyed()) return;
    if (janela.isMinimized()) janela.restore();
    janela.show();
    janela.focus();
  });

  void app.whenReady().then(() =>
    abrir().catch((erro: unknown) => {
      console.error('Falha ao abrir o Copiloto de Reuniões:', erro);
      dialog.showErrorBox(
        'Copiloto de Reuniões',
        `Não consegui abrir o programa: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
      app.quit();
    }),
  );

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}
