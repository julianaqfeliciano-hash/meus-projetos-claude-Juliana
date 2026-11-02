import { describe, expect, it, vi } from 'vitest';
import type { Preferencias } from '../../shared/tipos';
import { criarLojaPreferencias } from './loja-preferencias';
import { PREFERENCIAS_PADRAO } from './preferencias';

function adiada() {
  let resolver!: () => void;
  let rejeitar!: (e: Error) => void;
  const promessa = new Promise<void>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

describe('criarLojaPreferencias', () => {
  it('grava uma mudança de cada vez, cada uma partindo da anterior', async () => {
    const primeira = adiada();
    const gravadas: Preferencias[] = [];
    const gravar = vi.fn((p: Preferencias) => {
      gravadas.push(p);
      return gravadas.length === 1 ? primeira.promessa : Promise.resolve();
    });
    const loja = criarLojaPreferencias(structuredClone(PREFERENCIAS_PADRAO), gravar);

    const a = loja.atualizar((p) => ({ ...p, sobreVoce: 'Consultora' }));
    const b = loja.atualizar((p) => ({ ...p, ultimosArquivos: ['a.pdf'] }));
    await Promise.resolve();
    expect(gravar).toHaveBeenCalledTimes(1); // a segunda espera a primeira terminar

    primeira.resolver();
    await Promise.all([a, b]);
    expect(gravar).toHaveBeenCalledTimes(2);
    expect(gravadas[1]).toMatchObject({ sobreVoce: 'Consultora', ultimosArquivos: ['a.pdf'] });
    expect(loja.obter()).toMatchObject({ sobreVoce: 'Consultora', ultimosArquivos: ['a.pdf'] });
  });

  it('a memória só muda depois de gravar', async () => {
    const gravacao = adiada();
    const loja = criarLojaPreferencias(structuredClone(PREFERENCIAS_PADRAO), () => gravacao.promessa);
    const mudanca = loja.atualizar((p) => ({ ...p, sobreVoce: 'novo' }));
    await Promise.resolve();
    expect(loja.obter().sobreVoce).toBe('');
    gravacao.resolver();
    await expect(mudanca).resolves.toMatchObject({ sobreVoce: 'novo' });
    expect(loja.obter().sobreVoce).toBe('novo');
  });

  it('uma gravação que falha rejeita só o seu pedido e não muda a memória; as próximas seguem', async () => {
    const gravar = vi
      .fn<(p: Preferencias) => Promise<void>>()
      .mockRejectedValueOnce(new Error('EACCES'))
      .mockResolvedValue(undefined);
    const loja = criarLojaPreferencias(structuredClone(PREFERENCIAS_PADRAO), gravar);

    const falha = loja.atualizar((p) => ({ ...p, sobreVoce: 'perdido' }));
    const depois = loja.atualizar((p) => ({ ...p, opacidadePainel: 0.8 }));
    await expect(falha).rejects.toThrow('EACCES');
    await expect(depois).resolves.toMatchObject({ sobreVoce: '', opacidadePainel: 0.8 });
    expect(loja.obter()).toMatchObject({ sobreVoce: '', opacidadePainel: 0.8 });
  });
});
