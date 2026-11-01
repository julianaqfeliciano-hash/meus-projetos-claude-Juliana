import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DocumentoLido, ParteDoc } from '../../shared/tipos';
import { lerDocx } from './docx';
import { lerPdf } from './pdf';
import { lerPptx } from './pptx';
import { lerTexto } from './texto';
import { lerXlsx } from './xlsx';

const TIPOS: Record<string, DocumentoLido['tipo']> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.xlsx': 'xlsx',
  '.txt': 'texto',
  '.md': 'texto',
};
const FORMATOS_ANTIGOS = new Set(['.doc', '.xls', '.ppt']);

async function lerPartes(caminho: string, tipo: DocumentoLido['tipo']): Promise<ParteDoc[]> {
  switch (tipo) {
    case 'pdf':
      return lerPdf(await fs.readFile(caminho));
    case 'docx':
      return lerDocx(caminho);
    case 'pptx':
      return lerPptx(await fs.readFile(caminho));
    case 'xlsx':
      return lerXlsx(await fs.readFile(caminho));
    case 'texto':
      return lerTexto(caminho);
    case 'outro':
      return [];
  }
}

/**
 * Lê o documento e devolve suas partes rotuladas (página, slide, aba, seção). Nunca lança: arquivo ausente,
 * corrompido ou protegido por senha vira `aviso: 'erro-leitura'`, e o `tipo` vem sempre da extensão.
 */
export async function lerDocumento(caminho: string): Promise<DocumentoLido> {
  const extensao = path.extname(caminho).toLowerCase();
  const tipo = TIPOS[extensao] ?? 'outro';
  const base = { caminho, nome: path.basename(caminho), tipo };

  if (FORMATOS_ANTIGOS.has(extensao)) return { ...base, partes: [], aviso: 'formato-antigo' };
  if (tipo === 'outro') return { ...base, partes: [], aviso: 'nao-suportado' };

  try {
    const partes = await lerPartes(caminho, tipo);
    // Um PDF sem partes é um PDF só de imagens (o leitor já descartou o que tinha pouco texto).
    return { ...base, partes, aviso: tipo === 'pdf' && partes.length === 0 ? 'digitalizado' : null };
  } catch {
    // O contrato é nunca lançar; o aviso é como o chamador fica sabendo da falha.
    return { ...base, partes: [], aviso: 'erro-leitura' };
  }
}
