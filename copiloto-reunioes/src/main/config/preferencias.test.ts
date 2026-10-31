import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ATALHOS_PADRAO } from './atalhos';
import { PREFERENCIAS_PADRAO, lerPreferencias, salvarPreferencias } from './preferencias';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copiloto-prefs-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('preferências', () => {
  it('os padrões seguem as Global Constraints', () => {
    expect(PREFERENCIAS_PADRAO).toEqual({
      sobreVoce: '',
      microfoneId: null,
      atalhos: ATALHOS_PADRAO,
      tamanhoLetra: 'normal',
      opacidadePainel: 0.95,
      invisivelNoCompartilhamento: true,
      painel: null,
      ultimosArquivos: [],
    });
  });
  it('sem arquivo devolve padrões', async () => {
    expect(await lerPreferencias(dir)).toEqual(PREFERENCIAS_PADRAO);
  });
  it('salva e lê', async () => {
    await salvarPreferencias(dir, { ...PREFERENCIAS_PADRAO, sobreVoce: 'Consultora' });
    expect((await lerPreferencias(dir)).sobreVoce).toBe('Consultora');
  });
  it('salva todos os campos sem perder nada', async () => {
    const p = {
      ...PREFERENCIAS_PADRAO,
      microfoneId: 'mic-1',
      tamanhoLetra: 'grande' as const,
      opacidadePainel: 0.7,
      invisivelNoCompartilhamento: false,
      painel: { x: 10, y: 20, largura: 300, altura: 400 },
      ultimosArquivos: ['a.pdf', 'b.docx'],
    };
    await salvarPreferencias(dir, p);
    expect(await lerPreferencias(dir)).toEqual(p);
  });
  it('grava de forma atômica, sem deixar arquivo temporário', async () => {
    await salvarPreferencias(dir, PREFERENCIAS_PADRAO);
    await salvarPreferencias(dir, { ...PREFERENCIAS_PADRAO, sobreVoce: 'Outra' });
    expect(await fs.readdir(dir)).toEqual(['config.json']);
  });
  it('arquivo corrompido devolve padrões', async () => {
    await fs.writeFile(path.join(dir, 'config.json'), '{oops');
    expect(await lerPreferencias(dir)).toEqual(PREFERENCIAS_PADRAO);
  });
  it('JSON que não é um objeto devolve padrões', async () => {
    await fs.writeFile(path.join(dir, 'config.json'), 'null');
    expect(await lerPreferencias(dir)).toEqual(PREFERENCIAS_PADRAO);
  });
  it('completa campos faltando com padrões', async () => {
    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify({ sobreVoce: 'X' }));
    const p = await lerPreferencias(dir);
    expect(p.sobreVoce).toBe('X');
    expect(p.atalhos).toEqual(ATALHOS_PADRAO);
  });
  it('completa atalhos faltando dentro de atalhos', async () => {
    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify({ atalhos: { explicar: 'Control+Alt+Z' } }));
    const p = await lerPreferencias(dir);
    expect(p.atalhos).toEqual({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+Z' });
  });
  it('não devolve os objetos dos padrões, para ninguém alterá-los por engano', async () => {
    const p = await lerPreferencias(dir);
    p.ultimosArquivos.push('x.pdf');
    p.atalhos.explicar = 'Control+Alt+Z';
    expect(PREFERENCIAS_PADRAO.ultimosArquivos).toEqual([]);
    expect(ATALHOS_PADRAO.explicar).toBe('Control+Alt+X');
  });
});
