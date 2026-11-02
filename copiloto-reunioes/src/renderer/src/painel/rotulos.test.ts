import { describe, expect, it } from 'vitest';
import type { InstantaneoReuniao } from '../../../shared/tipos';
import { rotuloEstado, textoFonte } from './rotulos';

const inst: InstantaneoReuniao = {
  estado: 'ouvindo',
  modo: 'audio',
  conexao: { voce: 'ok', outros: 'ok' },
  cartoes: [],
  indiceAtual: 0,
  avisos: [],
  parciais: { voce: '', outros: '' },
  transcricao: [],
};

describe('rotuloEstado', () => {
  it('erro de conexão tem prioridade', () => {
    expect(rotuloEstado({ ...inst, estado: 'ouvindo', conexao: { voce: 'ok', outros: 'erro' } })).toBe('erro de conexão');
  });

  it('erro de conexão vence reconectando, pausa e ensaio', () => {
    const i = { ...inst, estado: 'pausado', modo: 'ensaio', conexao: { voce: 'reconectando', outros: 'erro' } } as const;
    expect(rotuloEstado(i)).toBe('erro de conexão');
  });

  it('reconectando vence pausado e ouvindo', () => {
    expect(rotuloEstado({ ...inst, estado: 'pausado', conexao: { voce: 'reconectando', outros: 'ok' } })).toBe('reconectando…');
    expect(rotuloEstado({ ...inst, estado: 'ouvindo', conexao: { voce: 'ok', outros: 'reconectando' } })).toBe('reconectando…');
  });

  it('pausado', () => {
    expect(rotuloEstado({ ...inst, estado: 'pausado' })).toBe('pausado');
  });

  it('pausado vence ensaio', () => {
    expect(rotuloEstado({ ...inst, estado: 'pausado', modo: 'ensaio' })).toBe('pausado');
  });

  it('ensaio', () => {
    expect(rotuloEstado({ ...inst, estado: 'ouvindo', modo: 'ensaio' })).toBe('ensaio');
  });

  it('ouvindo', () => {
    expect(rotuloEstado({ ...inst, estado: 'ouvindo' })).toBe('ouvindo');
  });

  it('encerrando mostra que o resumo está sendo gerado', () => {
    expect(rotuloEstado({ ...inst, estado: 'encerrando' })).toBe('gerando resumo…');
  });

  it('nos demais estados não há rótulo', () => {
    expect(rotuloEstado({ ...inst, estado: 'preparando' })).toBe('');
    expect(rotuloEstado({ ...inst, estado: 'concluida' })).toBe('');
  });
});

describe('textoFonte', () => {
  it('texto da fonte', () => {
    expect(textoFonte({ arquivo: 'Manual.pdf', local: 'p. 12' })).toBe('Manual.pdf, p. 12');
  });
});
