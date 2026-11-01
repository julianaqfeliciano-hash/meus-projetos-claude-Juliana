import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { RecusaIa } from './erros';
import { BETAS_OPUS, MODELO_PRINCIPAL } from './modelos';

/**
 * Pedido com saída estruturada: o JSON vem nos blocos `text` (os de pensamento ficam de fora) e é validado
 * com o próprio esquema. Os esquemas devem usar `z.strictObject`, que gera `additionalProperties: false`.
 */
export async function pedirEstruturado<T>(
  cliente: Anthropic,
  args: {
    modelo: string;
    esforco: 'low' | 'medium';
    system: Anthropic.Beta.Messages.BetaTextBlockParam[];
    mensagens: Anthropic.Beta.Messages.BetaMessageParam[];
    esquema: z.ZodType<T>;
    maxTokens: number;
  },
): Promise<T> {
  const schema: Record<string, unknown> = z.toJSONSchema(args.esquema);
  delete schema.$schema; // a API não precisa dele (o helper de zod do SDK também o descarta)

  const resposta = await cliente.beta.messages.create({
    model: args.modelo,
    max_tokens: args.maxTokens,
    system: args.system,
    messages: args.mensagens,
    output_config: { effort: args.esforco, format: { type: 'json_schema', schema } },
    ...(args.modelo === MODELO_PRINCIPAL ? ({ betas: BETAS_OPUS, fallbacks: 'default' } as const) : {}),
  });

  if (resposta.stop_reason === 'refusal') throw new RecusaIa();
  const texto = resposta.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return args.esquema.parse(JSON.parse(texto));
}
