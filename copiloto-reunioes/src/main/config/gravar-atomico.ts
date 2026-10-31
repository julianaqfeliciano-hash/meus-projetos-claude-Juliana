import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Grava `dados` em `arquivo` de uma vez: escreve num arquivo temporário de nome único e depois
 * renomeia por cima do destino. O nome único evita que gravações ao mesmo tempo se atropelem.
 */
export async function gravarAtomico(arquivo: string, dados: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  const temporario = `${arquivo}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporario, dados);
    await fs.rename(temporario, arquivo);
  } catch (erro) {
    await fs.rm(temporario, { force: true });
    throw erro;
  }
}
