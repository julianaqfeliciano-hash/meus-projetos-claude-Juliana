import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemDetectado } from '../../shared/tipos';
import { criarDetector } from './detector';
import { MODELO_DETECTOR } from './modelos';
import { criarClienteFalso, fala, prefixoDe, respostaTexto } from './apoio-testes';

const prefixo = prefixoDe('detector');
const i1: ItemDetectado = { tipo: 'pergunta', texto: 'Como funciona o rateio?', idioma: 'pt' };
const i2: ItemDetectado = { tipo: 'conceito', texto: 'Centro de custo', idioma: 'pt' };
const i3: ItemDetectado = { tipo: 'conceito', texto: 'Provisão', idioma: 'pt' };
const falaOutros = fala('outros', 'Como funciona o rateio?');
const falaVoce = fala('voce', 'Vou explicar.');

let falso: ReturnType<typeof criarClienteFalso>;
beforeEach(() => {
  falso = criarClienteFalso();
});

/** Percorre o esquema e junta os objetos que não têm `additionalProperties: false`. */
function objetosAbertos(no: unknown, caminho = '$'): string[] {
  if (Array.isArray(no)) return no.flatMap((n, i) => objetosAbertos(n, `${caminho}[${i}]`));
  if (typeof no !== 'object' || no === null) return [];
  const obj = no as Record<string, unknown>;
  const aqui = obj.type === 'object' && obj.additionalProperties !== false ? [caminho] : [];
  return [...aqui, ...Object.entries(obj).flatMap(([k, v]) => objetosAbertos(v, `${caminho}.${k}`))];
}

describe('criarDetector', () => {
  it('Haiku, esforço baixo, sem fallback, no máximo 2 itens', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ itens: [i1, i2, i3] })));
    const itens = await criarDetector(falso.cliente, prefixo).detectar([falaOutros], []);
    expect(itens).toEqual([i1, i2]);
    const args = falso.create.mock.calls[0][0];
    expect(args.model).toBe(MODELO_DETECTOR);
    expect(args.model).toBe('claude-haiku-5-5');
    expect(args.max_tokens).toBe(2000);
    expect(args.output_config.effort).toBe('low');
    expect(args.fallbacks).toBeUndefined();
    expect(args.betas).toBeUndefined();
    expect(args.thinking).toBeUndefined();
    expect(args.system).toEqual(prefixo.system);
  });

  it('o esquema pedido tem additionalProperties: false em todos os níveis', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"itens":[]}'));
    await criarDetector(falso.cliente, prefixo).detectar([falaOutros], []);
    const schema = falso.create.mock.calls[0][0].output_config.format.schema;
    expect(schema.properties.itens.items.type).toBe('object');
    expect(objetosAbertos(schema)).toEqual([]);
  });

  it('a tarefa traz as falas formatadas e os itens já cobertos, depois dos documentos', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"itens":[]}'));
    await criarDetector(falso.cliente, prefixo).detectar([falaOutros, falaVoce], ['Centro de custo', 'Provisão']);
    const conteudo = falso.create.mock.calls[0][0].messages[0].content;
    expect(conteudo[0]).toMatchObject({ type: 'document', title: 'Manual.pdf' });
    const tarefa = conteudo.at(-1).text;
    expect(tarefa).toContain('[Outros] Como funciona o rateio?\n[Você] Vou explicar.');
    expect(tarefa).toContain('Itens já cobertos: Centro de custo; Provisão');
  });

  it('sem itens cobertos a tarefa diz "nenhum"', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"itens":[]}'));
    await criarDetector(falso.cliente, prefixo).detectar([falaOutros], []);
    expect(falso.create.mock.calls[0][0].messages[0].content.at(-1).text).toContain('Itens já cobertos: nenhum');
  });

  it('sem fala dos outros não chama a API', async () => {
    expect(await criarDetector(falso.cliente, prefixo).detectar([falaVoce], [])).toEqual([]);
    expect(await criarDetector(falso.cliente, prefixo).detectar([], [])).toEqual([]);
    expect(falso.create).not.toHaveBeenCalled();
  });

  it('esquema inválido na resposta vira erro', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ itens: [{ tipo: 'outro', texto: 'x', idioma: 'pt' }] })));
    await expect(criarDetector(falso.cliente, prefixo).detectar([falaOutros], [])).rejects.toThrow();
  });
});
