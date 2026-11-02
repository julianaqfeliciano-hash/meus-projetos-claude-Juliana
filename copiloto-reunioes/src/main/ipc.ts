import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { SonioxNodeClient } from '@soniox/node';
import { dialog, globalShortcut, ipcMain, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { CANAIS, type ComandoCaptura, type DocumentosLidos } from '../shared/ipc';
import { mensagemAviso, TEXTO_AVISO } from '../shared/textos';
import {
  LIMITE_TOKENS_DOCUMENTOS,
  type AcaoAtalho,
  type AvaliacaoResposta,
  type Aviso,
  type ConfigTreino,
  type ContextoReuniao,
  type IdiomaSugestao,
  type InstantaneoReuniao,
  type ItemHistoricoReuniao,
  type ItemHistoricoTreino,
  type Preferencias,
  type Quem,
  type ResultadoChave,
  type StatusConexao,
  type TipoAviso,
} from '../shared/tipos';
import { registrarAtalhos } from './atalhos-globais';
import { ATALHOS_PADRAO, normalizarAtalho, validarAtalhos } from './config/atalhos';
import type { Chaves } from './config/chaves';
import { salvarPreferencias } from './config/preferencias';
import { lerDocumento } from './documentos/ler-documento';
import type { Historico } from './historico/historico';
import { verificarChaveAnthropic, verificarChaveSoniox } from './ia/chaves-verificacao';
import { criarDetector } from './ia/detector';
import { criarExplicador } from './ia/explicador';
import { montarPrefixo } from './ia/prefixo';
import { criarResumidor } from './ia/resumo';
import { contarTokensDocumentos } from './ia/tokens';
import { criarTreinador, type RespostaTreino } from './ia/treinador';
import { criarControlePainel } from './janelas/painel';
import { criarSessaoReuniao, type SessaoReuniao } from './reuniao/sessao-reuniao';
import { criarSessaoSoniox, fabricaSoniox, type SttSession } from './transcricao/sessao-soniox';

export interface ContextoIpc {
  /** `app.getPath('userData')`. */
  dir: string;
  /** O único cofre de chaves do app. */
  cofre: { obter(): Promise<Chaves>; salvar(p: Partial<Chaves>): Promise<void> };
  historico: Historico;
  preferencias: Preferencias;
  principal(): BrowserWindow | null;
}

/** O que o resto do processo principal (janela principal) usa da reunião. */
export interface ControleReuniao {
  situacao(): 'ativa' | 'encerrando' | null;
  encerrar(): Promise<ItemHistoricoReuniao | null>;
  descartar(): void;
}

type Provedor = keyof Chaves;
const PROVEDORES: Provedor[] = ['anthropic', 'soniox'];
const ACOES = Object.keys(ATALHOS_PADRAO) as AcaoAtalho[];

const ERRO_PEDIDO = 'Pedido inválido.';
const ERRO_CHAVES = 'Configure as chaves nas Configurações';
const ERRO_REUNIAO_EM_ANDAMENTO = 'Já existe uma reunião em andamento.';
const ERRO_LIMITE_DOCUMENTOS =
  `Os documentos passam do limite de ${LIMITE_TOKENS_DOCUMENTOS.toLocaleString('pt-BR')} tokens — remova algum arquivo.`;
const ERRO_SALVAR_REUNIAO = 'Não consegui salvar a reunião no Histórico.';
const ERRO_SEM_PERGUNTAS = 'Não consegui gerar as perguntas — tente de novo.';
const ERRO_SEM_RESPOSTAS = 'Responda ao menos uma pergunta.';
const ERRO_DITADO_EM_REUNIAO = 'Encerre a reunião antes de responder falando.';
const ERRO_CONEXAO_DITADO = 'Não consegui conectar à transcrição — confira a internet e a chave da Soniox.';
const ATALHO_RECUSADO = 'Já usado por outro programa';
const TAMANHO_VAGA_RESUMO = 200;

const FILTRO_DOCUMENTOS = {
  name: 'Documentos',
  extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md', 'doc', 'xls', 'ppt'],
};

// ── Validação do que chega dos renderers (entrada não confiável) ─────────────────────────────────────

function exigir(condicao: boolean): asserts condicao {
  if (!condicao) throw new Error(ERRO_PEDIDO);
}
const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehListaDeTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto);
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehQuem = (v: unknown): v is Quem => v === 'voce' || v === 'outros';
function umDe<T extends string | number>(v: unknown, opcoes: readonly T[]): v is T {
  return opcoes.includes(v as T);
}

function lerAtalhos(v: unknown): Record<AcaoAtalho, string> {
  exigir(ehObjeto(v));
  const atalhos = {} as Record<AcaoAtalho, string>;
  for (const acao of ACOES) {
    const atalho = v[acao];
    exigir(ehTexto(atalho));
    atalhos[acao] = normalizarAtalho(atalho);
  }
  return atalhos;
}

/** As preferências que a tela de Configurações edita. `painel` e `ultimosArquivos` são do processo principal. */
function lerPreferenciasDaTela(v: unknown): Omit<Preferencias, 'painel' | 'ultimosArquivos'> {
  exigir(
    ehObjeto(v) &&
      ehTexto(v.sobreVoce) &&
      (v.microfoneId === null || ehTexto(v.microfoneId)) &&
      umDe(v.tamanhoLetra, ['normal', 'grande'] as const) &&
      typeof v.opacidadePainel === 'number' &&
      v.opacidadePainel >= 0.6 &&
      v.opacidadePainel <= 1 &&
      typeof v.invisivelNoCompartilhamento === 'boolean',
  );
  return {
    sobreVoce: v.sobreVoce,
    microfoneId: v.microfoneId,
    atalhos: lerAtalhos(v.atalhos),
    tamanhoLetra: v.tamanhoLetra,
    opacidadePainel: v.opacidadePainel,
    invisivelNoCompartilhamento: v.invisivelNoCompartilhamento,
  };
}

function lerPedidoReuniao(v: unknown): { caminhos: string[]; contexto: string; idioma: IdiomaSugestao; modo: 'audio' | 'ensaio' } {
  exigir(
    ehObjeto(v) &&
      ehListaDeTextos(v.caminhos) &&
      ehTexto(v.contexto) &&
      umDe(v.idioma, ['auto', 'pt', 'en'] as const) &&
      umDe(v.modo, ['audio', 'ensaio'] as const),
  );
  return { caminhos: v.caminhos, contexto: v.contexto, idioma: v.idioma, modo: v.modo };
}

function lerConfigTreino(v: unknown): ConfigTreino {
  exigir(
    ehObjeto(v) &&
      ehTexto(v.vaga) &&
      ehTexto(v.curriculo) &&
      umDe(v.idioma, ['pt', 'en'] as const) &&
      umDe(v.tipo, ['comportamental', 'tecnica', 'mista'] as const) &&
      umDe(v.quantidade, [5, 8, 10] as const),
  );
  return { vaga: v.vaga, curriculo: v.curriculo, idioma: v.idioma, tipo: v.tipo, quantidade: v.quantidade };
}

function lerAvaliacao(v: unknown): AvaliacaoResposta {
  exigir(
    ehObjeto(v) &&
      ehListaDeTextos(v.foiBem) &&
      ehListaDeTextos(v.faltou) &&
      ehTexto(v.respostaMelhorada) &&
      ehListaDeTextos(v.dicasIngles),
  );
  return { foiBem: v.foiBem, faltou: v.faltou, respostaMelhorada: v.respostaMelhorada, dicasIngles: v.dicasIngles };
}

function lerRespostas(v: unknown): RespostaTreino[] {
  exigir(Array.isArray(v));
  return v.map((r: unknown) => {
    exigir(ehObjeto(r) && ehTexto(r.pergunta) && ehTexto(r.resposta));
    return { pergunta: r.pergunta, resposta: r.resposta, avaliacao: lerAvaliacao(r.avaliacao) };
  });
}

/** O PCM chega como ArrayBuffer; uma visão (Uint8Array, Buffer) também serve. */
function paraBytes(pcm: unknown): Uint8Array | null {
  if (pcm instanceof ArrayBuffer) return new Uint8Array(pcm);
  if (ArrayBuffer.isView(pcm)) return new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return null;
}

// ── Preferências: uma gravação de cada vez ──────────────────────────────────────────────────────────

/**
 * `salvarPreferencias` grava o arquivo inteiro e a última gravação a terminar vence. Por isso toda mudança passa
 * por esta fila: cada uma parte do que a anterior gravou, e a memória só muda depois de gravar.
 */
function criarLojaPreferencias(dir: string, iniciais: Preferencias) {
  let atuais = iniciais;
  let fila: Promise<unknown> = Promise.resolve();
  return {
    obter: (): Preferencias => atuais,
    atualizar(mudar: (p: Preferencias) => Preferencias): Promise<Preferencias> {
      const execucao = fila.then(async () => {
        const novas = mudar(atuais);
        await salvarPreferencias(dir, novas);
        atuais = novas;
        return novas;
      });
      fila = execucao.catch(() => undefined);
      return execucao;
    },
  };
}

// ── Ligação ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Registra os handlers IPC e os atalhos globais e começa a verificação das chaves salvas (§9). Chamar uma vez,
 * no `app.whenReady`.
 */
export function iniciarIpc(ctx: ContextoIpc): ControleReuniao {
  const loja = criarLojaPreferencias(ctx.dir, ctx.preferencias);

  // Avisos do app (Windows antigo, atalho recusado), mostrados junto com os da reunião.
  const avisosApp = new Map<TipoAviso, Aviso>();

  let sessao: SessaoReuniao | null = null;
  let iniciando = false;
  let encerramento: Promise<ItemHistoricoReuniao | null> | null = null;

  interface Ditado {
    stt: SttSession;
    falas: string[];
  }
  let ditado: Ditado | null = null;

  const statusChaves: Record<Provedor, ResultadoChave | null> = { anthropic: null, soniox: null };
  // Uma verificação só grava o resultado se nenhuma mais nova (de `salvarChaves`) passou na frente.
  const versaoStatus: Record<Provedor, number> = { anthropic: 0, soniox: 0 };

  const painel = criarControlePainel({
    preferencias: () => loja.obter(),
    aoMudarLimites: (limites) => {
      loja
        .atualizar((p) => ({ ...p, painel: limites }))
        .catch((erro: unknown) => console.warn('Não consegui salvar a posição do painel:', erro));
    },
    aoCarregar: () => {
      painel.enviar(CANAIS.painelPreferencias, loja.obter());
      if (sessao) painel.enviar(CANAIS.reuniaoInstantaneo, comAvisos(sessao.instantaneo()));
    },
    avisar,
  });

  // ── Envio às janelas ──

  function enviarPrincipal(canal: string, ...args: unknown[]): void {
    const janela = ctx.principal();
    if (janela && !janela.isDestroyed()) janela.webContents.send(canal, ...args);
  }

  function comandarCaptura(c: ComandoCaptura): void {
    enviarPrincipal(CANAIS.comandoCaptura, c);
  }

  function comAvisos(i: InstantaneoReuniao): InstantaneoReuniao {
    return avisosApp.size === 0 ? i : { ...i, avisos: [...avisosApp.values(), ...i.avisos] };
  }

  function publicarInstantaneo(i: InstantaneoReuniao): void {
    const instantaneo = comAvisos(i);
    enviarPrincipal(CANAIS.reuniaoInstantaneo, instantaneo);
    painel.enviar(CANAIS.reuniaoInstantaneo, instantaneo);
  }

  function avisar(tipo: TipoAviso): void {
    if (avisosApp.has(tipo)) return;
    avisosApp.set(tipo, { id: randomUUID(), tipo, texto: TEXTO_AVISO[tipo] });
    if (sessao) publicarInstantaneo(sessao.instantaneo());
  }

  function retirarAviso(tipo: TipoAviso): void {
    if (avisosApp.delete(tipo) && sessao) publicarInstantaneo(sessao.instantaneo());
  }

  // ── Chaves ──

  async function chaveAnthropic(): Promise<string> {
    const { anthropic } = await ctx.cofre.obter();
    if (!anthropic) throw new Error(ERRO_CHAVES);
    return anthropic;
  }

  const verificar: Record<Provedor, (chave: string) => Promise<ResultadoChave>> = {
    anthropic: async (chave) => verificarChaveAnthropic(new Anthropic({ apiKey: chave })),
    soniox: async (chave) => verificarChaveSoniox(new SonioxNodeClient({ api_key: chave })),
  };

  function verificarEmSegundoPlano(provedor: Provedor, chave: string): void {
    const versao = ++versaoStatus[provedor];
    verificar[provedor](chave)
      .then((resultado) => {
        if (versaoStatus[provedor] === versao) statusChaves[provedor] = resultado;
      })
      .catch((erro: unknown) => console.warn(`Falha ao verificar a chave ${provedor}:`, erro));
  }

  async function obterConfig() {
    let chaves: Chaves = { anthropic: null, soniox: null };
    try {
      chaves = await ctx.cofre.obter();
    } catch (erro) {
      // Sem conseguir ler o cofre, as Configurações pedem as chaves; salvar mostra o erro.
      console.warn('Não consegui ler as chaves:', erro);
    }
    return {
      preferencias: loja.obter(),
      temChaves: { anthropic: Boolean(chaves.anthropic), soniox: Boolean(chaves.soniox) },
      statusChaves: { ...statusChaves },
    };
  }

  async function salvarChaves(c: unknown): Promise<Partial<Record<Provedor, ResultadoChave>>> {
    exigir(ehObjeto(c));
    const pedidas: Partial<Chaves> = {};
    for (const provedor of PROVEDORES) {
      const chave = c[provedor];
      if (chave === undefined) continue;
      exigir(ehTexto(chave));
      if (chave.trim() !== '') pedidas[provedor] = chave.trim();
    }
    const resultados: Partial<Record<Provedor, ResultadoChave>> = {};
    await Promise.all(
      PROVEDORES.map(async (provedor) => {
        const chave = pedidas[provedor];
        if (chave) resultados[provedor] = await verificar[provedor](chave);
      }),
    );
    // Só as chaves que funcionaram são gravadas.
    const validas = PROVEDORES.filter((p) => resultados[p] === 'ok');
    if (validas.length > 0) {
      const gravar: Partial<Chaves> = {};
      for (const provedor of validas) gravar[provedor] = pedidas[provedor];
      await ctx.cofre.salvar(gravar);
      for (const provedor of validas) {
        versaoStatus[provedor] += 1;
        statusChaves[provedor] = 'ok';
      }
    }
    return resultados;
  }

  // ── Atalhos ──

  /** A sessão que aceita ações: existe e não está encerrando. */
  function sessaoAtiva(): SessaoReuniao | null {
    return encerramento ? null : sessao;
  }

  // "Anterior" leva ao cartão mais antigo (a lista vai do mais novo ao mais antigo); "Próximo", ao mais novo.
  const acoesAtalho: Record<AcaoAtalho, () => void> = {
    ajudarResponder: () => sessaoAtiva()?.ajudarResponder(),
    explicar: () => sessaoAtiva()?.explicar(),
    digitar: () => {
      if (sessaoAtiva()) painel.digitar();
    },
    ocultar: () => {
      if (sessaoAtiva()) painel.alternar();
    },
    pausar: () => sessaoAtiva()?.alternarPausa(),
    anterior: () => sessaoAtiva()?.navegar(1),
    proximo: () => sessaoAtiva()?.navegar(-1),
  };

  function aplicarAtalhos(atalhos: Record<AcaoAtalho, string>): Record<AcaoAtalho, boolean> {
    const aceitos = registrarAtalhos(globalShortcut, atalhos, acoesAtalho);
    if (ACOES.every((acao) => aceitos[acao])) retirarAviso('atalho-recusado');
    else avisar('atalho-recusado');
    return aceitos;
  }

  async function salvarConfig(p: unknown): Promise<Record<AcaoAtalho, string | null>> {
    const daTela = lerPreferenciasDaTela(p);
    // Com algum atalho inválido nada é gravado: a tela mostra o erro ao lado de cada atalho.
    const erros = validarAtalhos(daTela.atalhos);
    if (ACOES.some((acao) => erros[acao] !== null)) return erros;

    const salvas = await loja.atualizar((atuais) => ({
      ...daTela,
      painel: atuais.painel,
      ultimosArquivos: atuais.ultimosArquivos,
    }));
    painel.aplicarPreferencias(salvas);
    const aceitos = aplicarAtalhos(salvas.atalhos);
    const resultado = {} as Record<AcaoAtalho, string | null>;
    for (const acao of ACOES) resultado[acao] = aceitos[acao] ? null : ATALHO_RECUSADO;
    return resultado;
  }

  // ── Documentos ──

  function escolherArquivos(opcoes: OpenDialogOptions) {
    const janela = ctx.principal();
    return janela ? dialog.showOpenDialog(janela, opcoes) : dialog.showOpenDialog(opcoes);
  }

  async function lerDocumentos(caminhos: unknown): Promise<DocumentosLidos> {
    exigir(ehListaDeTextos(caminhos));
    if (caminhos.length === 0) return { docs: [], tokens: 0, estimado: false };
    const cliente = new Anthropic({ apiKey: await chaveAnthropic() });
    const docs = await Promise.all(caminhos.map(lerDocumento));
    return { docs, ...(await contarTokensDocumentos(cliente, docs)) };
  }

  // ── Reunião ──

  async function iniciarReuniao(o: unknown): Promise<void> {
    const pedido = lerPedidoReuniao(o);
    if (sessao || iniciando) throw new Error(ERRO_REUNIAO_EM_ANDAMENTO);
    iniciando = true;
    try {
      const chaves = await ctx.cofre.obter();
      const chaveAnthropic = chaves.anthropic;
      const chaveSoniox = chaves.soniox;
      if (!chaveAnthropic || (pedido.modo === 'audio' && !chaveSoniox)) throw new Error(ERRO_CHAVES);

      const documentos = await Promise.all(pedido.caminhos.map(lerDocumento));
      const contexto: ContextoReuniao = {
        documentos,
        contexto: pedido.contexto,
        sobreVoce: loja.obter().sobreVoce,
        idioma: pedido.idioma,
      };
      const cliente = new Anthropic({ apiKey: chaveAnthropic });
      const { tokens } = await contarTokensDocumentos(cliente, documentos);
      if (tokens > LIMITE_TOKENS_DOCUMENTOS) throw new Error(ERRO_LIMITE_DOCUMENTOS);

      const nova = criarSessaoReuniao(
        {
          criarStt: (quem, cb) => {
            // Só o modo áudio cria transcrições, e nele a chave da Soniox já foi exigida acima.
            if (!chaveSoniox) throw new Error(ERRO_CHAVES);
            return criarSessaoSoniox(quem, cb, fabricaSoniox(chaveSoniox));
          },
          detector: criarDetector(cliente, montarPrefixo(contexto, 'detector')),
          explicador: criarExplicador(cliente, montarPrefixo(contexto, 'explicador')),
          resumidor: criarResumidor(cliente, montarPrefixo(contexto, 'resumo')),
          publicar: publicarInstantaneo,
          salvar: (item) => ctx.historico.salvar(item),
          gerarId: randomUUID,
        },
        { modo: pedido.modo, contexto },
      );

      // A reunião usa o microfone: um ditado do treino que tenha ficado aberto é encerrado.
      soltarDitado();
      sessao = nova;
      try {
        const inicio = nova.iniciar();
        painel.mostrar();
        if (pedido.modo === 'audio') comandarCaptura({ acao: 'iniciar', quem: ['voce', 'outros'] });
        loja
          .atualizar((p) => ({ ...p, ultimosArquivos: pedido.caminhos }))
          .catch((erro: unknown) => console.warn('Não consegui salvar os últimos arquivos:', erro));
        await inicio;
      } catch (erro) {
        descartarReuniao();
        throw erro;
      }
    } finally {
      iniciando = false;
    }
  }

  function encerrarReuniao(): Promise<ItemHistoricoReuniao | null> {
    if (encerramento) return encerramento;
    const atual = sessao;
    if (!atual) return Promise.resolve(null);
    comandarCaptura({ acao: 'parar' });
    painel.esconder();
    encerramento = atual
      .encerrar()
      .catch((erro: unknown) => {
        // A transcrição já foi apagada da memória; só resta avisar.
        console.warn('Falha ao encerrar a reunião:', erro);
        throw new Error(ERRO_SALVAR_REUNIAO);
      })
      .finally(() => {
        encerramento = null;
        if (sessao === atual) sessao = null;
      });
    return encerramento;
  }

  function descartarReuniao(): void {
    const atual = sessao;
    if (!atual || encerramento) return;
    comandarCaptura({ acao: 'parar' });
    painel.esconder();
    atual.descartar();
    sessao = null;
  }

  // ── Treino ──

  async function treinador() {
    return criarTreinador(new Anthropic({ apiKey: await chaveAnthropic() }), randomUUID);
  }

  async function lerArquivoTreino(): Promise<string | null> {
    const escolha = await escolherArquivos({ properties: ['openFile'], filters: [FILTRO_DOCUMENTOS] });
    const caminho = escolha.filePaths[0];
    if (escolha.canceled || caminho === undefined) return null;
    const doc = await lerDocumento(caminho);
    if (doc.aviso) throw new Error(mensagemAviso(doc.aviso));
    return doc.partes.map((p) => p.texto).join('\n\n');
  }

  async function gerarPerguntas(cfg: unknown) {
    const perguntas = await (await treinador()).gerarPerguntas(lerConfigTreino(cfg));
    if (perguntas.length === 0) throw new Error(ERRO_SEM_PERGUNTAS);
    return perguntas;
  }

  async function avaliarResposta(cfg: unknown, pergunta: unknown, resposta: unknown) {
    const config = lerConfigTreino(cfg);
    exigir(ehTexto(pergunta) && ehTexto(resposta));
    return (await treinador()).avaliar(config, pergunta, resposta);
  }

  async function finalizarTreino(cfg: unknown, respostas: unknown): Promise<ItemHistoricoTreino> {
    const config = lerConfigTreino(cfg);
    const lidas = lerRespostas(respostas);
    if (lidas.length === 0) throw new Error(ERRO_SEM_RESPOSTAS);
    const relatorio = await (await treinador()).relatorio(config, lidas);
    const item: ItemHistoricoTreino = {
      id: randomUUID(),
      tipo: 'treino',
      data: new Date().toISOString(),
      idioma: config.idioma,
      tipoEntrevista: config.tipo,
      vagaResumo: Array.from(config.vaga.trim()).slice(0, TAMANHO_VAGA_RESUMO).join(''),
      perguntas: lidas.map((r) => r.pergunta),
      relatorio,
    };
    await ctx.historico.salvar(item);
    return item;
  }

  /** Tira o ditado em andamento de uso (para a captura e fecha a transcrição em segundo plano). */
  function soltarDitado(): Ditado | null {
    const atual = ditado;
    if (!atual) return null;
    ditado = null;
    comandarCaptura({ acao: 'parar' });
    atual.stt.encerrar().catch((erro: unknown) => console.warn('Falha ao encerrar o ditado:', erro));
    return atual;
  }

  async function iniciarDitado(): Promise<void> {
    const { soniox } = await ctx.cofre.obter();
    if (!soniox) throw new Error(ERRO_CHAVES);
    // O treino nunca usa o som do computador, e o microfone não pode servir a reunião e o ditado ao mesmo tempo.
    if (sessao || iniciando) throw new Error(ERRO_DITADO_EM_REUNIAO);
    soltarDitado();

    const falas: string[] = [];
    let parcial = '';
    const conexao: { status: StatusConexao | null; motivo?: 'chave' | 'cota' } = { status: null };
    const mostrar = (): void =>
      enviarPrincipal(CANAIS.treinoDitado, [...falas, parcial].filter((t) => t !== '').join(' '));
    const stt = criarSessaoSoniox(
      'voce',
      {
        aoFalar: (f) => {
          falas.push(f.texto);
          parcial = '';
          mostrar();
        },
        aoParcial: (texto) => {
          parcial = texto;
          mostrar();
        },
        aoFimDeFala: () => undefined,
        aoStatus: (status, motivo) => {
          conexao.status = status;
          conexao.motivo = motivo;
        },
      },
      fabricaSoniox(soniox),
    );
    const atual: Ditado = { stt, falas };
    ditado = atual;

    await stt.iniciar();
    if (ditado !== atual) return; // parado (ou trocado) enquanto conectava
    if (conexao.status !== 'ok') {
      ditado = null;
      await stt.encerrar();
      throw new Error(conexao.motivo ? TEXTO_AVISO[conexao.motivo] : ERRO_CONEXAO_DITADO);
    }
    comandarCaptura({ acao: 'iniciar', quem: ['voce'] });
  }

  async function pararDitado(): Promise<string> {
    const atual = ditado;
    ditado = null;
    comandarCaptura({ acao: 'parar' });
    if (!atual) return '';
    // A fala final de cada trecho chega durante o encerramento.
    await atual.stt.encerrar();
    return atual.falas.join(' ');
  }

  // ── Handlers ──

  const tratar = (canal: string, fn: (...args: unknown[]) => unknown): void =>
    ipcMain.handle(canal, (_evento, ...args: unknown[]) => fn(...args));
  // Mensagens sem resposta: entrada inválida é ignorada (não há a quem devolver o erro).
  const ouvir = (canal: string, fn: (...args: unknown[]) => void): void => {
    ipcMain.on(canal, (_evento, ...args: unknown[]) => fn(...args));
  };

  tratar(CANAIS.configObter, obterConfig);
  tratar(CANAIS.configSalvar, salvarConfig);
  tratar(CANAIS.configSalvarChaves, salvarChaves);

  tratar(CANAIS.documentosEscolher, async () => {
    const escolha = await escolherArquivos({ properties: ['openFile', 'multiSelections'], filters: [FILTRO_DOCUMENTOS] });
    return escolha.canceled ? [] : escolha.filePaths;
  });
  tratar(CANAIS.documentosLer, lerDocumentos);

  tratar(CANAIS.reuniaoIniciar, iniciarReuniao);
  tratar(CANAIS.reuniaoEncerrar, encerrarReuniao);
  ouvir(CANAIS.reuniaoFalaEnsaio, (quem, texto) => {
    if (ehQuem(quem) && ehTexto(texto)) sessaoAtiva()?.falaEnsaio(quem, texto);
  });
  ouvir(CANAIS.reuniaoAlternarPausa, () => sessaoAtiva()?.alternarPausa());
  ouvir(CANAIS.reuniaoPerguntar, (texto) => {
    if (ehTexto(texto)) sessaoAtiva()?.perguntar(texto);
  });
  ouvir(CANAIS.reuniaoNavegar, (delta) => {
    if (delta === 1 || delta === -1) sessaoAtiva()?.navegar(delta);
  });

  ouvir(CANAIS.audioEnviar, (quem, pcm) => {
    const bytes = paraBytes(pcm);
    if (!ehQuem(quem) || !bytes) return;
    if (ditado) {
      if (quem === 'voce') ditado.stt.enviarAudio(bytes);
      return;
    }
    sessao?.receberAudio(quem, bytes);
  });
  ouvir(CANAIS.audioNivel, (quem, nivel) => {
    if (ehQuem(quem) && typeof nivel === 'number' && Number.isFinite(nivel)) painel.enviar(CANAIS.audioNivel, quem, nivel);
  });

  ouvir(CANAIS.painelTerminarDigitacao, () => painel.terminarDigitacao());

  tratar(CANAIS.historicoListar, () => ctx.historico.listar());
  tratar(CANAIS.historicoObter, (id) => {
    exigir(ehTexto(id));
    return ctx.historico.obter(id);
  });
  tratar(CANAIS.historicoApagar, (id) => {
    exigir(ehTexto(id));
    return ctx.historico.apagar(id);
  });

  tratar(CANAIS.treinoLerArquivo, lerArquivoTreino);
  tratar(CANAIS.treinoPerguntas, gerarPerguntas);
  tratar(CANAIS.treinoAvaliar, avaliarResposta);
  tratar(CANAIS.treinoFinalizar, finalizarTreino);
  tratar(CANAIS.treinoDitadoIniciar, iniciarDitado);
  tratar(CANAIS.treinoDitadoParar, pararDitado);

  // ── Abertura ──

  aplicarAtalhos(loja.obter().atalhos);
  ctx.cofre
    .obter()
    .then((chaves) => {
      for (const provedor of PROVEDORES) {
        const chave = chaves[provedor];
        if (chave) verificarEmSegundoPlano(provedor, chave);
      }
    })
    .catch((erro: unknown) => console.warn('Não consegui ler as chaves para verificá-las:', erro));

  return {
    situacao: () => (sessao === null ? null : encerramento ? 'encerrando' : 'ativa'),
    encerrar: encerrarReuniao,
    descartar: descartarReuniao,
  };
}
