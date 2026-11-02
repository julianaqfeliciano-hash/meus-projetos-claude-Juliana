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

async function abrir(): Promise<void> {
  const dir = app.getPath('userData');
  const preferencias = await lerPreferencias(dir);
  configurarCaptura(session.defaultSession);

  let principal: BrowserWindow | null = null;
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

void app.whenReady().then(() =>
  abrir().catch((erro: unknown) => {
    console.error('Falha ao abrir o Copiloto de Reuniões:', erro);
    dialog.showErrorBox('Copiloto de Reuniões', `Não consegui abrir o programa: ${erro instanceof Error ? erro.message : String(erro)}`);
    app.quit();
  }),
);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
