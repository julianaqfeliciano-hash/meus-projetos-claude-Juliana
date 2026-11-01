import {
  AuthError,
  QuotaError,
  SonioxNodeClient,
  type RealtimeSttSession,
  type SttSessionConfig,
} from '@soniox/node';
import type { Fala, Quem, StatusConexao } from '../../shared/tipos';
import { AcumuladorFalas } from './acumulador';
import { atrasoReconexao } from './reconexao';

export interface CallbacksStt {
  aoFalar(f: Fala): void;
  aoParcial(texto: string): void;
  aoFimDeFala(): void;
  aoStatus(s: StatusConexao, motivo?: 'chave' | 'cota'): void;
}

export interface SttSession {
  iniciar(): Promise<void>;
  enviarAudio(pcm: Uint8Array): void;
  pausar(): void;
  retomar(): void;
  encerrar(): Promise<void>;
}

export type SessaoSdk = Pick<
  RealtimeSttSession,
  'connect' | 'sendAudio' | 'pause' | 'resume' | 'finish' | 'close' | 'on'
>;

export const CONFIG_SONIOX: SttSessionConfig = {
  model: 'stt-rt-v5',
  audio_format: 'pcm_s16le',
  sample_rate: 16000,
  num_channels: 1,
  language_hints: ['pt', 'en'],
  enable_language_identification: true,
  enable_endpoint_detection: true,
};

/**
 * Quanto `encerrar()` espera o `finish()` do SDK. O SDK não tem limite próprio: numa conexão meio
 * aberta ele ficaria pendente para sempre e a fala final nunca sairia.
 */
export const TEMPO_MAX_ENCERRAR_MS = 5000;

/** Erros que reconectar não resolve: chave recusada ou cota esgotada. */
function motivoSemRetentativa(erro: unknown): 'chave' | 'cota' | null {
  if (erro instanceof AuthError) return 'chave';
  if (erro instanceof QuotaError) return 'cota';
  return null;
}

/**
 * - `ativa`: tudo funciona.
 * - `encerrando`: `encerrar()` aguarda o `finish()`; só os resultados finais que ele libera são aproveitados.
 * - `encerrada`: nada mais chama os callbacks.
 */
type Fase = 'ativa' | 'encerrando' | 'encerrada';

class SessaoSoniox implements SttSession {
  private readonly acumulador: AcumuladorFalas;
  private fase: Fase = 'ativa';
  private iniciada = false;
  /** Sessão do SDK em uso. Eventos de qualquer outra sessão são ignorados. */
  private sessao: SessaoSdk | null = null;
  private conectado = false;
  private pausado = false;
  /** Quantas reconexões seguidas já foram agendadas; volta a 0 quando uma conecta. */
  private tentativa = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private encerramento: Promise<void> | null = null;

  constructor(
    quem: Quem,
    private readonly cb: CallbacksStt,
    private readonly fabrica: (c: SttSessionConfig) => SessaoSdk,
  ) {
    this.acumulador = new AcumuladorFalas(quem);
  }

  async iniciar(): Promise<void> {
    if (this.iniciada || this.fase !== 'ativa') return;
    this.iniciada = true;
    await this.conectar();
  }

  enviarAudio(pcm: Uint8Array): void {
    if (this.fase !== 'ativa' || !this.conectado || this.pausado || !this.sessao) return;
    try {
      this.sessao.sendAudio(pcm);
    } catch {
      // Descartar o áudio é o comportamento combinado. Se a sessão caiu, o SDK já emitiu `error`
      // antes de lançar, e é esse evento que dispara a reconexão.
    }
  }

  pausar(): void {
    if (this.fase !== 'ativa') return;
    this.pausado = true;
    if (this.conectado) this.sessao?.pause();
  }

  retomar(): void {
    if (this.fase !== 'ativa') return;
    this.pausado = false;
    if (this.conectado) this.sessao?.resume();
  }

  encerrar(): Promise<void> {
    this.encerramento ??= this.executarEncerramento();
    return this.encerramento;
  }

  private async executarEncerramento(): Promise<void> {
    this.fase = 'encerrando';
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
    const sdk = this.sessao;
    if (sdk) await this.aguardarFinish(sdk);
    this.fase = 'encerrada';
    this.sessao = null;
    this.conectado = false;
    if (sdk) this.fechar(sdk);
    const fala = this.acumulador.fimDeFala(Date.now());
    if (fala) this.cb.aoFalar(fala);
  }

  /** Espera o `finish()` por no máximo `TEMPO_MAX_ENCERRAR_MS`; nunca lança. */
  private async aguardarFinish(sdk: SessaoSdk): Promise<void> {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<void>((resolve) => {
      temporizador = setTimeout(resolve, TEMPO_MAX_ENCERRAR_MS);
    });
    try {
      // O finish() faz o servidor finalizar o que ainda era parcial; esses resultados chegam
      // pelo evento `result` antes de ele terminar. Se o limite vencer, o `race` ainda escuta o
      // finish(), então uma rejeição tardia (o close() que vem a seguir causa uma) não fica solta.
      await Promise.race([sdk.finish(), limite]);
    } catch {
      // Encerrar não depende do finish: a sessão pode já ter caído, ou nem ter conectado ainda.
    } finally {
      clearTimeout(temporizador);
    }
  }

  private async conectar(): Promise<void> {
    let sdk: SessaoSdk | null = null;
    try {
      sdk = this.fabrica(CONFIG_SONIOX);
      this.sessao = sdk;
      this.registrar(sdk);
      await sdk.connect();
    } catch (erro) {
      this.falhou(sdk, erro);
      return;
    }
    if (this.fase !== 'ativa' || sdk !== this.sessao) return;
    this.conectado = true;
    this.tentativa = 0;
    if (this.pausado) sdk.pause();
    this.cb.aoStatus('ok');
  }

  private registrar(sdk: SessaoSdk): void {
    sdk.on('result', (resultado) => {
      if (sdk !== this.sessao) return;
      if (this.fase === 'encerrando') {
        // Só junta o texto: ele sai na fala final de `encerrar`. Uma fala que o acumulador feche
        // por tempo não pode se perder.
        const { fala } = this.acumulador.adicionar(resultado.tokens, Date.now());
        if (fala) this.cb.aoFalar(fala);
        return;
      }
      if (this.fase !== 'ativa') return;
      const { parcial, fala } = this.acumulador.adicionar(resultado.tokens, Date.now());
      this.cb.aoParcial(parcial);
      if (fala) this.cb.aoFalar(fala);
    });
    sdk.on('endpoint', () => {
      if (sdk !== this.sessao || this.fase !== 'ativa') return;
      const fala = this.acumulador.fimDeFala(Date.now());
      if (fala) this.cb.aoFalar(fala);
      this.cb.aoFimDeFala();
    });
    sdk.on('error', (erro) => this.falhou(sdk, erro));
    sdk.on('disconnected', () => this.falhou(sdk));
  }

  /**
   * Trata a queda da sessão `sdk` (ou a falha em criá-la, com `sdk` nulo). Só a sessão atual conta:
   * a primeira notificação a descarta, então `error` + `disconnected` (ou o `disconnected` que o
   * próprio `close()` emite) agendam uma única reconexão.
   */
  private falhou(sdk: SessaoSdk | null, erro?: unknown): void {
    if (this.fase !== 'ativa' || sdk !== this.sessao) return;
    this.sessao = null;
    this.conectado = false;

    const motivo = motivoSemRetentativa(erro);
    if (motivo) {
      this.cb.aoStatus('erro', motivo);
      if (sdk) this.fechar(sdk);
      return;
    }

    this.cb.aoStatus('reconectando');
    if (sdk) this.fechar(sdk);
    const espera = atrasoReconexao(this.tentativa);
    this.tentativa += 1;
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.conectar();
    }, espera);
  }

  private fechar(sdk: SessaoSdk): void {
    try {
      sdk.close();
    } catch {
      // A sessão está sendo descartada de qualquer jeito; falha ao fechar não muda nada.
    }
  }
}

export function criarSessaoSoniox(
  quem: Quem,
  cb: CallbacksStt,
  fabrica: (c: SttSessionConfig) => SessaoSdk,
): SttSession {
  return new SessaoSoniox(quem, cb, fabrica);
}

export function fabricaSoniox(apiKey: string): (c: SttSessionConfig) => SessaoSdk {
  const cliente = new SonioxNodeClient({ api_key: apiKey });
  return (c) => cliente.realtime.stt(c);
}
