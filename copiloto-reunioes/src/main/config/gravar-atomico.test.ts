import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ATRASOS_RENOMEAR_MS, gravarAtomico } from './gravar-atomico';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copiloto-atomico-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
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

  describe('renomeação com arquivo travado (Windows)', () => {
    const erroCodigo = (code: string): NodeJS.ErrnoException =>
      Object.assign(new Error(`${code}: simulado`), { code });

    it('tenta de novo quando o rename falha com EPERM e conclui', async () => {
      const arquivo = path.join(dir, 'alvo.txt');
      const renomearReal = fs.rename.bind(fs);
      let falhas = 0;
      const espiao = vi.spyOn(fs, 'rename').mockImplementation(async (de, para) => {
        if (falhas < 2) {
          falhas += 1;
          throw erroCodigo('EPERM');
        }
        return renomearReal(de, para);
      });
      await gravarAtomico(arquivo, 'novo');
      expect(espiao).toHaveBeenCalledTimes(3);
      expect(await fs.readFile(arquivo, 'utf8')).toBe('novo');
      expect(await fs.readdir(dir)).toEqual(['alvo.txt']);
    });

    it('depois de esgotar as tentativas rejeita com o erro e remove o temporário', async () => {
      const espiao = vi.spyOn(fs, 'rename').mockRejectedValue(erroCodigo('EPERM'));
      await expect(gravarAtomico(path.join(dir, 'alvo.txt'), 'x')).rejects.toMatchObject({
        code: 'EPERM',
      });
      expect(espiao).toHaveBeenCalledTimes(ATRASOS_RENOMEAR_MS.length + 1);
      expect(await fs.readdir(dir)).toEqual([]);
    });

    it('não tenta de novo para outros erros', async () => {
      const espiao = vi.spyOn(fs, 'rename').mockRejectedValue(erroCodigo('ENOSPC'));
      await expect(gravarAtomico(path.join(dir, 'alvo.txt'), 'x')).rejects.toMatchObject({
        code: 'ENOSPC',
      });
      expect(espiao).toHaveBeenCalledTimes(1);
      expect(await fs.readdir(dir)).toEqual([]);
    });
  });
});
