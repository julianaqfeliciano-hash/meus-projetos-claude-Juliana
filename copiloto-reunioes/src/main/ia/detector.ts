import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Fala, ItemDetectado } from '../../shared/tipos';
import { formatarFalas } from '../transcricao/transcricao';
import { pedirEstruturado } from './estruturado';
import { MODELO_DETECTOR } from './modelos';
import { montarMensagens, type PrefixoPedido } from './prefixo';

export interface Detector {
  detectar(janela: Fala[], cobertos: string[]): Promise<ItemDetectado[]>;
}

const MAX_ITENS = 2;

const esquema = z.strictObject({
  itens: z.array(
    z.strictObject({
      tipo: z.enum(['pergunta', 'conceito']),
      texto: z.string(),
      idioma: z.enum(['pt', 'en']),
    }),
  ),
});

// Só o explicador é pré-aquecido: a API recusa max_tokens 0 com saída estruturada, e o 1º ciclo do detector grava o cache (barato no Haiku).
export function criarDetector(cliente: Anthropic, prefixo: PrefixoPedido): Detector {
  return {
    async detectar(janela, cobertos) {
      if (!janela.some((f) => f.quem === 'outros')) return [];
      const tarefa = `${formatarFalas(janela)}\n\nItens já cobertos: ${cobertos.length > 0 ? cobertos.join('; ') : 'nenhum'}`;
      const { itens } = await pedirEstruturado(cliente, {
        modelo: MODELO_DETECTOR,
        esforco: 'low',
        system: prefixo.system,
        mensagens: montarMensagens(prefixo, tarefa),
        esquema,
        maxTokens: 2000,
      });
      return itens.slice(0, MAX_ITENS);
    },
  };
}
