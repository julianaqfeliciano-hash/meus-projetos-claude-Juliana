import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gravarAtomico } from './gravar-atomico';

export interface Cripto {
  disponivel(): boolean;
  criptografar(t: string): Buffer;
  descriptografar(b: Buffer): string;
}

export interface Chaves {
  anthropic: string | null;
  soniox: string | null;
}

const NOME_ARQUIVO = 'chaves.bin';
const NOME_CORROMPIDO = 'chaves.bin.corrompido';
const ERRO_INDISPONIVEL = 'Criptografia do Windows indisponível';

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null;
}

export function criarCofreChaves(
  dir: string,
  cripto: Cripto,
): { obter(): Promise<Chaves>; salvar(p: Partial<Chaves>): Promise<void> } {
  const arquivo = path.join(dir, NOME_ARQUIVO);

  // Leituras e gravações andam uma de cada vez, na ordem em que foram pedidas. Uma tarefa que
  // falha rejeita só o seu próprio pedido: a fila segue para as próximas.
  let fila: Promise<unknown> = Promise.resolve();
  function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
    const execucao = fila.then(tarefa);
    fila = execucao.catch(() => undefined);
    return execucao;
  }

  async function ler(): Promise<Chaves> {
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(arquivo);
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return { anthropic: null, soniox: null };
      throw erro;
    }
    if (!cripto.disponivel()) throw new Error(ERRO_INDISPONIVEL);
    let dados: Record<string, unknown>;
    try {
      const lido: unknown = JSON.parse(cripto.descriptografar(bytes));
      if (typeof lido !== 'object' || lido === null) throw new Error('conteúdo inesperado');
      dados = lido as Record<string, unknown>;
    } catch {
      // Ilegível (corrompido ou criado por outro usuário do Windows): guarda o arquivo para
      // recuperação e segue sem chaves, para a usuária poder digitá-las de novo.
      await fs.rename(arquivo, path.join(dir, NOME_CORROMPIDO));
      console.warn(`Cofre de chaves ilegível: o arquivo foi guardado como ${NOME_CORROMPIDO}.`);
      return { anthropic: null, soniox: null };
    }
    return { anthropic: textoOuNulo(dados.anthropic), soniox: textoOuNulo(dados.soniox) };
  }

  async function salvar(p: Partial<Chaves>): Promise<void> {
    if (!cripto.disponivel()) throw new Error(ERRO_INDISPONIVEL);
    await naFila(async () => {
      const atual = await ler();
      const novo: Chaves = {
        anthropic: p.anthropic !== undefined ? p.anthropic : atual.anthropic,
        soniox: p.soniox !== undefined ? p.soniox : atual.soniox,
      };
      await gravarAtomico(arquivo, cripto.criptografar(JSON.stringify(novo)));
    });
  }

  return { obter: () => naFila(ler), salvar };
}
