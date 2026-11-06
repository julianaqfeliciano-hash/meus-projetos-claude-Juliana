import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Esperas (ms) entre as tentativas de renomear quando o Windows trava o destino. */
export const ATRASOS_RENOMEAR_MS: readonly number[] = [10, 20, 40, 80, 160, 320];

const CODIGOS_DE_TRAVA = new Set(['EPERM', 'EACCES', 'EBUSY']);

function ehTrava(erro: unknown): boolean {
  const codigo = (erro as NodeJS.ErrnoException | null)?.code;
  return typeof codigo === 'string' && CODIGOS_DE_TRAVA.has(codigo);
}

/** No Windows, renomear sobre um arquivo que outro processo segura por instantes falha com EPERM/EACCES/EBUSY. */
async function renomearComTentativas(origem: string, destino: string): Promise<void> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      await fs.rename(origem, destino);
      return;
    } catch (erro) {
      if (!ehTrava(erro) || tentativa >= ATRASOS_RENOMEAR_MS.length) throw erro;
      await new Promise((resolver) => setTimeout(resolver, ATRASOS_RENOMEAR_MS[tentativa]));
    }
  }
}

/**
 * Grava `dados` em `arquivo` de uma vez: escreve num arquivo temporário de nome único e depois
 * renomeia por cima do destino. O nome único evita que gravações ao mesmo tempo se atropelem.
 */
export async function gravarAtomico(arquivo: string, dados: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  const temporario = `${arquivo}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporario, dados);
    await renomearComTentativas(temporario, arquivo);
  } catch (erro) {
    await fs.rm(temporario, { force: true });
    throw erro;
  }
}
