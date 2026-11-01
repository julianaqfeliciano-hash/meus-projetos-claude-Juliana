import type Anthropic from '@anthropic-ai/sdk';
import type { ConteudoCartao, Fala, TipoCartao } from '../../shared/tipos';
import { formatarFalas } from '../transcricao/transcricao';
import { classificarErro, RecusaIa, TempoEsgotado } from './erros';
import { fontesDeCitacoes } from './fontes';
import { interpretarCartao } from './interpretar-cartao';
import { BETAS_OPUS, MODELO_PRINCIPAL } from './modelos';
import { montarMensagens, type PrefixoPedido } from './prefixo';

export interface PedidoCartao {
  tipo: TipoCartao;
  alvo?: string;
  janela: Fala[];
}

export interface Explicador {
  preaquecer(): Promise<void>;
  explicar(pedido: PedidoCartao, aoAtualizar: (c: ConteudoCartao) => void): Promise<ConteudoCartao>;
}

const TEMPO_MAX_PADRAO_MS = 20_000;

function textoDaTarefa(pedido: PedidoCartao): string {
  const alvo = pedido.alvo?.trim();
  const falas = formatarFalas(pedido.janela) || '(sem falas)';
  let instrucao: string;
  switch (pedido.tipo) {
    case 'diga-isso':
      instrucao = alvo
        ? `Responda a esta pergunta, feita à usuária: ${alvo}`
        : 'Identifique a pergunta mais recente que os [Outros] fizeram à usuária no trecho abaixo e responda a ela. ' +
          'Se não houver uma pergunta clara, sugira o que a usuária poderia dizer agora, com base na conversa.';
      break;
    case 'conceito':
      instrucao = alvo
        ? `Explique este termo: ${alvo}`
        : 'Identifique o termo técnico mais recente no trecho abaixo e explique-o.';
      break;
    case 'resposta':
      instrucao = alvo
        ? `Responda diretamente a esta pergunta digitada pela usuária, usando o trecho abaixo como contexto: ${alvo}`
        : 'Identifique a pergunta mais recente no trecho abaixo e responda a ela diretamente.';
      break;
  }
  return `Tipo do cartão: ${pedido.tipo}\n${instrucao}\n\nTrecho recente da conversa:\n${falas}`;
}

export function criarExplicador(
  cliente: Anthropic,
  prefixo: PrefixoPedido,
  opcoes: { tempoMaxMs?: number } = {},
): Explicador {
  const tempoMaxMs = opcoes.tempoMaxMs ?? TEMPO_MAX_PADRAO_MS;
  const fixos = {
    model: MODELO_PRINCIPAL,
    output_config: { effort: 'low' },
    betas: BETAS_OPUS,
    fallbacks: 'default',
    system: prefixo.system,
  } as const;

  /** Uma tentativa completa: abre o stream, acumula texto e citações do zero e confere a recusa no fim. */
  async function tentar(pedido: PedidoCartao, aoAtualizar: (c: ConteudoCartao) => void): Promise<ConteudoCartao> {
    const controle = new AbortController();
    let estourou = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_, rejeitar) => {
      temporizador = setTimeout(() => {
        estourou = true;
        controle.abort();
        rejeitar(new TempoEsgotado());
      }, tempoMaxMs);
    });

    const ler = async (): Promise<ConteudoCartao> => {
      const stream = cliente.beta.messages.stream(
        { ...fixos, max_tokens: 4000, messages: montarMensagens(prefixo, textoDaTarefa(pedido)) },
        { signal: controle.signal },
      );
      let texto = '';
      const citacoes: unknown[] = [];
      const conteudo = (): ConteudoCartao => ({
        ...interpretarCartao(pedido.tipo, texto),
        fontes: fontesDeCitacoes(citacoes, prefixo.mapaFontes),
      });
      for await (const ev of stream) {
        if (ev.type !== 'content_block_delta') continue;
        if (ev.delta.type === 'text_delta') texto += ev.delta.text;
        else if (ev.delta.type === 'citations_delta') citacoes.push(ev.delta.citation);
        else continue;
        // Depois de abortada, esta tentativa não fala mais com quem chamou (a seguinte pode já ter começado).
        if (!controle.signal.aborted) aoAtualizar(conteudo());
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') throw new RecusaIa();
      return conteudo();
    };

    const leitura = ler();
    leitura.catch(() => undefined); // se o tempo vencer a corrida, o erro tardio da leitura não pode ficar sem tratamento
    try {
      return await Promise.race([leitura, limite]);
    } catch (e) {
      controle.abort();
      throw estourou ? new TempoEsgotado() : e;
    } finally {
      clearTimeout(temporizador);
    }
  }

  return {
    async preaquecer() {
      try {
        await cliente.beta.messages.create({
          ...fixos,
          max_tokens: 0,
          messages: montarMensagens(prefixo, '.'),
        });
      } catch (e) {
        console.warn('Não foi possível pré-aquecer o cache do explicador:', e);
      }
    },

    async explicar(pedido, aoAtualizar) {
      let ultimoErro: unknown;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          return await tentar(pedido, aoAtualizar);
        } catch (e) {
          const classe = classificarErro(e);
          if (classe === 'chave' || classe === 'permissao') throw e;
          ultimoErro = e;
        }
      }
      throw ultimoErro;
    },
  };
}
