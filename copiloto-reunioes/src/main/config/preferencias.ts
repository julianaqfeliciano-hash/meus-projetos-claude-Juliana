import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Preferencias } from '../../shared/tipos';
import { ATALHOS_PADRAO } from './atalhos';

export const PREFERENCIAS_PADRAO: Preferencias = {
  sobreVoce: '',
  microfoneId: null,
  atalhos: ATALHOS_PADRAO,
  tamanhoLetra: 'normal',
  opacidadePainel: 0.95,
  invisivelNoCompartilhamento: true,
  painel: null,
  ultimosArquivos: [],
};

const NOME_ARQUIVO = 'config.json';

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export async function lerPreferencias(dir: string): Promise<Preferencias> {
  const padroes = structuredClone(PREFERENCIAS_PADRAO);
  let lido: unknown;
  try {
    lido = JSON.parse(await fs.readFile(path.join(dir, NOME_ARQUIVO), 'utf8'));
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT' || erro instanceof SyntaxError) return padroes;
    throw erro;
  }
  if (!ehObjeto(lido)) return padroes;
  return {
    ...padroes,
    ...lido,
    atalhos: { ...padroes.atalhos, ...(ehObjeto(lido.atalhos) ? lido.atalhos : {}) },
  };
}

export async function salvarPreferencias(dir: string, p: Preferencias): Promise<void> {
  const arquivo = path.join(dir, NOME_ARQUIVO);
  const temporario = `${arquivo}.tmp`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(temporario, JSON.stringify(p, null, 2), 'utf8');
  await fs.rename(temporario, arquivo);
}
