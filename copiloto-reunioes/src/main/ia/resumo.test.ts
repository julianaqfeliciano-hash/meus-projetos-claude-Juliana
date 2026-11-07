import { beforeEach, describe, expect, it } from 'vitest';
import type { ResumoReuniao } from '../../shared/tipos';
import { BETAS_OPUS, MODELO_PRINCIPAL } from './modelos';
import { RecusaIa } from './erros';
import { criarResumidor } from './resumo';
import { criarClienteFalso, fala, prefixoDe, respostaTexto } from './apoio-testes';

const prefixo = prefixoDe('resumo');
const resumoValido: ResumoReuniao = {
  assuntos: ['Rateio de custos'],
  duvidasCliente: ['Como o rateio é calculado?'],
  decisoes: ['Usar centro de custo por unidade'],
  pendencias: [],
  proximosPassos: ['Ana envia a planilha até sexta'],
};
const falas = [fala('outros', 'Como funciona o rateio?'), fala('voce', 'Ele divide os custos entre centros.')];

let falso: ReturnType<typeof criarClienteFalso>;
beforeEach(() => {
  falso = criarClienteFalso();
});

describe('criarResumidor', () => {
  it('valida o esquema e devolve o resumo', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(resumoValido)));
    expect(await criarResumidor(falso.cliente, prefixo).resumir(falas, ['Rateio'])).toEqual(resumoValido);
  });

  it('Opus com esforço médio, fallback e 8000 tokens', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(resumoValido)));
    await criarResumidor(falso.cliente, prefixo).resumir(falas, ['Rateio']);
    const args = falso.create.mock.calls[0][0];
    expect(args).toMatchObject({
      model: MODELO_PRINCIPAL,
      max_tokens: 8000,
      betas: BETAS_OPUS,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
    expect(args.system).toEqual(prefixo.system.map((b) => ({ type: 'text', text: b.text })));
    expect(falso.create.mock.calls[0][1]).toEqual({ timeout: 90_000, maxRetries: 1 });
    for (const campo of ['thinking', 'temperature', 'top_p', 'top_k']) expect(args).not.toHaveProperty(campo);
  });

  it('o esquema pedido tem as cinco listas e additionalProperties: false', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(resumoValido)));
    await criarResumidor(falso.cliente, prefixo).resumir(falas, []);
    const schema = falso.create.mock.calls[0][0].output_config.format.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['assuntos', 'decisoes', 'duvidasCliente', 'pendencias', 'proximosPassos'],
    );
  });

  it('a tarefa traz a transcrição completa e os conceitos', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(resumoValido)));
    await criarResumidor(falso.cliente, prefixo).resumir(falas, ['Rateio', 'Centro de custo']);
    const conteudo = falso.create.mock.calls[0][0].messages[0].content;
    const tarefa = typeof conteudo === 'string' ? conteudo : conteudo.at(-1).text;
    expect(tarefa).toContain('[Outros] Como funciona o rateio?\n[Você] Ele divide os custos entre centros.');
    expect(tarefa).toContain('Rateio; Centro de custo');
  });

  it('não envia documentos nem cache_control (pedido único, sem reaproveitar cache)', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(resumoValido)));
    await criarResumidor(falso.cliente, prefixo).resumir(falas, []);
    const args = falso.create.mock.calls[0][0];
    expect(JSON.stringify(args)).not.toContain('cache_control');
    expect(JSON.stringify(args)).not.toContain('"document"');
    expect(JSON.stringify(args)).not.toContain('O rateio divide custos');
    expect(args.system.map((b: { text: string }) => b.text).join('\n')).toContain('Consultora');
  });

  it('sem conceitos a tarefa diz "nenhum"', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(resumoValido)));
    await criarResumidor(falso.cliente, prefixo).resumir(falas, []);
    expect(falso.create.mock.calls[0][0].messages[0].content).toMatch(/Conceitos[^\n]*: nenhum/);
  });

  it('resposta fora do esquema é rejeitada', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ ...resumoValido, assuntos: 'texto' })));
    await expect(criarResumidor(falso.cliente, prefixo).resumir(falas, [])).rejects.toThrow();
  });

  it('recusa vira RecusaIa', async () => {
    falso.create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(criarResumidor(falso.cliente, prefixo).resumir(falas, [])).rejects.toBeInstanceOf(RecusaIa);
  });
});
