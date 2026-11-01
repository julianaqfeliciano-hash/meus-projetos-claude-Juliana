import { describe, it, expect } from 'vitest';
import type { Fala } from '../../shared/tipos';
import { Transcricao, formatarFalas } from './transcricao';

const fala = (quem: Fala['quem'], texto: string, em: number): Fala => ({ quem, texto, idioma: 'pt', em });

describe('Transcricao', () => {
  it('janela pega só os últimos ms', () => {
    const tr = new Transcricao();
    tr.adicionar({ quem: 'outros', texto: 'velha', idioma: 'pt', em: 0 });
    tr.adicionar({ quem: 'voce', texto: 'nova', idioma: 'pt', em: 200_000 });
    expect(tr.janela(180_000, 200_000).map((f) => f.texto)).toEqual(['nova']);
    expect(tr.ultimaDe('outros')).toBe(0);
    expect(tr.ultimaQualquer()).toBe(200_000);
  });

  it('janela inclui a fala exatamente no limite agora - ms', () => {
    const tr = new Transcricao();
    tr.adicionar(fala('outros', 'limite', 20_000));
    tr.adicionar(fala('voce', 'dentro', 25_000));
    expect(tr.janela(10_000, 30_000).map((f) => f.texto)).toEqual(['limite', 'dentro']);
    expect(tr.janela(9_999, 30_000).map((f) => f.texto)).toEqual(['dentro']);
  });

  it('janela mantém a ordem de inserção', () => {
    const tr = new Transcricao();
    tr.adicionar(fala('outros', 'b', 20));
    tr.adicionar(fala('voce', 'a', 10));
    tr.adicionar(fala('outros', 'c', 30));
    expect(tr.janela(100, 30).map((f) => f.texto)).toEqual(['b', 'a', 'c']);
    expect(tr.todas().map((f) => f.texto)).toEqual(['b', 'a', 'c']);
  });

  it('todas devolve uma cópia da lista', () => {
    const tr = new Transcricao();
    tr.adicionar(fala('voce', 'oi', 0));
    tr.todas().push(fala('voce', 'intruso', 1));
    expect(tr.todas()).toHaveLength(1);
  });

  it('ultimaDe devolve o em da fala mais recente de cada lado', () => {
    const tr = new Transcricao();
    tr.adicionar(fala('outros', 'a', 10));
    tr.adicionar(fala('voce', 'b', 20));
    tr.adicionar(fala('outros', 'c', 30));
    expect(tr.ultimaDe('outros')).toBe(30);
    expect(tr.ultimaDe('voce')).toBe(20);
  });

  it('sem falas, ultimaDe e ultimaQualquer devolvem null e a janela é vazia', () => {
    const tr = new Transcricao();
    expect(tr.ultimaDe('voce')).toBeNull();
    expect(tr.ultimaDe('outros')).toBeNull();
    expect(tr.ultimaQualquer()).toBeNull();
    expect(tr.janela(1000, 1000)).toEqual([]);
    expect(tr.todas()).toEqual([]);
  });

  it('ultimaDe devolve null para quem ainda não falou', () => {
    const tr = new Transcricao();
    tr.adicionar(fala('outros', 'a', 10));
    expect(tr.ultimaDe('voce')).toBeNull();
  });

  it('limpar esvazia a transcrição', () => {
    const tr = new Transcricao();
    tr.adicionar(fala('outros', 'a', 10));
    tr.limpar();
    expect(tr.todas()).toEqual([]);
    expect(tr.ultimaQualquer()).toBeNull();
    expect(tr.ultimaDe('outros')).toBeNull();
  });
});

describe('formatarFalas', () => {
  it('formata com rótulos', () => {
    expect(formatarFalas([
      { quem: 'outros', texto: 'Oi', idioma: 'pt', em: 0 },
      { quem: 'voce', texto: 'Olá', idioma: 'pt', em: 1 },
    ])).toBe('[Outros] Oi\n[Você] Olá');
  });

  it('lista vazia dá texto vazio', () => {
    expect(formatarFalas([])).toBe('');
  });
});
