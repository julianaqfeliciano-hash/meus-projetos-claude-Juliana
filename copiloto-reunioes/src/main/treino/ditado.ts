import type { ComandoCaptura } from '../../shared/ipc';
import { TEXTO_AVISO } from '../../shared/textos';
import type { StatusConexao } from '../../shared/tipos';
import type { CallbacksStt, SttSession } from '../transcricao/sessao-soniox';

export const ERRO_CONEXAO_DITADO = 'Não consegui conectar à transcrição — confira a internet e a chave da Soniox.';
export const ERRO_DITADO_INTERROMPIDO = 'O ditado foi interrompido antes de começar.';

export interface DepsDitado {
  /** Uma transcrição só do microfone ("Você"). */
  criarStt(chave: string, cb: CallbacksStt): SttSession;
  comandarCaptura(c: ComandoCaptura): void;
  /** O texto ditado até agora: as falas finais e o trecho parcial. */
  enviar(texto: string): void;
}

/** "Responder falando" do treino: uma transcrição do microfone por vez, nunca o som do computador. */
export interface ControleDitado {
  ativo(): boolean;
  /** Conecta a transcrição e só então liga a captura do microfone. Rejeita se não conectar ou se for interrompido. */
  iniciar(chave: string): Promise<void>;
  /** Para a captura e a transcrição e devolve o texto das falas. Sem ditado ativo, não mexe na captura. */
  parar(): Promise<string>;
  /** Fecha o ditado em andamento, se houver, sem esperar (a reunião vai usar o microfone). */
  descartar(): void;
  enviarAudio(pcm: Uint8Array): void;
}

interface Ditado {
  stt: SttSession;
  falas: string[];
}

export function criarControleDitado(deps: DepsDitado): ControleDitado {
  let atual: Ditado | null = null;

  /** Tira o ditado atual de uso e para a captura. Só manda parar se havia ditado. */
  function soltar(): Ditado | null {
    const ditado = atual;
    if (!ditado) return null;
    atual = null;
    deps.comandarCaptura({ acao: 'parar' });
    return ditado;
  }

  function fecharEmSegundoPlano(ditado: Ditado): void {
    ditado.stt.encerrar().catch((erro: unknown) => console.warn('Falha ao encerrar o ditado:', erro));
  }

  return {
    ativo: () => atual !== null,

    async iniciar(chave) {
      const anterior = soltar();
      if (anterior) fecharEmSegundoPlano(anterior);

      const falas: string[] = [];
      let parcial = '';
      const conexao: { status: StatusConexao | null; motivo?: 'chave' | 'cota' } = { status: null };
      const mostrar = (): void => deps.enviar([...falas, parcial].filter((t) => t !== '').join(' '));
      const stt = deps.criarStt(chave, {
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
      });
      const este: Ditado = { stt, falas };
      atual = este;

      await stt.iniciar();
      // Trocado por outro ditado, parado ou descartado enquanto conectava: quem fez isso já fechou esta transcrição.
      if (atual !== este) throw new Error(ERRO_DITADO_INTERROMPIDO);
      if (conexao.status !== 'ok') {
        atual = null;
        await stt.encerrar();
        throw new Error(conexao.motivo ? TEXTO_AVISO[conexao.motivo] : ERRO_CONEXAO_DITADO);
      }
      deps.comandarCaptura({ acao: 'iniciar', quem: ['voce'] });
    },

    async parar() {
      const ditado = soltar();
      if (!ditado) return '';
      // A fala final do trecho em andamento chega durante o encerramento.
      await ditado.stt.encerrar();
      return ditado.falas.join(' ');
    },

    descartar() {
      const ditado = soltar();
      if (ditado) fecharEmSegundoPlano(ditado);
    },

    enviarAudio(pcm) {
      atual?.stt.enviarAudio(pcm);
    },
  };
}
