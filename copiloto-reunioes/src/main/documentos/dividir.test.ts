import { describe, it, expect } from 'vitest';
import { dividirTexto } from './dividir';

describe('dividirTexto', () => {
  it('mantém texto curto inteiro', () => {
    expect(dividirTexto('abc')).toEqual(['abc']);
  });

  it('corta em parágrafos sem passar do limite', () => {
    const p = 'a'.repeat(2000);
    const partes = dividirTexto(`${p}\n\n${p}`);
    expect(partes).toHaveLength(2);
    expect(partes.every((x) => x.length <= 3000)).toBe(true);
  });

  it('corta parágrafo gigante', () => {
    expect(dividirTexto('x'.repeat(7000)).every((x) => x.length <= 3000)).toBe(true);
  });

  it('junta parágrafos curtos enquanto couberem no limite', () => {
    expect(dividirTexto('um\n\ndois\n\ntrês')).toEqual(['um\n\ndois\n\ntrês']);
  });

  it('corta parágrafo grande em fim de frase', () => {
    const frase = `${'b'.repeat(98)}. `;
    const partes = dividirTexto(frase.repeat(50), 1000);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((x) => x.length <= 1000)).toBe(true);
    expect(partes.every((x) => x.endsWith('.'))).toBe(true);
    expect(partes.join(' ')).toBe(frase.repeat(50).trim());
  });

  it('corta seco quando não há fim de frase e não perde caracteres', () => {
    const partes = dividirTexto('x'.repeat(7000));
    expect(partes.map((x) => x.length)).toEqual([3000, 3000, 1000]);
  });

  it('descarta pedaços vazios', () => {
    expect(dividirTexto('')).toEqual([]);
    expect(dividirTexto('   \n\n  \n\n')).toEqual([]);
    expect(dividirTexto('a\n\n\n\n\n\nb', 1)).toEqual(['a', 'b']);
  });

  it('respeita um limite personalizado', () => {
    expect(dividirTexto('aaaa\n\nbbbb', 5)).toEqual(['aaaa', 'bbbb']);
  });
});
