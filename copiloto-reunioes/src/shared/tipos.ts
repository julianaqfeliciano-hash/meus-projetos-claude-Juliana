export type Quem = 'voce' | 'outros';
export type Idioma = 'pt' | 'en';
export type IdiomaSugestao = 'auto' | Idioma;
export interface Fala { quem: Quem; texto: string; idioma: Idioma; em: number }
export interface ParteDoc { rotulo: string; texto: string }
export type AvisoDoc = 'digitalizado' | 'formato-antigo' | 'nao-suportado' | 'erro-leitura';
export interface DocumentoLido {
  caminho: string; nome: string; tipo: 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'texto' | 'outro';
  partes: ParteDoc[]; aviso: AvisoDoc | null;
}
export interface ContextoReuniao {
  documentos: DocumentoLido[]; contexto: string; sobreVoce: string; idioma: IdiomaSugestao;
}
export type TipoCartao = 'diga-isso' | 'conceito' | 'resposta';
export type OrigemCartao = 'automatico' | 'atalho' | 'digitado';
export interface Fonte { arquivo: string; local: string }
export interface CamposCartao { digaIsso?: string; explicacao?: string; comoExplicar?: string; resposta?: string }
export interface ConteudoCartao { titulo?: string; campos: CamposCartao; fontes: Fonte[] }
export interface Cartao extends ConteudoCartao {
  id: string; tipo: TipoCartao; titulo: string; origem: OrigemCartao;
  estado: 'escrevendo' | 'pronto' | 'erro'; criadoEm: number; erro?: string;
}
export interface ItemDetectado { tipo: 'pergunta' | 'conceito'; texto: string; idioma: Idioma }
export type EstadoReuniao = 'preparando' | 'ouvindo' | 'pausado' | 'encerrando' | 'concluida';
export type StatusConexao = 'ok' | 'reconectando' | 'erro';
export type TipoAviso = 'sem-som-outros' | 'pausa-automatica' | 'chave' | 'cota'
  | 'windows-antigo' | 'resumo-falhou' | 'erro-ia' | 'atalho-recusado';
export interface Aviso { id: string; tipo: TipoAviso; texto: string }
export interface InstantaneoReuniao {
  estado: EstadoReuniao; modo: 'audio' | 'ensaio'; conexao: Record<Quem, StatusConexao>;
  cartoes: Cartao[]; indiceAtual: number; avisos: Aviso[];
  parciais: Record<Quem, string>; transcricao: Fala[];
}
export interface ResumoReuniao {
  assuntos: string[]; duvidasCliente: string[]; decisoes: string[]; pendencias: string[]; proximosPassos: string[];
}
export interface ConceitoSalvo { termo: string; explicacao: string; fontes: Fonte[] }
export interface ItemHistoricoReuniao {
  id: string; tipo: 'reuniao'; data: string; duracaoMin: number; contexto: string;
  documentos: string[]; resumo: ResumoReuniao | null; conceitos: ConceitoSalvo[];
}
export interface ConfigTreino {
  vaga: string; curriculo: string; idioma: Idioma; tipo: 'comportamental' | 'tecnica' | 'mista'; quantidade: 5 | 8 | 10;
}
export interface PerguntaTreino { id: string; texto: string }
export interface AvaliacaoResposta { foiBem: string[]; faltou: string[]; respostaMelhorada: string; dicasIngles: string[] }
export interface RelatorioTreino { pontosFortes: string[]; aTreinar: string[]; perguntasMaisFracas: string[] }
export interface ItemHistoricoTreino {
  id: string; tipo: 'treino'; data: string; idioma: Idioma; tipoEntrevista: ConfigTreino['tipo'];
  vagaResumo: string; perguntas: string[]; relatorio: RelatorioTreino;
}
export type ItemHistorico = ItemHistoricoReuniao | ItemHistoricoTreino;
export interface ResumoItemHistorico { id: string; tipo: ItemHistorico['tipo']; data: string; titulo: string }
export type AcaoAtalho = 'ajudarResponder' | 'explicar' | 'digitar' | 'ocultar' | 'pausar' | 'anterior' | 'proximo';
export interface Preferencias {
  sobreVoce: string; microfoneId: string | null; atalhos: Record<AcaoAtalho, string>;
  tamanhoLetra: 'normal' | 'grande'; opacidadePainel: number; invisivelNoCompartilhamento: boolean;
  painel: { x: number; y: number; largura: number; altura: number } | null; ultimosArquivos: string[];
}
export type ResultadoChave = 'ok' | 'invalida' | 'erro-rede';
export const LIMITE_TOKENS_DOCUMENTOS = 80_000;
