import { afterEach, beforeEach, describe, it, expect } from 'vitest';
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
  it('arquivo ilegível devolve nulos e permite gravar de novo', async () => {
    await fs.writeFile(path.join(dir, 'chaves.bin'), Buffer.from([0xff, 0x00, 0xfe]));
    const cofre = criarCofreChaves(dir, criptoFalsa);
    expect(await cofre.obter()).toEqual({ anthropic: null, soniox: null });
    await cofre.salvar({ soniox: 'so-b' });
    expect(await cofre.obter()).toEqual({ anthropic: null, soniox: 'so-b' });
  });
  it('grava de forma atômica, sem deixar arquivo temporário', async () => {
    const cofre = criarCofreChaves(dir, criptoFalsa);
    await cofre.salvar({ anthropic: 'sk-a' });
    await cofre.salvar({ soniox: 'so-b' });
    expect(await fs.readdir(dir)).toEqual(['chaves.bin']);
  });
});
