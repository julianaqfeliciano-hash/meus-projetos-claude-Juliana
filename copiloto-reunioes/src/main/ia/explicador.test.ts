import { beforeEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import type { ConteudoCartao } from '../../shared/tipos';
import { RecusaIa, TempoEsgotado } from './erros';
import { criarExplicador, type PedidoCartao } from './explicador';
import { BETAS_OPUS, MODELO_PRINCIPAL } from './modelos';
import { criarClienteFalso, citacao, delta, fala, prefixoDe, streamFalso, streamTravado } from './apoio-testes';
import { montarMensagens } from './prefixo';

const prefixo = prefixoDe('explicador');
const falaOutros = fala('outros', 'Como funciona o rateio?');
const pedidoConceito: PedidoCartao = { tipo: 'conceito', alvo: 'rateio', janela: [falaOutros] };
const cardRateio = [delta('TÍTULO: Rateio\nEXPLICAÇÃO: Divide'), citacao(0, 1), delta(' custos.')];
const conteudoRateio: ConteudoCartao = {
  titulo: 'Rateio',
  campos: { explicacao: 'Divide custos.' },
  fontes: [{ arquivo: 'Manual.pdf', local: 'p. 2' }],
};

const erroDeRede = () => Object.create(Anthropic.APIConnectionError.prototype) as Error;
const erroDeChave = () => Object.create(Anthropic.AuthenticationError.prototype) as Error;
const erroDePermissao = () => Object.create(Anthropic.PermissionDeniedError.prototype) as Error;

let falso: ReturnType<typeof criarClienteFalso>;
beforeEach(() => {
  falso = criarClienteFalso();
});

/** Texto da tarefa (último bloco da mensagem do usuário) da chamada `n` do stream. */
const tarefaDa = (n = 0): string => {
  const conteudo = falso.stream.mock.calls[n][0].messages[0].content;
  return conteudo.at(-1).text;
};

async function tarefaPara(pedido: PedidoCartao): Promise<string> {
  falso.stream.mockReturnValue(streamFalso([delta('TÍTULO: x')]));
  await criarExplicador(falso.cliente, prefixo).explicar(pedido, () => undefined);
  return tarefaDa();
}

describe('explicar', () => {
  it('Opus com fallback e streaming com citações', async () => {
    falso.stream.mockReturnValue(streamFalso(cardRateio));
    const atualizacoes: ConteudoCartao[] = [];
    const final = await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, (c) => atualizacoes.push(c));
    expect(final).toEqual(conteudoRateio);
    expect(atualizacoes.length).toBeGreaterThan(1);
    expect(atualizacoes.at(-1)).toEqual(conteudoRateio);
    const args = falso.stream.mock.calls[0][0];
    expect(args).toMatchObject({
      model: MODELO_PRINCIPAL,
      max_tokens: 4000,
      betas: BETAS_OPUS,
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: prefixo.system,
    });
    expect(args.model).toBe('claude-opus-5-5');
    expect(args.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(args.messages).toEqual(montarMensagens(prefixo, tarefaDa()));
    for (const campo of ['thinking', 'temperature', 'top_p', 'top_k']) expect(args).not.toHaveProperty(campo);
  });

  it('chama aoAtualizar depois de cada delta de texto e de citação, com o cartão parcial', async () => {
    falso.stream.mockReturnValue(streamFalso(cardRateio));
    const atualizacoes: ConteudoCartao[] = [];
    await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, (c) => atualizacoes.push(c));
    expect(atualizacoes).toEqual([
      { titulo: 'Rateio', campos: { explicacao: 'Divide' }, fontes: [] },
      { titulo: 'Rateio', campos: { explicacao: 'Divide' }, fontes: [{ arquivo: 'Manual.pdf', local: 'p. 2' }] },
      conteudoRateio,
    ]);
  });

  it('ignora eventos que não são texto nem citação (pensamento, fallback, início/fim de bloco)', async () => {
    falso.stream.mockReturnValue(
      streamFalso([
        { type: 'message_start', message: {} },
        { type: 'content_block_start', index: 0, content_block: { type: 'fallback' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'x' } },
        delta('TÍTULO: Rateio'),
        { type: 'content_block_stop', index: 0 },
      ]),
    );
    const aoAtualizar = vi.fn();
    const final = await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, aoAtualizar);
    expect(final).toEqual({ titulo: 'Rateio', campos: {}, fontes: [] });
    expect(aoAtualizar).toHaveBeenCalledTimes(1);
  });

  it('passa um AbortSignal nas opções da requisição', async () => {
    falso.stream.mockReturnValue(streamFalso(cardRateio));
    await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined);
    const opcoes = falso.stream.mock.calls[0][1];
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
    expect(opcoes.signal.aborted).toBe(false);
  });

  it('tenta de novo uma vez após erro, recomeçando texto e citações do zero', async () => {
    falso.stream
      .mockReturnValueOnce(streamFalso([delta('TÍTULO: Velho\nEXPLICAÇÃO: lixo'), citacao(0, 0)], 'end_turn', erroDeRede()))
      .mockReturnValueOnce(streamFalso(cardRateio));
    const atualizacoes: ConteudoCartao[] = [];
    const final = await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, (c) => atualizacoes.push(c));
    expect(falso.stream).toHaveBeenCalledTimes(2);
    expect(final).toEqual(conteudoRateio);
    expect(JSON.stringify(final)).not.toContain('lixo');
    expect(atualizacoes.at(-1)).toEqual(conteudoRateio);
  });

  it('só tenta duas vezes: o segundo erro é o que sobe', async () => {
    const segundo = erroDeRede();
    falso.stream
      .mockReturnValueOnce(streamFalso([], 'end_turn', erroDeRede()))
      .mockReturnValueOnce(streamFalso([], 'end_turn', segundo));
    await expect(criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined)).rejects.toBe(segundo);
    expect(falso.stream).toHaveBeenCalledTimes(2);
  });

  it('erro ao abrir o stream (stream() lança) também tenta de novo', async () => {
    falso.stream
      .mockImplementationOnce(() => {
        throw erroDeRede();
      })
      .mockReturnValueOnce(streamFalso(cardRateio));
    expect(await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined)).toEqual(conteudoRateio);
    expect(falso.stream).toHaveBeenCalledTimes(2);
  });

  it('não tenta de novo com chave inválida', async () => {
    const erro = erroDeChave();
    falso.stream.mockReturnValue(streamFalso([], 'end_turn', erro));
    await expect(criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined)).rejects.toBe(erro);
    expect(falso.stream).toHaveBeenCalledTimes(1);
  });

  it('não tenta de novo sem permissão', async () => {
    const erro = erroDePermissao();
    falso.stream.mockReturnValue(streamFalso([], 'end_turn', erro));
    await expect(criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined)).rejects.toBe(erro);
    expect(falso.stream).toHaveBeenCalledTimes(1);
  });

  it('estoura o tempo: aborta o pedido e rejeita com TempoEsgotado após 2 tentativas', async () => {
    const sinais: AbortSignal[] = [];
    falso.stream.mockImplementation((_params, opcoes: { signal: AbortSignal }) => {
      sinais.push(opcoes.signal);
      return streamTravado();
    });
    const explicador = criarExplicador(falso.cliente, prefixo, { tempoMaxMs: 50 });
    const inicio = Date.now();
    await expect(explicador.explicar(pedidoConceito, () => undefined)).rejects.toBeInstanceOf(TempoEsgotado);
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect(falso.stream).toHaveBeenCalledTimes(2);
    expect(sinais.map((s) => s.aborted)).toEqual([true, true]);
  });

  it('se o stream falha por causa do aborto, o erro continua sendo TempoEsgotado', async () => {
    falso.stream.mockImplementation((_params, opcoes: { signal: AbortSignal }) => streamTravado(opcoes.signal));
    const explicador = criarExplicador(falso.cliente, prefixo, { tempoMaxMs: 30 });
    await expect(explicador.explicar(pedidoConceito, () => undefined)).rejects.toBeInstanceOf(TempoEsgotado);
    expect(falso.stream).toHaveBeenCalledTimes(2);
  });

  it('uma tentativa abortada não atualiza mais o cartão se o stream ainda soltar eventos', async () => {
    const liberar: Array<() => void> = [];
    falso.stream.mockImplementation(() => ({
      async *[Symbol.asyncIterator]() {
        yield delta('TÍTULO: A');
        await new Promise<void>((resolver) => liberar.push(resolver));
        yield delta(' atrasado');
      },
      finalMessage: () => new Promise<never>(() => undefined),
    }));
    const aoAtualizar = vi.fn();
    const explicador = criarExplicador(falso.cliente, prefixo, { tempoMaxMs: 30 });
    await expect(explicador.explicar(pedidoConceito, aoAtualizar)).rejects.toBeInstanceOf(TempoEsgotado);
    expect(aoAtualizar).toHaveBeenCalledTimes(2);
    liberar.forEach((f) => f());
    await new Promise((resolver) => setTimeout(resolver, 20));
    expect(aoAtualizar).toHaveBeenCalledTimes(2);
  });

  it('o tempo recomeça a cada tentativa: um timeout seguido de sucesso resolve', async () => {
    falso.stream.mockReturnValueOnce(streamTravado()).mockReturnValueOnce(streamFalso(cardRateio));
    const explicador = criarExplicador(falso.cliente, prefixo, { tempoMaxMs: 50 });
    expect(await explicador.explicar(pedidoConceito, () => undefined)).toEqual(conteudoRateio);
    expect(falso.stream).toHaveBeenCalledTimes(2);
  });

  it('o tempo padrão é 20 s', async () => {
    vi.useFakeTimers();
    try {
      falso.stream.mockImplementation(() => streamTravado());
      const explicador = criarExplicador(falso.cliente, prefixo);
      const resultado = explicador.explicar(pedidoConceito, () => undefined);
      const assertiva = expect(resultado).rejects.toBeInstanceOf(TempoEsgotado);
      await vi.advanceTimersByTimeAsync(19_999);
      expect(falso.stream).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(falso.stream).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(20_000);
      await assertiva;
    } finally {
      vi.useRealTimers();
    }
  });

  it('recusa vira RecusaIa (nas duas tentativas)', async () => {
    falso.stream.mockImplementation(() => streamFalso(cardRateio, 'refusal'));
    await expect(criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined)).rejects.toBeInstanceOf(
      RecusaIa,
    );
    expect(falso.stream).toHaveBeenCalledTimes(2);
  });

  it('se a segunda tentativa não for recusada, devolve o cartão dela', async () => {
    falso.stream.mockReturnValueOnce(streamFalso([delta('TÍTULO: Parcial')], 'refusal')).mockReturnValueOnce(streamFalso(cardRateio));
    expect(await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined)).toEqual(conteudoRateio);
  });
});

describe('texto da tarefa', () => {
  it('diga-isso com alvo: responde a pergunta dada', async () => {
    const tarefa = await tarefaPara({ tipo: 'diga-isso', alvo: 'Qual o prazo de entrega?', janela: [falaOutros] });
    expect(tarefa).toContain('diga-isso');
    expect(tarefa).toContain('Qual o prazo de entrega?');
    expect(tarefa).toContain('[Outros] Como funciona o rateio?');
  });

  it('diga-isso sem alvo (atalho): pergunta mais recente dos [Outros] ou sugestão', async () => {
    const tarefa = await tarefaPara({ tipo: 'diga-isso', janela: [falaOutros] });
    expect(tarefa).toContain('diga-isso');
    expect(tarefa).toContain('pergunta mais recente');
    expect(tarefa).toContain('[Outros]');
    expect(tarefa).toMatch(/Se não houver uma pergunta clara, sugira o que a usuária poderia dizer agora/);
    expect(tarefa).toContain('[Outros] Como funciona o rateio?');
  });

  it('conceito com alvo: explica o termo dado', async () => {
    const tarefa = await tarefaPara(pedidoConceito);
    expect(tarefa).toContain('conceito');
    expect(tarefa).toContain('rateio');
  });

  it('conceito sem alvo: explica o termo técnico mais recente', async () => {
    const tarefa = await tarefaPara({ tipo: 'conceito', janela: [falaOutros] });
    expect(tarefa).toContain('conceito');
    expect(tarefa).toContain('termo técnico mais recente');
  });

  it('resposta: responde direto a pergunta digitada, com a conversa como contexto', async () => {
    const tarefa = await tarefaPara({ tipo: 'resposta', alvo: 'O que é CNAB?', janela: [falaOutros] });
    expect(tarefa).toContain('resposta');
    expect(tarefa).toContain('O que é CNAB?');
    expect(tarefa).toContain('contexto');
    expect(tarefa).toContain('[Outros] Como funciona o rateio?');
  });

  it('janela vazia vira "(sem falas)"', async () => {
    expect(await tarefaPara({ tipo: 'resposta', alvo: 'O que é CNAB?', janela: [] })).toContain('(sem falas)');
    expect(await tarefaPara({ tipo: 'diga-isso', janela: [] })).toContain('(sem falas)');
  });

  it('a tarefa vai depois dos documentos do prefixo', async () => {
    falso.stream.mockReturnValue(streamFalso([delta('TÍTULO: x')]));
    await criarExplicador(falso.cliente, prefixo).explicar(pedidoConceito, () => undefined);
    const conteudo = falso.stream.mock.calls[0][0].messages[0].content;
    expect(conteudo[0]).toMatchObject({ type: 'document', citations: { enabled: true } });
    expect(conteudo.at(-1).type).toBe('text');
  });
});

describe('preaquecer', () => {
  it('usa max_tokens 0, o mesmo prefixo e os mesmos parâmetros, sem stream', async () => {
    falso.create.mockResolvedValue({});
    await expect(criarExplicador(falso.cliente, prefixo).preaquecer()).resolves.toBeUndefined();
    expect(falso.stream).not.toHaveBeenCalled();
    const args = falso.create.mock.calls[0][0];
    expect(args).toMatchObject({
      model: MODELO_PRINCIPAL,
      max_tokens: 0,
      betas: BETAS_OPUS,
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: prefixo.system,
    });
    expect(args.messages).toEqual(montarMensagens(prefixo, '.'));
    expect(args.stream).toBeUndefined();
  });

  it('engole qualquer erro (só registra no console)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    falso.create.mockRejectedValue(new Error('400'));
    await expect(criarExplicador(falso.cliente, prefixo).preaquecer()).resolves.toBeUndefined();
    expect(falso.create.mock.calls[0][0].max_tokens).toBe(0);
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });
});
