import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ehPaginaDoApp } from './paginas';

const arquivos = ['/app/out/renderer/index.html', '/app/out/renderer/painel.html'];
const url = (caminho: string) => pathToFileURL(caminho).href;

describe('ehPaginaDoApp', () => {
  it('aceita as duas páginas do app, com ou sem âncora e parâmetros', () => {
    const origem = { arquivos, servidorDev: undefined };
    expect(ehPaginaDoApp(url(arquivos[0]), origem)).toBe(true);
    expect(ehPaginaDoApp(`${url(arquivos[1])}#/cartoes`, origem)).toBe(true);
    expect(ehPaginaDoApp(`${url(arquivos[0])}?x=1`, origem)).toBe(true);
  });

  it('recusa qualquer outro arquivo local (ex.: um documento arrastado para a janela) e sites', () => {
    const origem = { arquivos, servidorDev: undefined };
    expect(ehPaginaDoApp(url('/home/juliana/Proposta.pdf'), origem)).toBe(false);
    expect(ehPaginaDoApp(url('/app/out/renderer/outra.html'), origem)).toBe(false);
    expect(ehPaginaDoApp('https://console.anthropic.com', origem)).toBe(false);
    expect(ehPaginaDoApp('não é url', origem)).toBe(false);
    expect(ehPaginaDoApp('', origem)).toBe(false);
  });

  it('em desenvolvimento, aceita só a origem do servidor do Vite', () => {
    const origem = { arquivos, servidorDev: 'http://localhost:5173' };
    expect(ehPaginaDoApp('http://localhost:5173/painel.html', origem)).toBe(true);
    expect(ehPaginaDoApp('http://localhost:5174/index.html', origem)).toBe(false);
    expect(ehPaginaDoApp(url(arquivos[0]), origem)).toBe(false);
  });
});
