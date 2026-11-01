import { describe, expect, it } from 'vitest';
import { normalizarChave } from './normalizar';

describe('normalizarChave', () => {
  it('acentos, caixa e plural', () => {
    expect(normalizarChave('APIs REST')).toBe(normalizarChave('api rest'));
    expect(normalizarChave('Faturação!')).toBe('faturacao');
  });

  it('tira a pontuação e junta os espaços', () => {
    expect(normalizarChave('  Qual   o prazo,  afinal? ')).toBe('qual o prazo afinal');
    expect(normalizarChave('NF-e')).toBe(normalizarChave('NFe'));
  });

  it('só palavras com mais de 3 letras perdem o "s" final', () => {
    expect(normalizarChave('centros de custos')).toBe('centro de custo');
    expect(normalizarChave('gás mais')).toBe('gas mai');
    expect(normalizarChave('SLAs')).toBe('sla');
    expect(normalizarChave('ss')).toBe('ss');
  });
});
