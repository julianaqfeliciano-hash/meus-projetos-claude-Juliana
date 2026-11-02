import { describe, expect, it, vi } from 'vitest';
import { TEXTO_AVISO } from '../../shared/textos';
import type { StatusConexao } from '../../shared/tipos';
import type { CallbacksStt, SttSession } from '../transcricao/sessao-soniox';
import { criarControleDitado, ERRO_CONEXAO_DITADO, ERRO_DITADO_INTERROMPIDO } from './ditado';

interface SttFalsa extends SttSession {
  cb: CallbacksStt;
  chave: string;
  /** Termina a conexão pendente com o status dado. */
  conectar(status?: StatusConexao, motivo?: 'chave' | 'cota'): void;
}

const fala = (texto: string) => ({ quem: 'voce' as const, texto, idioma: 'pt' as const, em: 0 });

/** `automatico`: cada transcrição nova conecta na hora com esse status; sem ele, o teste chama `conectar`. */
function criarDeps(automatico?: { status: StatusConexao; motivo?: 'chave' | 'cota' }) {
  const sessoes: SttFalsa[] = [];
  const deps = {
    criarStt: vi.fn((chave: string, cb: CallbacksStt): SttSession => {
      let terminar!: () => void;
      const conexao = new Promise<void>((resolve) => {
        terminar = resolve;
      });
      const s: SttFalsa = {
        cb,
        chave,
        conectar(status = 'ok', motivo) {
          cb.aoStatus(status, motivo);
          terminar();
        },
        iniciar: vi.fn(() => {
          if (automatico) s.conectar(automatico.status, automatico.motivo);
          return conexao;
        }),
        enviarAudio: vi.fn(),
        pausar: vi.fn(),
        retomar: vi.fn(),
        encerrar: vi.fn(async () => undefined),
      };
      sessoes.push(s);
      return s;
    }),
    comandarCaptura: vi.fn(),
    enviar: vi.fn(),
  };
  return { deps, sessoes };
}

describe('criarControleDitado', () => {
  it('liga a captura só do microfone depois que a transcrição conecta', async () => {
    const { deps, sessoes } = criarDeps();
    const ditado = criarControleDitado(deps);
    const inicio = ditado.iniciar('chave-soniox');
    expect(deps.criarStt).toHaveBeenCalledTimes(1);
    expect(sessoes[0].chave).toBe('chave-soniox');
    expect(deps.comandarCaptura).not.toHaveBeenCalled();
    sessoes[0].conectar('ok');
    await inicio;
    expect(deps.comandarCaptura).toHaveBeenCalledExactlyOnceWith({ acao: 'iniciar', quem: ['voce'] });
    expect(ditado.ativo()).toBe(true);
  });

  it('mostra o texto ditado e, ao parar, devolve as falas juntadas', async () => {
    const { deps, sessoes } = criarDeps({ status: 'ok' });
    const ditado = criarControleDitado(deps);
    await ditado.iniciar('k');
    const { cb } = sessoes[0];
    cb.aoParcial('olá');
    cb.aoFalar(fala('olá mundo'));
    cb.aoParcial('tudo');
    expect(deps.enviar.mock.calls.map((c) => c[0])).toEqual(['olá', 'olá mundo', 'olá mundo tudo']);

    // A fala final do trecho em andamento chega durante o encerramento.
    vi.mocked(sessoes[0].encerrar).mockImplementationOnce(async () => cb.aoFalar(fala('tudo bem')));
    await expect(ditado.parar()).resolves.toBe('olá mundo tudo bem');
    expect(deps.comandarCaptura).toHaveBeenLastCalledWith({ acao: 'parar' });
    expect(sessoes[0].encerrar).toHaveBeenCalledTimes(1);
    expect(ditado.ativo()).toBe(false);
  });

  it('parar sem ditado ativo não manda parar a captura (que pode ser a da reunião)', async () => {
    const { deps } = criarDeps();
    const ditado = criarControleDitado(deps);
    await expect(ditado.parar()).resolves.toBe('');
    expect(deps.comandarCaptura).not.toHaveBeenCalled();
  });

  it('trocado enquanto conectava: o primeiro rejeita e só o segundo liga a captura', async () => {
    const { deps, sessoes } = criarDeps();
    const ditado = criarControleDitado(deps);
    const primeiro = ditado.iniciar('k');
    const segundo = ditado.iniciar('k');
    expect(sessoes[0].encerrar).toHaveBeenCalledTimes(1);
    sessoes[1].conectar('ok');
    await segundo;
    sessoes[0].conectar('ok');
    await expect(primeiro).rejects.toThrow(ERRO_DITADO_INTERROMPIDO);
    const ligacoes = deps.comandarCaptura.mock.calls.filter(([c]) => c.acao === 'iniciar');
    expect(ligacoes).toHaveLength(1);
    expect(ditado.ativo()).toBe(true);
  });

  it('parado enquanto conectava: rejeita e não liga a captura', async () => {
    const { deps, sessoes } = criarDeps();
    const ditado = criarControleDitado(deps);
    const inicio = ditado.iniciar('k');
    await ditado.parar();
    sessoes[0].conectar('ok');
    await expect(inicio).rejects.toThrow(ERRO_DITADO_INTERROMPIDO);
    expect(deps.comandarCaptura).not.toHaveBeenCalledWith({ acao: 'iniciar', quem: ['voce'] });
  });

  it('chave recusada: rejeita com o aviso de chave, fecha a transcrição e não liga a captura', async () => {
    const { deps, sessoes } = criarDeps({ status: 'erro', motivo: 'chave' });
    const ditado = criarControleDitado(deps);
    await expect(ditado.iniciar('k')).rejects.toThrow(TEXTO_AVISO.chave);
    expect(sessoes[0].encerrar).toHaveBeenCalled();
    expect(deps.comandarCaptura).not.toHaveBeenCalled();
    expect(ditado.ativo()).toBe(false);
  });

  it('sem conseguir conectar: rejeita com a mensagem de conexão', async () => {
    const { deps } = criarDeps({ status: 'reconectando' });
    await expect(criarControleDitado(deps).iniciar('k')).rejects.toThrow(ERRO_CONEXAO_DITADO);
  });

  it('descartar fecha o ditado e para a captura; sem ditado não faz nada', async () => {
    const { deps, sessoes } = criarDeps({ status: 'ok' });
    const ditado = criarControleDitado(deps);
    ditado.descartar();
    expect(deps.comandarCaptura).not.toHaveBeenCalled();
    await ditado.iniciar('k');
    ditado.descartar();
    expect(deps.comandarCaptura).toHaveBeenLastCalledWith({ acao: 'parar' });
    expect(sessoes[0].encerrar).toHaveBeenCalledTimes(1);
    expect(ditado.ativo()).toBe(false);
  });

  it('o áudio vai para a transcrição só com um ditado ativo', async () => {
    const { deps, sessoes } = criarDeps({ status: 'ok' });
    const ditado = criarControleDitado(deps);
    ditado.enviarAudio(new Uint8Array([1]));
    await ditado.iniciar('k');
    ditado.enviarAudio(new Uint8Array([2]));
    await ditado.parar();
    ditado.enviarAudio(new Uint8Array([3]));
    expect(sessoes[0].enviarAudio).toHaveBeenCalledExactlyOnceWith(new Uint8Array([2]));
  });
});
