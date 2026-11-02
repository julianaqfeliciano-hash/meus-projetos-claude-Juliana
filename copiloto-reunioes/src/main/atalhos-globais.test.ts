import { describe, expect, it, vi } from 'vitest';
import type { AcaoAtalho } from '../shared/tipos';
import { registrarAtalhos } from './atalhos-globais';
import { ATALHOS_PADRAO } from './config/atalhos';

function criarAcoesFalsas(): Record<AcaoAtalho, () => void> {
  return {
    ajudarResponder: vi.fn(),
    explicar: vi.fn(),
    digitar: vi.fn(),
    ocultar: vi.fn(),
    pausar: vi.fn(),
    anterior: vi.fn(),
    proximo: vi.fn(),
  };
}

describe('registrarAtalhos', () => {
  it('registra todos e informa recusados', () => {
    const acoesFalsas = criarAcoesFalsas();
    const gs = { register: vi.fn((a: string) => a !== 'Control+Alt+X'), unregisterAll: vi.fn() };
    const r = registrarAtalhos(gs, ATALHOS_PADRAO, acoesFalsas);
    expect(gs.unregisterAll).toHaveBeenCalledBefore(gs.register);
    expect(r.explicar).toBe(false);
    expect(r.pausar).toBe(true);
    expect(gs.register).toHaveBeenCalledTimes(7);
  });

  it('cada atalho chama a sua ação', () => {
    const acoes = criarAcoesFalsas();
    const registrados = new Map<string, () => void>();
    const gs = {
      register: vi.fn((a: string, fn: () => void) => {
        registrados.set(a, fn);
        return true;
      }),
      unregisterAll: vi.fn(),
    };
    registrarAtalhos(gs, ATALHOS_PADRAO, acoes);
    registrados.get('Control+Alt+,')?.();
    expect(acoes.anterior).toHaveBeenCalledTimes(1);
    expect(acoes.proximo).not.toHaveBeenCalled();
    registrados.get('Control+Alt+Space')?.();
    expect(acoes.ajudarResponder).toHaveBeenCalledTimes(1);
  });

  it('um atalho que o Electron não entende conta como recusado, sem impedir os outros', () => {
    const gs = {
      register: vi.fn((a: string) => {
        if (a === 'Control+Alt+???') throw new TypeError('conversion failure');
        return true;
      }),
      unregisterAll: vi.fn(),
    };
    const r = registrarAtalhos(gs, { ...ATALHOS_PADRAO, digitar: 'Control+Alt+???' }, criarAcoesFalsas());
    expect(r.digitar).toBe(false);
    expect(r.ocultar).toBe(true);
    expect(gs.register).toHaveBeenCalledTimes(7);
  });
});
