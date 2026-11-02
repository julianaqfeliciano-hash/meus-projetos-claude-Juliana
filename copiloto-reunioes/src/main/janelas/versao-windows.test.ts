import { describe, expect, it } from 'vitest';
import { suportaExclusaoCaptura } from './versao-windows';

describe('suportaExclusaoCaptura', () => {
  it('Windows 10 2004+ suporta exclusão', () => {
    expect(suportaExclusaoCaptura('10.0.19041')).toBe(true);
    expect(suportaExclusaoCaptura('10.0.22631')).toBe(true);
    expect(suportaExclusaoCaptura('10.0.18363')).toBe(false);
    expect(suportaExclusaoCaptura('6.3.9600')).toBe(false);
    expect(suportaExclusaoCaptura('lixo')).toBe(false);
  });

  it('versão sem build ou de outra plataforma não suporta', () => {
    expect(suportaExclusaoCaptura('10.0')).toBe(false);
    expect(suportaExclusaoCaptura('')).toBe(false);
    expect(suportaExclusaoCaptura('6.18.44-fc-v185')).toBe(false);
    expect(suportaExclusaoCaptura('100.0.20000')).toBe(false);
  });
});
