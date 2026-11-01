import type Anthropic from '@anthropic-ai/sdk';
import type { ContextoReuniao } from '../../shared/tipos';
import { instrucoes } from './instrucoes';

// `Anthropic.Beta.Messages` é uma classe, não um namespace de tipos: os tipos se acessam pelo caminho completo.
type BetaTextBlockParam = Anthropic.Beta.Messages.BetaTextBlockParam;
type BetaRequestDocumentBlock = Anthropic.Beta.Messages.BetaRequestDocumentBlock;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaCacheControlEphemeral = Anthropic.Beta.Messages.BetaCacheControlEphemeral;

export type Papel = 'detector' | 'explicador' | 'resumo';

export interface PrefixoPedido {
  system: BetaTextBlockParam[];
  documentos: BetaRequestDocumentBlock[];
  /** Alinhado com `documentos`: o índice de uma citação aponta para o mesmo item daqui. */
  mapaFontes: { arquivo: string; rotulos: string[] }[];
}

/** O detector é chamado sem parar durante a fala (cache de 5 min); os outros papéis ficam espaçados (1 h). */
function novoCache(papel: Papel): BetaCacheControlEphemeral {
  return papel === 'detector' ? { type: 'ephemeral' } : { type: 'ephemeral', ttl: '1h' };
}

/**
 * Monta a parte fixa de um pedido: instruções, "Sobre a usuária", contexto e documentos. Tem de sair idêntica,
 * byte a byte, a cada chamada (é o que faz o cache funcionar), então não entra data, hora nem id. Não altera
 * `ctx` e devolve objetos novos, que o chamador pode mexer à vontade.
 */
export function montarPrefixo(ctx: ContextoReuniao, papel: Papel): PrefixoPedido {
  const system: BetaTextBlockParam[] = [{ type: 'text', text: instrucoes(papel, ctx.idioma) }];
  const sobreVoce = ctx.sobreVoce.trim();
  if (sobreVoce) system.push({ type: 'text', text: `Sobre a usuária: ${sobreVoce}` });
  const contexto = ctx.contexto.trim();
  if (contexto) system.push({ type: 'text', text: `Contexto da reunião: ${contexto}` });

  // Um documento sem partes (arquivo vazio) renderizaria uma fonte sem conteúdo, que a API recusa.
  const lidos = ctx.documentos.filter((d) => d.aviso === null && d.partes.length > 0);
  const documentos: BetaRequestDocumentBlock[] = lidos.map((d) => ({
    type: 'document',
    title: d.nome,
    source: { type: 'content', content: d.partes.map((p) => ({ type: 'text', text: `[${p.rotulo}]\n${p.texto}` })) },
    citations: { enabled: papel === 'explicador' },
  }));
  const mapaFontes = lidos.map((d) => ({ arquivo: d.nome, rotulos: d.partes.map((p) => p.rotulo) }));

  // Um único ponto de cache cobre tudo que vem antes dele: o último documento ou, sem documentos, o system.
  const ultimo = documentos.at(-1) ?? system[system.length - 1];
  ultimo.cache_control = novoCache(papel);

  return { system, documentos, mapaFontes };
}

/** Mensagem do usuário: os documentos do prefixo e, depois do ponto de cache, a tarefa variável. */
export function montarMensagens(p: PrefixoPedido, tarefa: string): BetaMessageParam[] {
  return [{ role: 'user', content: [...p.documentos, { type: 'text', text: tarefa }] }];
}
