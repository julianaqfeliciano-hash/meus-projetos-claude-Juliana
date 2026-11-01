import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BETAS_OPUS, MODELO_DETECTOR, MODELO_PRINCIPAL } from './modelos';
import { RecusaIa } from './erros';
import { pedirEstruturado } from './estruturado';
import { criarClienteFalso, prefixoDe, respostaTexto } from './apoio-testes';
import { montarMensagens } from './prefixo';

const esquema = z.strictObject({ nome: z.string(), itens: z.array(z.strictObject({ n: z.number() })) });
const prefixo = prefixoDe('detector');
const mensagens = montarMensagens(prefixo, 'tarefa');

let falso: ReturnType<typeof criarClienteFalso>;
beforeEach(() => {
  falso = criarClienteFalso();
});

const chamar = (modelo: string, esforco: 'low' | 'medium' = 'low') =>
  pedirEstruturado(falso.cliente, { modelo, esforco, system: prefixo.system, mensagens, esquema, maxTokens: 123 });

describe('pedirEstruturado', () => {
  it('manda o esquema JSON, valida e devolve o objeto', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"nome":"a","itens":[{"n":1}]}'));
    expect(await chamar(MODELO_DETECTOR, 'medium')).toEqual({ nome: 'a', itens: [{ n: 1 }] });
    const args = falso.create.mock.calls[0][0];
    expect(args).toMatchObject({
      model: MODELO_DETECTOR,
      max_tokens: 123,
      system: prefixo.system,
      messages: mensagens,
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
    expect(args.output_config.format.schema).toMatchObject({ type: 'object', required: ['nome', 'itens'] });
  });

  it('o esquema enviado tem additionalProperties: false em todo objeto', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"nome":"a","itens":[]}'));
    await chamar(MODELO_DETECTOR);
    const schema = falso.create.mock.calls[0][0].output_config.format.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.itens.items.additionalProperties).toBe(false);
    expect(schema.$schema).toBeUndefined();
  });

  it('modelo Opus leva o beta e o fallback; o Haiku não', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"nome":"a","itens":[]}'));
    await chamar(MODELO_PRINCIPAL);
    expect(falso.create.mock.calls[0][0]).toMatchObject({ betas: BETAS_OPUS, fallbacks: 'default' });
    await chamar(MODELO_DETECTOR);
    const haiku = falso.create.mock.calls[1][0];
    expect(haiku.betas).toBeUndefined();
    expect(haiku.fallbacks).toBeUndefined();
  });

  it('nunca envia thinking, temperature, top_p nem top_k', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"nome":"a","itens":[]}'));
    await chamar(MODELO_PRINCIPAL);
    const args = falso.create.mock.calls[0][0];
    for (const campo of ['thinking', 'temperature', 'top_p', 'top_k']) expect(args).not.toHaveProperty(campo);
  });

  it('junta vários blocos de texto e ignora os de pensamento', async () => {
    falso.create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '{"lixo":true}', signature: 'x' },
        { type: 'text', text: '{"nome":"a",' },
        { type: 'text', text: '"itens":[]}' },
      ],
    });
    expect(await chamar(MODELO_DETECTOR)).toEqual({ nome: 'a', itens: [] });
  });

  it('stop_reason refusal vira RecusaIa', async () => {
    falso.create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(chamar(MODELO_PRINCIPAL)).rejects.toBeInstanceOf(RecusaIa);
  });

  it('JSON que não bate com o esquema é rejeitado', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"nome":1,"itens":[]}'));
    await expect(chamar(MODELO_DETECTOR)).rejects.toThrow();
  });

  it('campo extra é rejeitado (strictObject)', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"nome":"a","itens":[],"extra":true}'));
    await expect(chamar(MODELO_DETECTOR)).rejects.toThrow();
  });

  it('texto que não é JSON é rejeitado', async () => {
    falso.create.mockResolvedValue(respostaTexto('{"nome":"a","itens":['));
    await expect(chamar(MODELO_DETECTOR)).rejects.toThrow(SyntaxError);
  });

  it('erro da API passa direto para quem chamou', async () => {
    const erro = new Error('offline');
    falso.create.mockRejectedValue(erro);
    await expect(chamar(MODELO_DETECTOR)).rejects.toBe(erro);
  });
});
