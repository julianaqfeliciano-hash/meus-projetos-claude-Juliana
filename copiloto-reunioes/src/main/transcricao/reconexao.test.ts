import { describe, it, expect } from 'vitest';
import { atrasoReconexao } from './reconexao';

describe('atrasoReconexao', () => {
  it('sequência de espera', () => {
    expect([0, 1, 2, 3, 4, 9].map(atrasoReconexao)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
  });

  it('tentativa negativa conta como 0', () => {
    expect(atrasoReconexao(-1)).toBe(1000);
    expect(atrasoReconexao(-100)).toBe(1000);
  });

  it('fração é arredondada para baixo', () => {
    expect(atrasoReconexao(1.9)).toBe(2000);
    expect(atrasoReconexao(3.5)).toBe(8000);
    expect(atrasoReconexao(0.5)).toBe(1000);
  });

  it('NaN conta como 0', () => {
    expect(atrasoReconexao(NaN)).toBe(1000);
  });

  it('infinito dá o teto', () => {
    expect(atrasoReconexao(Infinity)).toBe(15000);
  });
});
