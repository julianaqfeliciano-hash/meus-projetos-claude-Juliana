import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { CANAIS, type CopilotoApi } from '../shared/ipc';

/** O Electron prefixa o erro de um `invoke` com "Error invoking remote method '…': Error: "; a tela só quer a mensagem. */
const PREFIXO_ERRO_INVOKE = /^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/;

async function invocar<T>(canal: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(canal, ...args)) as T;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    throw new Error(mensagem.replace(PREFIXO_ERRO_INVOKE, ''), { cause: erro });
  }
}

/** Escuta um canal e devolve a função que remove o ouvinte. */
function ouvir<A extends unknown[]>(canal: string, cb: (...args: A) => void): () => void {
  const ouvinte = (_evento: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A));
  ipcRenderer.on(canal, ouvinte);
  return () => {
    ipcRenderer.removeListener(canal, ouvinte);
  };
}

const api: CopilotoApi = {
  config: {
    obter: () => invocar(CANAIS.configObter),
    salvar: (p) => invocar(CANAIS.configSalvar, p),
    salvarChaves: (c) => invocar(CANAIS.configSalvarChaves, c),
  },
  documentos: {
    escolher: () => invocar(CANAIS.documentosEscolher),
    ler: (caminhos) => invocar(CANAIS.documentosLer, caminhos),
    caminhoDoArquivo: (f) => webUtils.getPathForFile(f),
  },
  reuniao: {
    iniciar: (o) => invocar(CANAIS.reuniaoIniciar, o),
    falaEnsaio: (quem, texto) => ipcRenderer.send(CANAIS.reuniaoFalaEnsaio, quem, texto),
    alternarPausa: () => ipcRenderer.send(CANAIS.reuniaoAlternarPausa),
    perguntar: (texto) => ipcRenderer.send(CANAIS.reuniaoPerguntar, texto),
    navegar: (delta) => ipcRenderer.send(CANAIS.reuniaoNavegar, delta),
    encerrar: () => invocar(CANAIS.reuniaoEncerrar),
    aoInstantaneo: (cb) => ouvir(CANAIS.reuniaoInstantaneo, cb),
  },
  audio: {
    enviar: (quem, pcm) => ipcRenderer.send(CANAIS.audioEnviar, quem, pcm),
    nivel: (quem, nivel) => ipcRenderer.send(CANAIS.audioNivel, quem, nivel),
    aoNivel: (cb) => ouvir(CANAIS.audioNivel, cb),
  },
  painel: {
    aoDigitar: (cb) => ouvir(CANAIS.painelDigitar, cb),
    terminarDigitacao: () => ipcRenderer.send(CANAIS.painelTerminarDigitacao),
    aoPreferencias: (cb) => ouvir(CANAIS.painelPreferencias, cb),
  },
  historico: {
    listar: () => invocar(CANAIS.historicoListar),
    obter: (id) => invocar(CANAIS.historicoObter, id),
    apagar: (id) => invocar(CANAIS.historicoApagar, id),
  },
  treino: {
    lerArquivo: () => invocar(CANAIS.treinoLerArquivo),
    perguntas: (cfg) => invocar(CANAIS.treinoPerguntas, cfg),
    avaliar: (cfg, pergunta, resposta) => invocar(CANAIS.treinoAvaliar, cfg, pergunta, resposta),
    finalizar: (cfg, respostas) => invocar(CANAIS.treinoFinalizar, cfg, respostas),
    ditadoIniciar: () => invocar(CANAIS.treinoDitadoIniciar),
    ditadoParar: () => invocar(CANAIS.treinoDitadoParar),
    aoDitado: (cb) => ouvir(CANAIS.treinoDitado, cb),
  },
  aoComandoCaptura: (cb) => ouvir(CANAIS.comandoCaptura, cb),
};

contextBridge.exposeInMainWorld('copiloto', api);
