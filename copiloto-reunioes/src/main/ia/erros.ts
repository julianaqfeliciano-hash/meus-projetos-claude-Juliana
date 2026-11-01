import Anthropic from '@anthropic-ai/sdk';

export type ClasseErro = 'chave' | 'permissao' | 'limite' | 'rede' | 'recusa' | 'tempo' | 'outro';

/** O modelo recusou o pedido (`stop_reason: 'refusal'`). */
export class RecusaIa extends Error {
  constructor(mensagem = 'A IA recusou responder a este pedido.') {
    super(mensagem);
    this.name = 'RecusaIa';
  }
}

/** O pedido passou do tempo máximo e foi cancelado. */
export class TempoEsgotado extends Error {
  constructor(mensagem = 'A IA passou do tempo máximo para responder.') {
    super(mensagem);
    this.name = 'TempoEsgotado';
  }
}

/** Classifica pelo tipo do erro, nunca pela mensagem. `APIConnectionTimeoutError` herda de `APIConnectionError`. */
export function classificarErro(e: unknown): ClasseErro {
  if (e instanceof Anthropic.AuthenticationError) return 'chave';
  if (e instanceof Anthropic.PermissionDeniedError) return 'permissao';
  if (e instanceof Anthropic.RateLimitError) return 'limite';
  if (e instanceof Anthropic.APIConnectionError) return 'rede';
  if (e instanceof RecusaIa) return 'recusa';
  if (e instanceof TempoEsgotado) return 'tempo';
  return 'outro';
}
