import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Fala, ResumoReuniao } from '../../shared/tipos';
import { formatarFalas } from '../transcricao/transcricao';
import { pedirEstruturado } from './estruturado';
import { MODELO_PRINCIPAL } from './modelos';
import { montarMensagens, type PrefixoPedido } from './prefixo';

export interface Resumidor {
  resumir(transcricao: Fala[], conceitos: string[]): Promise<ResumoReuniao>;
}

const esquema: z.ZodType<ResumoReuniao> = z.strictObject({
  assuntos: z.array(z.string()),
  duvidasCliente: z.array(z.string()),
  decisoes: z.array(z.string()),
  pendencias: z.array(z.string()),
  proximosPassos: z.array(z.string()),
});

export function criarResumidor(cliente: Anthropic, prefixo: PrefixoPedido): Resumidor {
  return {
    resumir(transcricao, conceitos) {
      const tarefa =
        `Transcrição completa da reunião:\n${formatarFalas(transcricao)}\n\n` +
        `Conceitos explicados durante a reunião: ${conceitos.length > 0 ? conceitos.join('; ') : 'nenhum'}`;
      return pedirEstruturado(cliente, {
        modelo: MODELO_PRINCIPAL,
        esforco: 'medium',
        system: prefixo.system,
        mensagens: montarMensagens(prefixo, tarefa),
        esquema,
        maxTokens: 8000,
      });
    },
  };
}
