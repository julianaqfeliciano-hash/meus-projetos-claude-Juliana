import { promises as fs } from 'node:fs';
import path from 'node:path';

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

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null;
}

export function criarCofreChaves(
  dir: string,
  cripto: Cripto,
): { obter(): Promise<Chaves>; salvar(p: Partial<Chaves>): Promise<void> } {
  const arquivo = path.join(dir, NOME_ARQUIVO);

  async function obter(): Promise<Chaves> {
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(arquivo);
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return { anthropic: null, soniox: null };
      throw erro;
    }
    try {
      const dados: unknown = JSON.parse(cripto.descriptografar(bytes));
      const objeto = typeof dados === 'object' && dados !== null ? (dados as Record<string, unknown>) : {};
      return { anthropic: textoOuNulo(objeto.anthropic), soniox: textoOuNulo(objeto.soniox) };
    } catch {
      // Arquivo ilegível (corrompido ou criado por outro usuário do Windows): sem chaves guardadas.
      // Devolver nulos deixa a usuária digitar as chaves de novo, em vez de travar o salvar.
      return { anthropic: null, soniox: null };
    }
  }

  async function salvar(p: Partial<Chaves>): Promise<void> {
    if (!cripto.disponivel()) throw new Error('Criptografia do Windows indisponível');
    const atual = await obter();
    const novo: Chaves = {
      anthropic: p.anthropic !== undefined ? p.anthropic : atual.anthropic,
      soniox: p.soniox !== undefined ? p.soniox : atual.soniox,
    };
    const temporario = `${arquivo}.tmp`;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(temporario, cripto.criptografar(JSON.stringify(novo)));
    await fs.rename(temporario, arquivo);
  }

  return { obter, salvar };
}
