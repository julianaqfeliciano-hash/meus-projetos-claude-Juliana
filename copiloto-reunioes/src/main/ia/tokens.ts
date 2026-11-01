import type Anthropic from '@anthropic-ai/sdk';
import type { DocumentoLido } from '../../shared/tipos';
import { MODELO_DETECTOR } from './modelos';
import { montarPrefixo } from './prefixo';

/** Quando a API de contagem falha, estima 1 token a cada 3 caracteres (folgado para português). */
const CARACTERES_POR_TOKEN = 3;

/**
 * Conta os tokens que os documentos ocupam num pedido. Usa a API de contagem, com os mesmos blocos que o
 * detector enviaria; se ela falhar por qualquer motivo, devolve uma estimativa e `estimado: true`.
 */
export async function contarTokensDocumentos(
  cliente: Anthropic,
  docs: DocumentoLido[],
): Promise<{ tokens: number; estimado: boolean }> {
  const { documentos } = montarPrefixo({ documentos: docs, contexto: '', sobreVoce: '', idioma: 'auto' }, 'detector');
  if (documentos.length === 0) return { tokens: 0, estimado: false };

  try {
    const contagem = await cliente.beta.messages.countTokens({
      model: MODELO_DETECTOR,
      messages: [{ role: 'user', content: [...documentos, { type: 'text', text: '.' }] }],
    });
    return { tokens: contagem.input_tokens, estimado: false };
  } catch {
    const totalCaracteres = docs
      .filter((d) => d.aviso === null)
      .reduce((soma, d) => soma + d.partes.reduce((s, p) => s + p.texto.length, 0), 0);
    return { tokens: Math.ceil(totalCaracteres / CARACTERES_POR_TOKEN), estimado: true };
  }
}
