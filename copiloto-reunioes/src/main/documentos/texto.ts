import { promises as fs } from 'node:fs';
import type { ParteDoc } from '../../shared/tipos';
import { dividirTexto } from './dividir';

/** Lê um .txt ou .md em UTF-8, sem BOM, e divide em partes "parte N". */
export async function lerTexto(caminho: string): Promise<ParteDoc[]> {
  const bruto = await fs.readFile(caminho, 'utf8');
  return dividirTexto(bruto.replace(/^\uFEFF/, '')).map((texto, i) => ({ rotulo: `parte ${i + 1}`, texto }));
}

const ENTIDADES_NOMEADAS: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decodifica entidades HTML/XML (nomeadas e numéricas) de uma só vez; o que não reconhece fica como está. */
export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g, (original, dec?: string, hex?: string, nome?: string) => {
    if (nome !== undefined) return ENTIDADES_NOMEADAS[nome] ?? original;
    const codigo = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex ?? '', 16);
    return codigo <= 0x10ffff ? String.fromCodePoint(codigo) : original;
  });
}
