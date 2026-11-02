import type {
  AcaoAtalho,
  AvaliacaoResposta,
  ConfigTreino,
  IdiomaSugestao,
  Preferencias,
  Quem,
} from '../../shared/tipos';
import { ATALHOS_PADRAO, normalizarAtalho } from '../config/atalhos';
import type { Chaves } from '../config/chaves';
import type { RespostaTreino } from '../ia/treinador';

/**
 * Validação do que chega dos renderers pelo IPC. É entrada não confiável: cada leitor confere o tipo de cada
 * campo, devolve um objeto novo só com os campos conhecidos e lança `ERRO_PEDIDO` se algo não confere.
 */
export const ERRO_PEDIDO = 'Pedido inválido.';

const ACOES = Object.keys(ATALHOS_PADRAO) as AcaoAtalho[];
const PROVEDORES: (keyof Chaves)[] = ['anthropic', 'soniox'];

export function exigir(condicao: boolean): asserts condicao {
  if (!condicao) throw new Error(ERRO_PEDIDO);
}
export const ehTexto = (v: unknown): v is string => typeof v === 'string';
export const ehListaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto);
export const ehQuem = (v: unknown): v is Quem => v === 'voce' || v === 'outros';
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function umDe<T extends string | number>(v: unknown, opcoes: readonly T[]): v is T {
  return opcoes.includes(v as T);
}

function lerAtalhos(v: unknown): Record<AcaoAtalho, string> {
  exigir(ehObjeto(v));
  const atalhos = {} as Record<AcaoAtalho, string>;
  for (const acao of ACOES) {
    const atalho = v[acao];
    exigir(ehTexto(atalho));
    atalhos[acao] = normalizarAtalho(atalho);
  }
  return atalhos;
}

/** As preferências que a tela de Configurações edita. `painel` e `ultimosArquivos` são do processo principal. */
export function lerPreferenciasDaTela(v: unknown): Omit<Preferencias, 'painel' | 'ultimosArquivos'> {
  exigir(
    ehObjeto(v) &&
      ehTexto(v.sobreVoce) &&
      (v.microfoneId === null || ehTexto(v.microfoneId)) &&
      umDe(v.tamanhoLetra, ['normal', 'grande'] as const) &&
      typeof v.opacidadePainel === 'number' &&
      v.opacidadePainel >= 0.6 &&
      v.opacidadePainel <= 1 &&
      typeof v.invisivelNoCompartilhamento === 'boolean',
  );
  return {
    sobreVoce: v.sobreVoce,
    microfoneId: v.microfoneId,
    atalhos: lerAtalhos(v.atalhos),
    tamanhoLetra: v.tamanhoLetra,
    opacidadePainel: v.opacidadePainel,
    invisivelNoCompartilhamento: v.invisivelNoCompartilhamento,
  };
}

/** Chaves digitadas, sem espaços nas pontas; as vazias ou ausentes ficam de fora. */
export function lerChavesDaTela(v: unknown): Partial<Record<keyof Chaves, string>> {
  exigir(ehObjeto(v));
  const chaves: Partial<Record<keyof Chaves, string>> = {};
  for (const provedor of PROVEDORES) {
    const chave = v[provedor];
    if (chave === undefined) continue;
    exigir(ehTexto(chave));
    if (chave.trim() !== '') chaves[provedor] = chave.trim();
  }
  return chaves;
}

export function lerPedidoReuniao(v: unknown): {
  caminhos: string[];
  contexto: string;
  idioma: IdiomaSugestao;
  modo: 'audio' | 'ensaio';
} {
  exigir(
    ehObjeto(v) &&
      ehListaDeTextos(v.caminhos) &&
      ehTexto(v.contexto) &&
      umDe(v.idioma, ['auto', 'pt', 'en'] as const) &&
      umDe(v.modo, ['audio', 'ensaio'] as const),
  );
  return { caminhos: v.caminhos, contexto: v.contexto, idioma: v.idioma, modo: v.modo };
}

export function lerConfigTreino(v: unknown): ConfigTreino {
  exigir(
    ehObjeto(v) &&
      ehTexto(v.vaga) &&
      ehTexto(v.curriculo) &&
      umDe(v.idioma, ['pt', 'en'] as const) &&
      umDe(v.tipo, ['comportamental', 'tecnica', 'mista'] as const) &&
      umDe(v.quantidade, [5, 8, 10] as const),
  );
  return { vaga: v.vaga, curriculo: v.curriculo, idioma: v.idioma, tipo: v.tipo, quantidade: v.quantidade };
}

function lerAvaliacao(v: unknown): AvaliacaoResposta {
  exigir(
    ehObjeto(v) &&
      ehListaDeTextos(v.foiBem) &&
      ehListaDeTextos(v.faltou) &&
      ehTexto(v.respostaMelhorada) &&
      ehListaDeTextos(v.dicasIngles),
  );
  return { foiBem: v.foiBem, faltou: v.faltou, respostaMelhorada: v.respostaMelhorada, dicasIngles: v.dicasIngles };
}

export function lerRespostas(v: unknown): RespostaTreino[] {
  exigir(Array.isArray(v));
  return v.map((r: unknown) => {
    exigir(ehObjeto(r) && ehTexto(r.pergunta) && ehTexto(r.resposta));
    return { pergunta: r.pergunta, resposta: r.resposta, avaliacao: lerAvaliacao(r.avaliacao) };
  });
}

/** O PCM chega como ArrayBuffer; uma visão (Uint8Array, Buffer) também serve. Qualquer outra coisa: `null`. */
export function paraBytes(pcm: unknown): Uint8Array | null {
  if (pcm instanceof ArrayBuffer) return new Uint8Array(pcm);
  if (ArrayBuffer.isView(pcm)) return new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return null;
}
