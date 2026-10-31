import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

function criarJanela(): void {
  const janela = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void janela.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void janela.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  criarJanela();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
