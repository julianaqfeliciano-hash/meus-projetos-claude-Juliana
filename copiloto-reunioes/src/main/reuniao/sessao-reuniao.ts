import type {
  Aviso,
  Cartao,
  ConteudoCartao,
  ContextoReuniao,
  EstadoReuniao,
  Fala,
  InstantaneoReuniao,
  ItemDetectado,
  ItemHistoricoReuniao,
  OrigemCartao,
  Quem,
  ResumoReuniao,
  StatusConexao,
  TipoAviso,
  TipoCartao,
} from '../../shared/tipos';
import { TEXTO_AVISO } from '../../shared/textos';
import type { Detector } from '../ia/detector';
import { classificarErro } from '../ia/erros';
import type { Explicador, PedidoCartao } from '../ia/explicador';
import { CAMPO_PRINCIPAL } from '../ia/interpretar-cartao';
import type { Resumidor } from '../ia/resumo';
import type { CallbacksStt, SttSession } from '../transcricao/sessao-soniox';
import { Transcricao } from '../transcricao/transcricao';
import { AgendadorDetector } from './agendador';
import { normalizarChave } from './normalizar';

export interface DepsReuniao {
  criarStt(quem: Quem, cb: CallbacksStt): SttSession;
  detector: Detector;
  explicador: Explicador;
  resumidor: Resumidor;
  publicar(i: InstantaneoReuniao): void;
  salvar(item: ItemHistoricoReuniao): Promise<void>;
  gerarId(): string;
}

export interface OpcoesReuniao {
  modo: 'audio' | 'ensaio';
  contexto: ContextoReuniao;
}

export interface SessaoReuniao {
  iniciar(): Promise<void>;
  receberAudio(quem: Quem, pcm: Uint8Array): void;
  falaEnsaio(quem: Quem, texto: string): void;
  ajudarResponder(): void;
  explicar(): void;
  perguntar(texto: string): void;
  alternarPausa(): void;
  navegar(delta: 1 | -1): void;
  encerrar(): Promise<ItemHistoricoReuniao | null>;
  descartar(): void;
  instantaneo(): InstantaneoReuniao;
}

const ERRO_CARTAO = 'não consegui agora — aperte Ctrl+Alt+Espaço para tentar de novo';
const ERRO_RECUSA = 'não foi possível gerar esta sugestão';

const QUEM: Quem[] = ['voce', 'outros'];
const MINUTO_MS = 60_000;
const JANELA_DETECTOR_MS = 180_000;
const JANELA_ATALHO_MS = 60_000;
const JANELA_PERGUNTA_MS = 180_000;
const ESPACO_AUTOMATICOS_MS = 8000;
const MAX_AUTOMATICOS_SIMULTANEOS = 2;
const DESACELERAR_MS = 60_000;
const VERIFICACAO_MS = 30_000;
const SILENCIO_PAUSA_MS = 15 * MINUTO_MS;
const SEM_SOM_MS = 2 * MINUTO_MS;
const ESPERA_MAX_EXPLICACOES_MS = 25_000;
const PUBLICACAO_MIN_MS = 100;

/** Roda `fn` sem deixar exceção escapar: callbacks e temporizadores da reunião nunca lançam. */
function semLancar(onde: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    console.warn(`Falha em ${onde}:`, e);
  }
}

/** Publica no máximo 1 vez a cada 100 ms; a última mudança sempre sai. Depois de `fechar`, não publica mais. */
class Publicador {
  private ultima = -Infinity;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private fechado = false;

  constructor(private readonly enviar: () => void) {}

  mudou(): void {
    if (this.fechado || this.temporizador !== null) return;
    const espera = this.ultima + PUBLICACAO_MIN_MS - Date.now();
    if (espera <= 0) {
      this.publicar();
      return;
    }
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.publicar();
    }, espera);
  }

  /**
   * Publica o estado atual na hora e para de publicar. Assim, nada que termine depois (uma explicação lenta)
   * chega às janelas, que já podem estar mostrando a reunião seguinte.
   */
  fechar(): void {
    if (this.fechado) return;
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.publicar();
    this.fechado = true;
  }

  private publicar(): void {
    this.ultima = Date.now();
    semLancar('publicar', this.enviar);
  }
}

/** Uma reunião (ou ensaio): `preparando → ouvindo ⇄ pausado → encerrando → concluida`. */
class Reuniao implements SessaoReuniao {
  private estado: EstadoReuniao = 'preparando';
  private readonly conexao: Record<Quem, StatusConexao> = { voce: 'ok', outros: 'ok' };
  /** Do mais novo ao mais antigo. */
  private readonly cartoes: Cartao[] = [];
  private indiceAtual = 0;
  private avisos: Aviso[] = [];
  private parciais: Record<Quem, string> = { voce: '', outros: '' };
  private readonly transcricao = new Transcricao();
  private readonly stt = new Map<Quem, SttSession>();
  private readonly agendador = new AgendadorDetector(() => this.cicloDetector());
  private readonly publicador = new Publicador(() => this.deps.publicar(this.instantaneo()));
  /** Chaves normalizadas dos itens detectados que já viraram cartão ou estão na fila. */
  private readonly cobertos: string[] = [];
  private fila: ItemDetectado[] = [];
  private automaticosAtivos = 0;
  private ultimoAutomaticoEm: number | null = null;
  private esperaFila: ReturnType<typeof setTimeout> | null = null;
  private verificacao: ReturnType<typeof setInterval> | null = null;
  /** Explicações em andamento, de qualquer origem. Nenhuma rejeita. */
  private readonly explicacoes = new Set<Promise<void>>();
  private inicioEm = 0;
  /** O silêncio conta a partir da última fala, do início ou da última retomada, o que for mais recente. */
  private retomadaEm = 0;
  private encerramento: Promise<ItemHistoricoReuniao> | null = null;

  constructor(
    private readonly deps: DepsReuniao,
    private readonly opcoes: OpcoesReuniao,
  ) {}

  async iniciar(): Promise<void> {
    if (this.estado !== 'preparando') return;
    this.inicioEm = Date.now();
    this.retomadaEm = this.inicioEm;
    void this.deps.explicador.preaquecer();
    if (this.opcoes.modo === 'audio') {
      for (const quem of QUEM) this.stt.set(quem, this.deps.criarStt(quem, this.callbacksStt(quem)));
      this.verificacao = setInterval(() => semLancar('verificação', () => this.verificar()), VERIFICACAO_MS);
    }
    // A reunião começa sem esperar as conexões: o estado de cada uma chega por `aoStatus`.
    this.estado = 'ouvindo';
    this.agendador.iniciar();
    this.mudou();
    await Promise.all([...this.stt.values()].map((s) => s.iniciar()));
  }

  receberAudio(quem: Quem, pcm: Uint8Array): void {
    if (this.estado === 'ouvindo') this.stt.get(quem)?.enviarAudio(pcm);
  }

  falaEnsaio(quem: Quem, texto: string): void {
    const limpo = texto.trim();
    if (this.estado !== 'ouvindo' || limpo === '') return;
    this.registrarFala({ quem, texto: limpo, idioma: 'pt', em: Date.now() });
    if (quem === 'outros') this.agendador.fimDeFalaOutros();
  }

  ajudarResponder(): void {
    this.cartaoPedido('atalho', '…', { tipo: 'diga-isso', janela: this.janela(JANELA_ATALHO_MS) });
  }

  explicar(): void {
    this.cartaoPedido('atalho', '…', { tipo: 'conceito', janela: this.janela(JANELA_ATALHO_MS) });
  }

  perguntar(texto: string): void {
    const alvo = texto.trim();
    if (alvo === '') return;
    this.cartaoPedido('digitado', alvo, { tipo: 'resposta', alvo, janela: this.janela(JANELA_PERGUNTA_MS) });
  }

  alternarPausa(): void {
    if (this.estado === 'ouvindo') this.pausar();
    else if (this.estado === 'pausado') this.retomar();
  }

  navegar(delta: 1 | -1): void {
    const ultimo = Math.max(this.cartoes.length - 1, 0);
    const novo = Math.min(Math.max(this.indiceAtual + delta, 0), ultimo);
    if (novo === this.indiceAtual) return;
    this.indiceAtual = novo;
    this.mudou();
  }

  encerrar(): Promise<ItemHistoricoReuniao | null> {
    if (this.encerramento) return this.encerramento;
    if (!this.ativa()) return Promise.resolve(null);
    this.encerramento = this.executarEncerramento();
    return this.encerramento;
  }

  /** Para tudo sem resumir nem salvar. Depois de `encerrar` começar, quem termina a reunião é o encerramento. */
  descartar(): void {
    if (this.estado === 'encerrando' || this.estado === 'concluida') return;
    this.pararAgendamentos();
    void this.encerrarTranscricoes();
    this.finalizar();
  }

  instantaneo(): InstantaneoReuniao {
    return structuredClone({
      estado: this.estado,
      modo: this.opcoes.modo,
      conexao: this.conexao,
      cartoes: this.cartoes,
      indiceAtual: this.indiceAtual,
      avisos: this.avisos,
      parciais: this.parciais,
      transcricao: this.transcricao.todas(),
    });
  }

  // ── Estado ───────────────────────────────────────────────────────────────────────────────────────

  private ativa(): boolean {
    return this.estado === 'ouvindo' || this.estado === 'pausado';
  }

  /** Falas e parciais contam até o fim do encerramento: a fala final de cada transcrição chega nele. */
  private aceitaTranscricao(): boolean {
    return this.ativa() || this.estado === 'encerrando';
  }

  private janela(ms: number): Fala[] {
    return this.transcricao.janela(ms, Date.now());
  }

  private mudou(): void {
    this.publicador.mudou();
  }

  private pausar(): void {
    this.estado = 'pausado';
    for (const s of this.stt.values()) s.pausar();
    this.agendador.parar();
    this.mudou();
  }

  private retomar(): void {
    this.estado = 'ouvindo';
    this.retomadaEm = Date.now();
    this.removerAviso('pausa-automatica');
    for (const s of this.stt.values()) s.retomar();
    this.agendador.iniciar();
    this.processarFila();
    this.mudou();
  }

  private adicionarAviso(tipo: TipoAviso): void {
    if (this.avisos.some((a) => a.tipo === tipo)) return;
    this.avisos.push({ id: this.deps.gerarId(), tipo, texto: TEXTO_AVISO[tipo] });
    this.mudou();
  }

  private removerAviso(tipo: TipoAviso): void {
    if (!this.avisos.some((a) => a.tipo === tipo)) return;
    this.avisos = this.avisos.filter((a) => a.tipo !== tipo);
    this.mudou();
  }

  // ── Transcrição ──────────────────────────────────────────────────────────────────────────────────

  private callbacksStt(quem: Quem): CallbacksStt {
    return {
      aoFalar: (f) =>
        semLancar('aoFalar', () => {
          if (this.aceitaTranscricao()) this.registrarFala(f);
        }),
      aoParcial: (texto) => semLancar('aoParcial', () => this.atualizarParcial(quem, texto)),
      aoFimDeFala: () => semLancar('aoFimDeFala', () => this.fimDeFala(quem)),
      aoStatus: (status, motivo) => semLancar('aoStatus', () => this.atualizarConexao(quem, status, motivo)),
    };
  }

  private registrarFala(f: Fala): void {
    this.transcricao.adicionar(f);
    this.agendador.novaFala();
    if (f.quem === 'outros') this.removerAviso('sem-som-outros');
    this.mudou();
  }

  private atualizarParcial(quem: Quem, texto: string): void {
    if (!this.aceitaTranscricao() || this.parciais[quem] === texto) return;
    this.parciais[quem] = texto;
    this.mudou();
  }

  /** No fim de fala o parcial já virou fala: limpá-lo evita o mesmo texto duas vezes na transcrição ao vivo. */
  private fimDeFala(quem: Quem): void {
    if (!this.aceitaTranscricao()) return;
    this.atualizarParcial(quem, '');
    if (quem === 'outros') this.agendador.fimDeFalaOutros();
  }

  private atualizarConexao(quem: Quem, status: StatusConexao, motivo?: 'chave' | 'cota'): void {
    if (this.estado === 'concluida') return;
    if (status === 'erro' && motivo) this.adicionarAviso(motivo);
    if (this.conexao[quem] === status) return; // 'reconectando' se repete a cada tentativa
    this.conexao[quem] = status;
    this.mudou();
  }

  /** A cada 30 s, no modo áudio: pausa após 15 min de silêncio e avisa se só "Você" está sendo ouvida. */
  private verificar(): void {
    if (this.estado !== 'ouvindo') return;
    const agora = Date.now();
    const ultimaFala = this.transcricao.ultimaQualquer() ?? 0;
    if (agora - Math.max(ultimaFala, this.retomadaEm) > SILENCIO_PAUSA_MS) {
      this.pausar();
      this.adicionarAviso('pausa-automatica');
      return;
    }
    const falouHaPouco = (em: number | null) => em !== null && agora - em <= SEM_SOM_MS;
    if (
      agora - this.inicioEm > SEM_SOM_MS &&
      falouHaPouco(this.transcricao.ultimaDe('voce')) &&
      !falouHaPouco(this.transcricao.ultimaDe('outros'))
    ) {
      this.adicionarAviso('sem-som-outros');
    }
  }

  // ── Detector e fila automática ───────────────────────────────────────────────────────────────────

  private async cicloDetector(): Promise<void> {
    let itens: ItemDetectado[];
    try {
      itens = await this.deps.detector.detectar(this.janela(JANELA_DETECTOR_MS), [...this.cobertos]);
    } catch (e) {
      if (classificarErro(e) === 'limite') this.agendador.desacelerar(DESACELERAR_MS);
      console.warn('O detector falhou; ciclo pulado:', e);
      return;
    }
    if (!this.ativa()) return;
    for (const item of itens) {
      const chave = normalizarChave(item.texto);
      if (chave === '' || this.cobertos.includes(chave)) continue;
      this.cobertos.push(chave);
      this.fila.push(item);
    }
    this.processarFila();
  }

  /** Começa os itens da fila enquanto a escuta está ativa, há vaga e já passaram 8 s do último automático. */
  private processarFila(): void {
    while (
      this.estado === 'ouvindo' &&
      this.esperaFila === null &&
      this.fila.length > 0 &&
      this.automaticosAtivos < MAX_AUTOMATICOS_SIMULTANEOS
    ) {
      const espera = this.ultimoAutomaticoEm === null ? 0 : this.ultimoAutomaticoEm + ESPACO_AUTOMATICOS_MS - Date.now();
      if (espera > 0) {
        this.esperaFila = setTimeout(() => {
          this.esperaFila = null;
          semLancar('fila', () => this.processarFila());
        }, espera);
        return;
      }
      this.abrirCartaoAutomatico(this.fila.shift()!);
    }
  }

  private abrirCartaoAutomatico(item: ItemDetectado): void {
    const tipo: TipoCartao = item.tipo === 'pergunta' ? 'diga-isso' : 'conceito';
    const pedido: PedidoCartao = { tipo, alvo: item.texto, janela: this.janela(JANELA_DETECTOR_MS) };
    const execucao = this.abrirCartao('automatico', item.texto, pedido);
    this.automaticosAtivos += 1;
    this.ultimoAutomaticoEm = Date.now();
    void execucao.then(() => {
      this.automaticosAtivos -= 1;
      semLancar('fila', () => this.processarFila());
    });
  }

  // ── Cartões ──────────────────────────────────────────────────────────────────────────────────────

  /** Cartão pedido pela usuária (atalho ou pergunta digitada): só com a reunião ativa, fora da fila automática. */
  private cartaoPedido(origem: OrigemCartao, titulo: string, pedido: PedidoCartao): void {
    if (this.ativa()) void this.abrirCartao(origem, titulo, pedido);
  }

  /** Põe o cartão no início da lista e chama o explicador. A promessa devolvida nunca rejeita. */
  private abrirCartao(origem: OrigemCartao, titulo: string, pedido: PedidoCartao): Promise<void> {
    const cartao: Cartao = {
      id: this.deps.gerarId(),
      tipo: pedido.tipo,
      titulo,
      origem,
      estado: 'escrevendo',
      criadoEm: Date.now(),
      campos: {},
      fontes: [],
    };
    this.cartoes.unshift(cartao);
    this.indiceAtual = 0;
    this.mudou();
    const execucao = this.explicarCartao(cartao, pedido).catch((e: unknown) => {
      console.warn('Falha ao concluir o cartão:', e);
    });
    this.explicacoes.add(execucao);
    void execucao.then(() => this.explicacoes.delete(execucao));
    return execucao;
  }

  private async explicarCartao(cartao: Cartao, pedido: PedidoCartao): Promise<void> {
    try {
      const final = await this.deps.explicador.explicar(pedido, (c) =>
        semLancar('aoAtualizar', () => {
          this.mesclar(cartao, c);
          this.mudou();
        }),
      );
      this.mesclar(cartao, final);
      // Um cartão "pronto" em branco enganaria a usuária no meio da reunião.
      if (final.campos[CAMPO_PRINCIPAL[cartao.tipo]]?.trim()) {
        cartao.estado = 'pronto';
      } else {
        cartao.estado = 'erro';
        cartao.erro = ERRO_CARTAO;
      }
    } catch (erro) {
      this.marcarErro(cartao, erro);
    }
    this.mudou();
  }

  /** O explicador manda o conteúdo acumulado: as fontes vêm completas; o título, só quando já foi escrito. */
  private mesclar(cartao: Cartao, conteudo: ConteudoCartao): void {
    cartao.campos = { ...cartao.campos, ...conteudo.campos };
    cartao.fontes = [...conteudo.fontes];
    if (conteudo.titulo) cartao.titulo = conteudo.titulo;
  }

  private marcarErro(cartao: Cartao, erro: unknown): void {
    console.warn('O explicador falhou:', erro);
    const classe = classificarErro(erro);
    cartao.estado = 'erro';
    cartao.erro = classe === 'recusa' ? ERRO_RECUSA : ERRO_CARTAO;
    if (classe === 'chave' || classe === 'permissao') this.adicionarAviso('chave');
  }

  // ── Encerramento ─────────────────────────────────────────────────────────────────────────────────

  private async executarEncerramento(): Promise<ItemHistoricoReuniao> {
    const fimEm = Date.now();
    this.estado = 'encerrando';
    this.pararAgendamentos();
    this.mudou();
    await Promise.all([this.encerrarTranscricoes(), this.aguardarExplicacoes()]);
    try {
      const item = this.montarItem(await this.resumir(), fimEm);
      await this.deps.salvar(item);
      return item;
    } finally {
      this.finalizar();
    }
  }

  private pararAgendamentos(): void {
    this.agendador.parar();
    if (this.verificacao !== null) clearInterval(this.verificacao);
    if (this.esperaFila !== null) clearTimeout(this.esperaFila);
    this.verificacao = null;
    this.esperaFila = null;
    this.fila = [];
  }

  /** Fecha as transcrições (cada uma tem seu limite de tempo) e entrega as falas finais. Nunca rejeita. */
  private async encerrarTranscricoes(): Promise<void> {
    const resultados = await Promise.allSettled([...this.stt.values()].map((s) => s.encerrar()));
    for (const r of resultados) {
      if (r.status === 'rejected') console.warn('Falha ao encerrar a transcrição:', r.reason);
    }
  }

  /** Espera as explicações em andamento, por no máximo 25 s, para os conceitos que ficarem prontos irem ao histórico. */
  private async aguardarExplicacoes(): Promise<void> {
    let limite: ReturnType<typeof setTimeout> | undefined;
    const prazo = new Promise<void>((resolve) => {
      limite = setTimeout(resolve, ESPERA_MAX_EXPLICACOES_MS);
    });
    try {
      await Promise.race([Promise.all(this.explicacoes), prazo]);
    } finally {
      clearTimeout(limite);
    }
  }

  /** Resumo com uma nova tentativa. Se falhar de novo, o histórico fica só com os conceitos. */
  private async resumir(): Promise<ResumoReuniao | null> {
    const falas = this.transcricao.todas();
    const termos = this.conceitosProntos().map((c) => c.titulo);
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        return await this.deps.resumidor.resumir(falas, termos);
      } catch (e) {
        console.warn('O resumo falhou:', e);
      }
    }
    this.adicionarAviso('resumo-falhou');
    return null;
  }

  /** Cartões de conceito prontos, do mais antigo ao mais novo. */
  private conceitosProntos(): Cartao[] {
    return this.cartoes.filter((c) => c.tipo === 'conceito' && c.estado === 'pronto').reverse();
  }

  /** Só resumo e conceitos: a transcrição e os cartões "Diga isso" nunca vão para o disco. */
  private montarItem(resumo: ResumoReuniao | null, fimEm: number): ItemHistoricoReuniao {
    const { contexto, documentos } = this.opcoes.contexto;
    return {
      id: this.deps.gerarId(),
      tipo: 'reuniao',
      data: new Date(this.inicioEm).toISOString(),
      duracaoMin: Math.round((fimEm - this.inicioEm) / MINUTO_MS),
      contexto,
      documentos: documentos.map((d) => d.nome),
      resumo,
      conceitos: this.conceitosProntos().map((c) => ({
        termo: c.titulo,
        explicacao: c.campos.explicacao ?? '',
        fontes: c.fontes.map((f) => ({ ...f })),
      })),
    };
  }

  /** Apaga a transcrição e os parciais da memória, vai para `concluida` e publica o estado final. */
  private finalizar(): void {
    this.transcricao.limpar();
    this.parciais = { voce: '', outros: '' };
    this.estado = 'concluida';
    this.publicador.fechar();
  }
}

export function criarSessaoReuniao(deps: DepsReuniao, opcoes: OpcoesReuniao): SessaoReuniao {
  return new Reuniao(deps, opcoes);
}
