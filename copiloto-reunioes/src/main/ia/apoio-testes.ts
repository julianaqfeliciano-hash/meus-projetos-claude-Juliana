import { vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { DocumentoLido, Fala } from '../../shared/tipos';
import { montarPrefixo, type Papel, type PrefixoPedido } from './prefixo';

/** Só para testes: cliente da Anthropic falso, com os métodos usados pela camada de IA como `vi.fn()`. */
export function criarClienteFalso() {
  const mocks = { create: vi.fn(), stream: vi.fn(), countTokens: vi.fn(), retrieve: vi.fn() };
  const cliente = {
    beta: { messages: { create: mocks.create, stream: mocks.stream, countTokens: mocks.countTokens } },
    models: { retrieve: mocks.retrieve },
  } as unknown as Anthropic;
  return { cliente, ...mocks };
}

export const fala = (quem: Fala['quem'], texto: string, em = 0): Fala => ({ quem, texto, idioma: 'pt', em });

export const docManual: DocumentoLido = {
  caminho: 'C:\\docs\\Manual.pdf',
  nome: 'Manual.pdf',
  tipo: 'pdf',
  aviso: null,
  partes: [
    { rotulo: 'p. 1', texto: 'Introdução ao sistema.' },
    { rotulo: 'p. 2', texto: 'O rateio divide custos entre centros.' },
  ],
};

export function prefixoDe(papel: Papel, documentos: DocumentoLido[] = [docManual]): PrefixoPedido {
  return montarPrefixo({ documentos, contexto: 'Cliente hospital', sobreVoce: 'Consultora', idioma: 'auto' }, papel);
}

/** Resposta de `messages.create` com um bloco de pensamento (que deve ser ignorado) e o texto dado. */
export function respostaTexto(texto: string, stopReason = 'end_turn') {
  return {
    stop_reason: stopReason,
    content: [
      { type: 'thinking', thinking: 'pensando', signature: 'x' },
      { type: 'text', text: texto },
    ],
  };
}

export const delta = (texto: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'text_delta', text: texto },
});

/** Citação de `content_block_location` que aponta para o bloco `bloco` do documento `documento`. */
export const citacao = (documento: number, bloco: number) => ({
  type: 'content_block_delta',
  index: 0,
  delta: {
    type: 'citations_delta',
    citation: {
      type: 'content_block_location',
      cited_text: 'x',
      document_index: documento,
      document_title: 'x',
      start_block_index: bloco,
      end_block_index: bloco + 1,
    },
  },
});

/** Stream falso: itera os eventos na ordem e, se `erro` for dado, lança-o depois do último evento. */
export function streamFalso(eventos: unknown[], stopReason = 'end_turn', erro?: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const e of eventos) yield e;
      if (erro !== undefined) throw erro;
    },
    finalMessage: () => Promise.resolve({ stop_reason: stopReason }),
  };
}

/** Stream falso que nunca produz evento nenhum. Se `sinal` for dado, falha quando ele for abortado. */
export function streamTravado(sinal?: AbortSignal) {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          new Promise<never>((_, rejeitar) => {
            sinal?.addEventListener('abort', () => rejeitar(new Error('abortado')));
          }),
      };
    },
    finalMessage: () => new Promise<never>(() => undefined),
  };
}
