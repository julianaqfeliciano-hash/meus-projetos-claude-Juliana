import type { CamposCartao, TipoCartao } from '../../shared/tipos';

/** Marcadores que o explicador escreve; cada um fica no início de uma linha. */
export const MARCADORES = {
  titulo: 'TÍTULO:',
  digaIsso: 'DIGA ISSO:',
  explicacao: 'EXPLICAÇÃO:',
  comoExplicar: 'COMO EXPLICAR AO CLIENTE:',
  resposta: 'RESPOSTA:',
} as const;

type ChaveMarcador = keyof typeof MARCADORES;
const CHAVES = Object.keys(MARCADORES) as ChaveMarcador[];

/** Campo principal de cada tipo de cartão: recebe o texto que vem sem marcadores. */
export const CAMPO_PRINCIPAL: Record<TipoCartao, keyof CamposCartao> = {
  'diga-isso': 'digaIsso',
  conceito: 'explicacao',
  resposta: 'resposta',
};

/** Verdadeiro se `cauda` é o começo de algum marcador, mas ainda não o marcador inteiro. */
function ehMarcadorIncompleto(cauda: string): boolean {
  return cauda.length > 0 && CHAVES.some((k) => MARCADORES[k].length > cauda.length && MARCADORES[k].startsWith(cauda));
}

/**
 * Interpreta o texto de um cartão, mesmo quando ele ainda está chegando (streaming). Cada campo vai do seu
 * marcador, no início de uma linha, até o próximo marcador. Campos ausentes ou ainda vazios ficam de fora.
 */
export function interpretarCartao(tipo: TipoCartao, texto: string): { titulo?: string; campos: CamposCartao } {
  // Se a última linha é só o começo de um marcador ("DIGA IS"), ela ainda não é conteúdo de ninguém.
  const inicioUltimaLinha = texto.lastIndexOf('\n') + 1;
  const completo = ehMarcadorIncompleto(texto.slice(inicioUltimaLinha)) ? texto.slice(0, inicioUltimaLinha) : texto;

  const achados: { chave: ChaveMarcador; inicio: number; valorInicio: number }[] = [];
  for (let pos = 0; ; ) {
    const chave = CHAVES.find((k) => completo.startsWith(MARCADORES[k], pos));
    if (chave) achados.push({ chave, inicio: pos, valorInicio: pos + MARCADORES[chave].length });
    const quebra = completo.indexOf('\n', pos);
    if (quebra === -1) break;
    pos = quebra + 1;
  }

  const campos: CamposCartao = {};
  if (achados.length === 0) {
    const principal = completo.trim();
    if (principal) campos[CAMPO_PRINCIPAL[tipo]] = principal;
    return { campos };
  }

  let titulo: string | undefined;
  const vistos = new Set<ChaveMarcador>();
  achados.forEach(({ chave, valorInicio }, i) => {
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const fim = i + 1 < achados.length ? achados[i + 1].inicio : completo.length;
    const valor = completo.slice(valorInicio, fim).trim();
    if (!valor) return;
    if (chave === 'titulo') titulo = valor;
    else campos[chave] = valor;
  });
  return titulo === undefined ? { campos } : { titulo, campos };
}
