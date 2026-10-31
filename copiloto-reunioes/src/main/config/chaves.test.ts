import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarCofreChaves, type Cripto } from './chaves';

// Cripto falsa: inverte os bytes e codifica em base64 (reversível, só para os testes).
const criptoFalsa: Cripto = {
  disponivel: () => true,
  criptografar: (t) => Buffer.from(Buffer.from(t, 'utf8').reverse().toString('base64'), 'utf8'),
  descriptografar: (b) => Buffer.from(b.toString('utf8'), 'base64').reverse().toString('utf8'),
};

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copiloto-chaves-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('cofre de chaves', () => {
  it('salva parcial e preserva a outra chave', async () => {
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await cofre.salvar({ anthropic: 'sk-a' });
    await cofre.salvar({ soniox: 'so-b' });
    expect(await cofre.obter()).toEqual({ anthropic: 'sk-a', soniox: 'so-b' });
  });
  it('o arquivo não contém a chave em texto puro', async () => {
    await criarCofreChaves(dir, criptoFalsa).salvar({ anthropic: 'sk-a' });
    const bruto = await fs.readFile(path.join(dir, 'chaves.bin'));
    expect(bruto.toString('latin1')).not.toContain('sk-a');
    expect(bruto.toString('utf8')).not.toContain('sk-a');
  });
  it('sem arquivo devolve nulos', async () => {
    expect(await criarCofreChaves(dir, criptoFalsa).obter()).toEqual({ anthropic: null, soniox: null });
  });
  it('salvar null apaga só aquela chave', async () => {
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await cofre.salvar({ anthropic: 'sk-a', soniox: 'so-b' });
    await cofre.salvar({ anthropic: null });
    expect(await cofre.obter()).toEqual({ anthropic: null, soniox: 'so-b' });
  });
  it('um campo ausente ou undefined não mexe na chave guardada', async () => {
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await cofre.salvar({ anthropic: 'sk-a', soniox: 'so-b' });
    await cofre.salvar({ anthropic: undefined });
    expect(await cofre.obter()).toEqual({ anthropic: 'sk-a', soniox: 'so-b' });
  });
  it('salvar falha se a criptografia do Windows está indisponível', async () => {
    const cofre = criarCofreChaves(dir, { ...criptoFalsa, disponivel: () => false });
    await expect(cofre.salvar({ anthropic: 'sk-a' })).rejects.toThrow('Criptografia do Windows indisponível');
    expect(await fs.readdir(dir)).toEqual([]);
  });
  it('arquivo ilegível é guardado como chaves.bin.corrompido e devolve nulos', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const lixo = Buffer.from([0xff, 0x00, 0xfe]);
    await fs.writeFile(path.join(dir, 'chaves.bin'), lixo);
    const cofre = criarCofreChaves(dir, criptoFalsa);
    expect(await cofre.obter()).toEqual({ anthropic: null, soniox: null });
    expect((await fs.readdir(dir)).sort()).toEqual(['chaves.bin.corrompido']);
    expect(await fs.readFile(path.join(dir, 'chaves.bin.corrompido'))).toEqual(lixo);
    expect(aviso).toHaveBeenCalledTimes(1);
    await cofre.salvar({ soniox: 'so-b' });
    expect(await cofre.obter()).toEqual({ anthropic: null, soniox: 'so-b' });
  });
  it('conteúdo que não é um objeto também é tratado como ilegível', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await fs.writeFile(path.join(dir, 'chaves.bin'), criptoFalsa.criptografar('null'));
    expect(await criarCofreChaves(dir, criptoFalsa).obter()).toEqual({ anthropic: null, soniox: null });
    expect(await fs.readdir(dir)).toEqual(['chaves.bin.corrompido']);
  });
  it('um arquivo ilegível novo substitui o chaves.bin.corrompido anterior', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await fs.writeFile(path.join(dir, 'chaves.bin'), Buffer.from('primeiro'));
    await cofre.obter();
    await fs.writeFile(path.join(dir, 'chaves.bin'), Buffer.from([0xfe, 0xfe]));
    await cofre.obter();
    expect(await fs.readFile(path.join(dir, 'chaves.bin.corrompido'))).toEqual(Buffer.from([0xfe, 0xfe]));
  });
  it('obter falha, sem mexer no arquivo, se a criptografia do Windows está indisponível', async () => {
    await criarCofreChaves(dir, criptoFalsa).salvar({ anthropic: 'sk-a' });
    const cofre = criarCofreChaves(dir, { ...criptoFalsa, disponivel: () => false });
    await expect(cofre.obter()).rejects.toThrow('Criptografia do Windows indisponível');
    expect(await fs.readdir(dir)).toEqual(['chaves.bin']);
  });
  it('obter repassa erros de leitura que não são arquivo ausente', async () => {
    await fs.mkdir(path.join(dir, 'chaves.bin'));
    await expect(criarCofreChaves(dir, criptoFalsa).obter()).rejects.toThrow();
  });
  it('duas gravações parciais ao mesmo tempo mantêm as duas chaves', async () => {
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await Promise.all([cofre.salvar({ anthropic: 'sk-a' }), cofre.salvar({ soniox: 'so-b' })]);
    expect(await cofre.obter()).toEqual({ anthropic: 'sk-a', soniox: 'so-b' });
    expect(await fs.readdir(dir)).toEqual(['chaves.bin']);
  });
  it('gravações ao mesmo tempo valem na ordem em que foram pedidas', async () => {
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await Promise.all([1, 2, 3, 4, 5].map((n) => cofre.salvar({ anthropic: `sk-${n}` })));
    expect(await cofre.obter()).toEqual({ anthropic: 'sk-5', soniox: null });
  });
  it('uma gravação que falha não trava as seguintes', async () => {
    let falhar = true;
    const cripto: Cripto = {
      ...criptoFalsa,
      criptografar: (t) => {
        if (falhar) {
          falhar = false;
          throw new Error('falhou');
        }
        return criptoFalsa.criptografar(t);
      },
    };
    const cofre = criarCofreChaves(dir, cripto);
    const [a, b] = await Promise.allSettled([cofre.salvar({ anthropic: 'sk-a' }), cofre.salvar({ soniox: 'so-b' })]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('fulfilled');
    expect(await cofre.obter()).toEqual({ anthropic: null, soniox: 'so-b' });
  });
  it('grava de forma atômica, sem deixar arquivo temporário', async () => {
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await cofre.salvar({ anthropic: 'sk-a' });
    await cofre.salvar({ soniox: 'so-b' });
    expect(await fs.readdir(dir)).toEqual(['chaves.bin']);
  });
});
