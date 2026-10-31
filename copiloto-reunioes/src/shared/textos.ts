import type { AvisoDoc, TipoAviso } from './tipos';

const MENSAGEM_AVISO_DOC: Record<AvisoDoc, string> = {
  digitalizado: 'Não foi possível ler o texto (PDF digitalizado?)',
  'formato-antigo': 'Salve como .docx, .xlsx ou .pptx',
  'nao-suportado': 'Formato não suportado',
  'erro-leitura': 'Não foi possível abrir o arquivo',
};

export function mensagemAviso(aviso: AvisoDoc): string {
  return MENSAGEM_AVISO_DOC[aviso];
}

export const TEXTO_AVISO: Record<TipoAviso, string> = {
  'sem-som-outros': 'Não estou ouvindo os outros participantes — confira a saída de som do Teams.',
  'pausa-automatica': 'Escuta pausada após 15 minutos de silêncio.',
  'windows-antigo': 'Neste Windows o painel aparece como um retângulo preto no compartilhamento de tela.',
  'resumo-falhou': 'Não consegui gerar o resumo; os conceitos foram salvos.',
  chave: 'Chave inválida ou sem permissão — confira nas Configurações.',
  cota: 'Limite ou crédito esgotado no provedor.',
  'erro-ia': 'A IA não respondeu agora.',
  'atalho-recusado': 'Um atalho já é usado por outro programa — escolha outro nas Configurações.',
};
