/**
 * A ponte com o processo principal: `window.copiloto`, criada pelo preload. Os `invoke` rejeitam com uma
 * mensagem em português pronta para mostrar na tela.
 */
export const copiloto = window.copiloto;

const ERRO_DESCONHECIDO = 'Algo deu errado. Tente de novo.';

/** O texto de um erro para mostrar à usuária: a mensagem, nunca a pilha. */
export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error && erro.message.trim() !== '' ? erro.message : ERRO_DESCONHECIDO;
}
