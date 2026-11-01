import { describe, it, expect } from 'vitest';
import type { ContextoReuniao, DocumentoLido } from '../../shared/tipos';
import { montarMensagens, montarPrefixo, type Papel } from './prefixo';
import { instrucoes } from './instrucoes';

const doc = (nome: string, rotulos: string[], aviso: DocumentoLido['aviso'] = null): DocumentoLido => ({
  caminho: nome,
  nome,
  tipo: 'pdf',
  aviso,
  partes: rotulos.map((r) => ({ rotulo: r, texto: `texto ${r}` })),
});

const ctx: ContextoReuniao = {
  documentos: [doc('Manual.pdf', ['p. 1', 'p. 2']), doc('Scan.pdf', [], 'digitalizado')],
  contexto: 'Cliente hospital',
  sobreVoce: 'Consultora',
  idioma: 'auto',
};

const PAPEIS: Papel[] = ['detector', 'explicador', 'resumo'];
const contar = (json: string) => json.split('"cache_control"').length - 1;

function congelarProfundo<T>(valor: T): T {
  if (typeof valor === 'object' && valor !== null) {
    Object.values(valor).forEach(congelarProfundo);
    Object.freeze(valor);
  }
  return valor;
}

describe('montarPrefixo', () => {
  it('prefixo é idêntico byte a byte entre chamadas', () => {
    expect(JSON.stringify(montarPrefixo(ctx, 'explicador'))).toBe(JSON.stringify(montarPrefixo(ctx, 'explicador')));
  });

  it('cache de 1 h só no último documento do explicador', () => {
    const p = montarPrefixo(ctx, 'explicador');
    expect(p.documentos).toHaveLength(1);
    expect(p.documentos[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(p.system.every((b) => !b.cache_control)).toBe(true);
    expect(p.documentos[0].citations).toEqual({ enabled: true });
  });

  it('detector: cache 5 min e sem citações', () => {
    const p = montarPrefixo(ctx, 'detector');
    expect(p.documentos[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(p.documentos[0].citations).toEqual({ enabled: false });
  });

  it('resumo: cache de 1 h e sem citações', () => {
    const p = montarPrefixo(ctx, 'resumo');
    expect(p.documentos[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(p.documentos[0].citations).toEqual({ enabled: false });
  });

  it('detector sem ttl: a chave nem existe no JSON', () => {
    expect(JSON.stringify(montarPrefixo(ctx, 'detector'))).not.toContain('ttl');
  });

  it('montarPrefixo sem documentos põe o cache no system', () => {
    const p = montarPrefixo({ ...ctx, documentos: [] }, 'explicador');
    expect(p.documentos).toEqual([]);
    expect(p.system.at(-1)?.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
  });

  it('só documentos sem aviso e com partes entram, e o cache fica no último deles', () => {
    const vazio = doc('Vazio.txt', []);
    const c = { ...ctx, documentos: [doc('A.pdf', ['p. 1']), doc('Ruim.docx', ['seção 1'], 'erro-leitura'), vazio, doc('B.pdf', ['p. 3'])] };
    const p = montarPrefixo(c, 'explicador');
    expect(p.documentos.map((d) => d.title)).toEqual(['A.pdf', 'B.pdf']);
    expect(p.documentos[0].cache_control).toBeUndefined();
    expect(p.documentos[1].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
  });

  it('com documentos descartados, o cache cai no system', () => {
    const p = montarPrefixo({ ...ctx, documentos: [doc('Ruim.docx', ['seção 1'], 'erro-leitura')] }, 'detector');
    expect(p.documentos).toEqual([]);
    expect(p.system.at(-1)?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it.each(PAPEIS)('%s: exatamente um cache_control em todo o prefixo', (papel) => {
    expect(contar(JSON.stringify(montarPrefixo(ctx, papel)))).toBe(1);
    expect(contar(JSON.stringify(montarPrefixo({ ...ctx, documentos: [] }, papel)))).toBe(1);
    const varios = { ...ctx, documentos: [doc('A.pdf', ['p. 1']), doc('B.pdf', ['p. 2']), doc('C.pdf', ['p. 3'])] };
    expect(contar(JSON.stringify(montarPrefixo(varios, papel)))).toBe(1);
  });

  it('system: instruções, depois "Sobre a usuária", depois "Contexto da reunião"', () => {
    const p = montarPrefixo(ctx, 'explicador');
    expect(p.system).toEqual([
      { type: 'text', text: instrucoes('explicador', 'auto') },
      { type: 'text', text: 'Sobre a usuária: Consultora' },
      { type: 'text', text: 'Contexto da reunião: Cliente hospital' },
    ]);
    expect(p.system.some((b) => 'cache_control' in b)).toBe(false);
  });

  it('omite "Sobre a usuária" e "Contexto da reunião" quando vazios ou só espaços', () => {
    const p = montarPrefixo({ ...ctx, sobreVoce: '', contexto: '  \n ' }, 'detector');
    expect(p.system).toHaveLength(1);
    expect(p.system[0].text).toBe(instrucoes('detector', 'auto'));
    const soContexto = montarPrefixo({ ...ctx, sobreVoce: ' ' }, 'detector');
    expect(soContexto.system.map((b) => b.text)).toEqual([instrucoes('detector', 'auto'), 'Contexto da reunião: Cliente hospital']);
  });

  it('o idioma escolhido muda as instruções do explicador', () => {
    const en = montarPrefixo({ ...ctx, idioma: 'en' }, 'explicador');
    expect(en.system[0].text).toBe(instrucoes('explicador', 'en'));
    expect(en.system[0].text).not.toBe(montarPrefixo(ctx, 'explicador').system[0].text);
  });

  it('cada documento vira um bloco document de fonte content, com título e partes rotuladas', () => {
    const [d] = montarPrefixo(ctx, 'explicador').documentos;
    expect(d.type).toBe('document');
    expect(d.title).toBe('Manual.pdf');
    expect(d.source).toEqual({
      type: 'content',
      content: [
        { type: 'text', text: '[p. 1]\ntexto p. 1' },
        { type: 'text', text: '[p. 2]\ntexto p. 2' },
      ],
    });
  });

  it('rótulo vai no texto de cada parte', () => {
    const src = montarPrefixo(ctx, 'explicador').documentos[0].source as { content: { text: string }[] };
    expect(src.content[1].text).toBe('[p. 2]\ntexto p. 2');
  });

  it('mapaFontes fica alinhado com documentos', () => {
    const c = { ...ctx, documentos: [doc('A.pdf', ['p. 1', 'p. 2']), doc('Ruim.pdf', ['p. 1'], 'erro-leitura'), doc('B.pdf', ['slide 1'])] };
    const p = montarPrefixo(c, 'explicador');
    expect(p.mapaFontes).toEqual([
      { arquivo: 'A.pdf', rotulos: ['p. 1', 'p. 2'] },
      { arquivo: 'B.pdf', rotulos: ['slide 1'] },
    ]);
    expect(p.mapaFontes).toHaveLength(p.documentos.length);
  });

  it('a saída não contém data, hora nem identificador', () => {
    for (const papel of PAPEIS) {
      const json = JSON.stringify(montarPrefixo(ctx, papel));
      expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(json).not.toMatch(/\d{1,2}:\d{2}/);
      expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
  });

  it('não altera a entrada', () => {
    const entrada = congelarProfundo(structuredClone(ctx));
    const antes = JSON.stringify(entrada);
    expect(() => montarPrefixo(entrada, 'explicador')).not.toThrow();
    expect(JSON.stringify(entrada)).toBe(antes);
  });

  it('devolve objetos novos a cada chamada', () => {
    const a = montarPrefixo(ctx, 'explicador');
    const b = montarPrefixo(ctx, 'explicador');
    expect(a).not.toBe(b);
    expect(a.system[0]).not.toBe(b.system[0]);
    expect(a.documentos[0]).not.toBe(b.documentos[0]);
    expect(a.documentos[0].cache_control).not.toBe(b.documentos[0].cache_control);
    expect(a.mapaFontes[0]).not.toBe(b.mapaFontes[0]);
    expect(a.mapaFontes[0].rotulos).not.toBe(b.mapaFontes[0].rotulos);
    // Mexer no resultado de uma chamada não contamina a seguinte.
    a.documentos[0].cache_control = null;
    a.mapaFontes[0].rotulos.push('lixo');
    const c = montarPrefixo(ctx, 'explicador');
    expect(c.documentos[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(c.mapaFontes[0].rotulos).toEqual(['p. 1', 'p. 2']);
  });
});

describe('montarMensagens', () => {
  it('mensagens: documentos e depois a tarefa', () => {
    const p = montarPrefixo(ctx, 'explicador');
    const m = montarMensagens(p, 'TAREFA');
    expect(m).toHaveLength(1);
    expect(m[0].role).toBe('user');
    const conteudo = m[0].content as unknown[];
    expect(conteudo).toEqual([...p.documentos, { type: 'text', text: 'TAREFA' }]);
    expect(conteudo.at(-1)).toEqual({ type: 'text', text: 'TAREFA' });
  });

  it('sem documentos, a mensagem tem só a tarefa', () => {
    const p = montarPrefixo({ ...ctx, documentos: [] }, 'detector');
    expect(montarMensagens(p, 'T')).toEqual([{ role: 'user', content: [{ type: 'text', text: 'T' }] }]);
  });

  it('a tarefa não leva cache_control', () => {
    const m = montarMensagens(montarPrefixo(ctx, 'explicador'), 'T');
    expect((m[0].content as { cache_control?: unknown }[]).at(-1)?.cache_control).toBeUndefined();
  });
});
