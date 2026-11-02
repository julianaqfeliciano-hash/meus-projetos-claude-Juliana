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

const MENSAGEM_ERRO_CHAVE = 'Chave da Anthropic inválida ou sem permissão — confira nas Configurações.';

const MENSAGEM_ERRO: Record<ClasseErro, string> = {
  chave: MENSAGEM_ERRO_CHAVE,
  permissao: MENSAGEM_ERRO_CHAVE,
  limite: 'Limite de uso da IA atingido — aguarde um pouco e tente de novo.',
  rede: 'Sem conexão com a IA — confira a internet.',
  tempo: 'A IA demorou demais — tente de novo.',
  recusa: 'A IA não conseguiu responder a este pedido.',
  outro: 'Algo deu errado — tente de novo.',
};

/** A mensagem que a tela mostra para um erro da IA. Nunca repassa o texto do erro original (inglês ou JSON). */
export function mensagemErroIa(e: unknown): string {
  return MENSAGEM_ERRO[classificarErro(e)];
}
