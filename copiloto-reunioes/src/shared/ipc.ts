import type * as T from './tipos';
export interface DocumentosLidos { docs: T.DocumentoLido[]; tokens: number; estimado: boolean }
export interface CopilotoApi {
  config: {
    obter(): Promise<{
      preferencias: T.Preferencias; temChaves: { anthropic: boolean; soniox: boolean };
      statusChaves: { anthropic: T.ResultadoChave | null; soniox: T.ResultadoChave | null }; // null = sem chave ou ainda verificando
    }>;
    salvar(p: T.Preferencias): Promise<Record<T.AcaoAtalho, string | null>>; // erros de validação/registro por ação
    salvarChaves(c: { anthropic?: string; soniox?: string }): Promise<{ anthropic?: T.ResultadoChave; soniox?: T.ResultadoChave }>;
  };
  documentos: { escolher(): Promise<string[]>; ler(caminhos: string[]): Promise<DocumentosLidos> };
  reuniao: {
    iniciar(o: { caminhos: string[]; contexto: string; idioma: T.IdiomaSugestao; modo: 'audio' | 'ensaio' }): Promise<void>;
    falaEnsaio(quem: T.Quem, texto: string): void;
    alternarPausa(): void; perguntar(texto: string): void; navegar(delta: 1 | -1): void;
    encerrar(): Promise<T.ItemHistoricoReuniao | null>;
    aoInstantaneo(cb: (i: T.InstantaneoReuniao) => void): () => void;
  };
  audio: { enviar(quem: T.Quem, pcm: ArrayBuffer): void; nivel(quem: T.Quem, nivel: number): void; aoNivel(cb: (quem: T.Quem, nivel: number) => void): () => void };
  painel: { aoDigitar(cb: () => void): () => void; terminarDigitacao(): void; aoPreferencias(cb: (p: T.Preferencias) => void): () => void };
  historico: { listar(): Promise<T.ResumoItemHistorico[]>; obter(id: string): Promise<T.ItemHistorico | null>; apagar(id: string): Promise<void> };
  treino: {
    lerArquivo(): Promise<string | null>; // escolhe 1 arquivo e devolve o texto de todas as partes
    perguntas(cfg: T.ConfigTreino): Promise<T.PerguntaTreino[]>;
    avaliar(cfg: T.ConfigTreino, pergunta: string, resposta: string): Promise<T.AvaliacaoResposta>;
    finalizar(cfg: T.ConfigTreino, respostas: { pergunta: string; resposta: string; avaliacao: T.AvaliacaoResposta }[]): Promise<T.ItemHistoricoTreino>;
    ditadoIniciar(): Promise<void>; ditadoParar(): Promise<string>; aoDitado(cb: (texto: string) => void): () => void;
  };
  aoComandoCaptura(cb: (c: { acao: 'iniciar'; quem: T.Quem[] } | { acao: 'parar' }) => void): () => void;
}
declare global { interface Window { copiloto: CopilotoApi } }

/** Comando que o processo principal manda à janela principal para ligar ou desligar a captura de áudio. */
export type ComandoCaptura = Parameters<Parameters<CopilotoApi['aoComandoCaptura']>[0]>[0];

/** Nomes dos canais IPC, usados pelo preload e pelo processo principal. */
export const CANAIS = {
  configObter: 'config:obter',
  configSalvar: 'config:salvar',
  configSalvarChaves: 'config:salvarChaves',
  documentosEscolher: 'documentos:escolher',
  documentosLer: 'documentos:ler',
  reuniaoIniciar: 'reuniao:iniciar',
  reuniaoFalaEnsaio: 'reuniao:falaEnsaio',
  reuniaoAlternarPausa: 'reuniao:alternarPausa',
  reuniaoPerguntar: 'reuniao:perguntar',
  reuniaoNavegar: 'reuniao:navegar',
  reuniaoEncerrar: 'reuniao:encerrar',
  reuniaoInstantaneo: 'reuniao:instantaneo',
  audioEnviar: 'audio:enviar',
  audioNivel: 'audio:nivel',
  painelDigitar: 'painel:digitar',
  painelTerminarDigitacao: 'painel:terminarDigitacao',
  painelPreferencias: 'painel:preferencias',
  historicoListar: 'historico:listar',
  historicoObter: 'historico:obter',
  historicoApagar: 'historico:apagar',
  treinoLerArquivo: 'treino:lerArquivo',
  treinoPerguntas: 'treino:perguntas',
  treinoAvaliar: 'treino:avaliar',
  treinoFinalizar: 'treino:finalizar',
  treinoDitadoIniciar: 'treino:ditadoIniciar',
  treinoDitadoParar: 'treino:ditadoParar',
  treinoDitado: 'treino:ditado',
  comandoCaptura: 'captura:comando',
} as const;
