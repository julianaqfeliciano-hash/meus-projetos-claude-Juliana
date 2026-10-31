import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gravarAtomico } from './gravar-atomico';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copiloto-atomico-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('gravarAtomico', () => {
  it('grava texto e bytes', async () => {
    await gravarAtomico(path.join(dir, 'a.txt'), 'olá');
    await gravarAtomico(path.join(dir, 'b.bin'), Buffer.from([0, 255, 1]));
    expect(await fs.readFile(path.join(dir, 'a.txt'), 'utf8')).toBe('olá');
    expect(await fs.readFile(path.join(dir, 'b.bin'))).toEqual(Buffer.from([0, 255, 1]));
  });
  it('cria a pasta que falta e substitui o arquivo existente', async () => {
    const arquivo = path.join(dir, 'novo', 'x.txt');
    await gravarAtomico(arquivo, 'um');
    await gravarAtomico(arquivo, 'dois');
    expect(await fs.readFile(arquivo, 'utf8')).toBe('dois');
    expect(await fs.readdir(path.dirname(arquivo))).toEqual(['x.txt']);
  });
  it('se não consegue concluir, falha e não deixa arquivo temporário', async () => {
    const arquivo = path.join(dir, 'alvo');
    await fs.mkdir(arquivo);
    await fs.writeFile(path.join(arquivo, 'dentro.txt'), 'x');
    await expect(gravarAtomico(arquivo, 'dados')).rejects.toThrow();
    expect(await fs.readdir(dir)).toEqual(['alvo']);
  });
});
