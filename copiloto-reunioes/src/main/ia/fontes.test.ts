import { describe, it, expect } from 'vitest';
import { fontesDeCitacoes } from './fontes';

const bloco = (document_index: unknown, start_block_index: unknown, end_block_index: unknown = 99) => ({
  type: 'content_block_location',
  document_index,
  start_block_index,
  end_block_index,
});

const mapa = [
  { arquivo: 'Manual.pdf', rotulos: ['p. 1', 'p. 2'] },
  { arquivo: 'Proposta.pptx', rotulos: ['slide 1', 'slide 2', 'slide 3'] },
];

describe('fontesDeCitacoes', () => {
  it('converte content_block_location em arquivo e página', () => {
    const m = [{ arquivo: 'Manual.pdf', rotulos: ['p. 1', 'p. 2'] }];
    expect(
      fontesDeCitacoes(
        [
          { type: 'content_block_location', document_index: 0, start_block_index: 1, end_block_index: 2 },
          { type: 'content_block_location', document_index: 0, start_block_index: 1, end_block_index: 2 },
          { type: 'char_location' },
        ],
        m,
      ),
    ).toEqual([{ arquivo: 'Manual.pdf', local: 'p. 2' }]);
  });

  it('usa o bloco inicial e mantém a ordem da primeira ocorrência', () => {
    expect(fontesDeCitacoes([bloco(1, 2, 3), bloco(0, 0, 2), bloco(1, 0, 1), bloco(1, 2, 3)], mapa)).toEqual([
      { arquivo: 'Proposta.pptx', local: 'slide 3' },
      { arquivo: 'Manual.pdf', local: 'p. 1' },
      { arquivo: 'Proposta.pptx', local: 'slide 1' },
    ]);
  });

  it('ignora outros tipos de citação', () => {
    const outros = [
      { type: 'page_location', document_index: 0, start_page_number: 1 },
      { type: 'char_location', document_index: 0, start_char_index: 0 },
      { type: 'web_search_result_location', url: 'https://exemplo.com' },
    ];
    expect(fontesDeCitacoes(outros, mapa)).toEqual([]);
  });

  it('ignora índices fora do mapa', () => {
    expect(fontesDeCitacoes([bloco(5, 0), bloco(-1, 0), bloco(0, 2), bloco(0, -1), bloco(1, 3)], mapa)).toEqual([]);
  });

  it('ignora índices ausentes, não inteiros ou de tipo errado', () => {
    const ruins = [
      { type: 'content_block_location' },
      { type: 'content_block_location', document_index: 0 },
      { type: 'content_block_location', start_block_index: 0 },
      bloco('0', 0),
      bloco(0, '0'),
      bloco(0.5, 0),
      bloco(0, 0.5),
      bloco(Number.NaN, 0),
      bloco(0, Number.POSITIVE_INFINITY),
      bloco(null, 0),
      bloco(0, null),
      bloco(0, 'length'),
    ];
    expect(fontesDeCitacoes(ruins, mapa)).toEqual([]);
  });

  it('tolera entradas que não são objetos', () => {
    expect(fontesDeCitacoes([null, undefined, 7, 'texto', true, [], [bloco(0, 0)]], mapa)).toEqual([]);
  });

  it('um acerto válido no meio de entradas inválidas continua valendo', () => {
    expect(fontesDeCitacoes([null, bloco(9, 9), bloco(0, 1), 'x'], mapa)).toEqual([{ arquivo: 'Manual.pdf', local: 'p. 2' }]);
  });

  it('lista vazia ou mapa vazio devolvem lista vazia', () => {
    expect(fontesDeCitacoes([], mapa)).toEqual([]);
    expect(fontesDeCitacoes([bloco(0, 0)], [])).toEqual([]);
  });

  it('não aceita rótulo que não seja texto no mapa', () => {
    const torto = [{ arquivo: 'X.pdf', rotulos: [undefined as unknown as string] }];
    expect(fontesDeCitacoes([bloco(0, 0)], torto)).toEqual([]);
  });
});
