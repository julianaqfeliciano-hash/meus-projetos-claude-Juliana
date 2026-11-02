import type { Fonte, InstantaneoReuniao } from '../../../shared/tipos';

/**
 * O rótulo do estado no topo do painel. Os problemas de conexão vêm antes do resto porque a usuária precisa saber
 * que, apesar do estado, nada está sendo transcrito.
 */
export function rotuloEstado(i: InstantaneoReuniao): string {
  const conexoes = Object.values(i.conexao);
  if (conexoes.includes('erro')) return 'erro de conexão';
  if (conexoes.includes('reconectando')) return 'reconectando…';
  if (i.estado === 'pausado') return 'pausado';
  if (i.estado === 'ouvindo') return i.modo === 'ensaio' ? 'ensaio' : 'ouvindo';
  if (i.estado === 'encerrando') return 'gerando resumo…';
  return '';
}

/** "Manual.pdf, p. 12" */
export function textoFonte(f: Fonte): string {
  return `${f.arquivo}, ${f.local}`;
}
