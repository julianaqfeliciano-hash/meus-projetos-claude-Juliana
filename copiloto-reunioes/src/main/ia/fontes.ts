import type { Fonte } from '../../shared/tipos';
import type { PrefixoPedido } from './prefixo';

function indiceValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;
}

/**
 * Converte as citações devolvidas pela API em "arquivo, local". Só `content_block_location` interessa: os
 * documentos vão como blocos de texto (um por página/slide/aba), e o bloco inicial da citação diz qual deles.
 * Citações malformadas ou que apontam para fora do mapa são ignoradas. Sem duplicatas, na ordem em que aparecem.
 */
export function fontesDeCitacoes(citacoes: unknown[], mapa: PrefixoPedido['mapaFontes']): Fonte[] {
  const fontes: Fonte[] = [];
  const vistas = new Set<string>();
  for (const citacao of citacoes) {
    if (typeof citacao !== 'object' || citacao === null) continue;
    const { type, document_index: indiceDoc, start_block_index: indiceBloco } = citacao as Record<string, unknown>;
    if (type !== 'content_block_location' || !indiceValido(indiceDoc) || !indiceValido(indiceBloco)) continue;
    const documento = mapa[indiceDoc];
    const local = documento?.rotulos[indiceBloco];
    if (typeof local !== 'string') continue;
    const chave = JSON.stringify([documento.arquivo, local]);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    fontes.push({ arquivo: documento.arquivo, local });
  }
  return fontes;
}
