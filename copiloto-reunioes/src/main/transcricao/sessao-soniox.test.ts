import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, QuotaError, type SttSessionConfig } from '@soniox/node';
import {
  CONFIG_SONIOX,
  TEMPO_MAX_ENCERRAR_MS,
  criarSessaoSoniox,
  fabricaSoniox,
  type CallbacksStt,
  type SessaoSdk,
} from './sessao-soniox';

const AGORA = 1_700_000_000_000;

interface Opcoes {
  connect?: () => Promise<void>;
  finish?: () => Promise<void>;
  sendAudio?: () => void;
}

/** Sessão falsa do SDK. Como a real, `close()` emite `disconnected('client_closed')` na hora. */
function falsa(opcoes: Opcoes = {}) {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  const emitir = (evento: string, ...args: unknown[]) => {
    for (const fn of handlers[evento] ?? []) fn(...args);
  };
  const mock = {
    connect: vi.fn(opcoes.connect ?? (() => Promise.resolve())),
    sendAudio: vi.fn(opcoes.sendAudio ?? (() => undefined)),
    pause: vi.fn(),
    resume: vi.fn(),
    finish: vi.fn(opcoes.finish ?? (() => Promise.resolve())),
    close: vi.fn(() => emitir('disconnected', 'client_closed')),
    on: vi.fn((evento: string, fn: (...args: unknown[]) => void) => {
      (handlers[evento] ??= []).push(fn);
      return mock;
    }),
  };
  return { mock, sdk: mock as unknown as SessaoSdk, emitir };
}
type Falsa = ReturnType<typeof falsa>;

/** Fábrica que devolve uma sessão falsa nova a cada chamada e guarda todas. */
function criarFabrica(opcoesDa: (indice: number) => Opcoes = () => ({})) {
  const sessoes: Falsa[] = [];
  const fabrica = vi.fn<(c: SttSessionConfig) => SessaoSdk>(() => {
    const sessao = falsa(opcoesDa(sessoes.length));
    sessoes.push(sessao);
    return sessao.sdk;
  });
  return { fabrica, sessoes };
}

function criarCb() {
  return { aoFalar: vi.fn(), aoParcial: vi.fn(), aoFimDeFala: vi.fn(), aoStatus: vi.fn() } satisfies CallbacksStt;
}

const token = (text: string, is_final = true, language = 'pt') => ({ text, is_final, language, confidence: 1 });
const resultado = (...tokens: ReturnType<typeof token>[]) => ({ tokens });
const erroDe = (classe: { prototype: Error }) => Object.create(classe.prototype) as Error;
const rejeita = (erro: unknown) => () => Promise.reject(erro);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('iniciar', () => {
  it('usa a configuração exigida', async () => {
    const cb = criarCb();
    const { fabrica } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    expect(fabrica).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'stt-rt-v5',
        audio_format: 'pcm_s16le',
        sample_rate: 16000,
        num_channels: 1,
        language_hints: ['pt', 'en'],
        enable_language_identification: true,
        enable_endpoint_detection: true,
      }),
    );
    expect(CONFIG_SONIOX).toEqual(fabrica.mock.calls[0]![0]);
    expect(cb.aoStatus).toHaveBeenCalledTimes(1);
    expect(cb.aoStatus).toHaveBeenCalledWith('ok');
  });

  it('só informa ok depois que o connect termina', async () => {
    const cb = criarCb();
    let conectou!: () => void;
    const { fabrica } = criarFabrica(() => ({ connect: () => new Promise<void>((r) => (conectou = r)) }));
    const promessa = criarSessaoSoniox('voce', cb, fabrica).iniciar();
    await vi.advanceTimersByTimeAsync(0);
    expect(cb.aoStatus).not.toHaveBeenCalled();
    conectou();
    await promessa;
    expect(cb.aoStatus).toHaveBeenCalledWith('ok');
  });

  it('chamar iniciar de novo não cria outra sessão', async () => {
    const { fabrica } = criarFabrica();
    const s = criarSessaoSoniox('voce', criarCb(), fabrica);
    await s.iniciar();
    await s.iniciar();
    expect(fabrica).toHaveBeenCalledTimes(1);
  });
});

describe('resultados', () => {
  it('resultado + endpoint viram fala e fim de fala', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('result', resultado(token('Qual o SLA?')));
    expect(cb.aoParcial).toHaveBeenLastCalledWith('Qual o SLA?');
    expect(cb.aoFalar).not.toHaveBeenCalled();
    sessoes[0]!.emitir('endpoint');
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
    expect(cb.aoFalar).toHaveBeenCalledWith({ quem: 'outros', texto: 'Qual o SLA?', idioma: 'pt', em: AGORA });
    expect(cb.aoFimDeFala).toHaveBeenCalledTimes(1);
    expect(cb.aoFalar.mock.invocationCallOrder[0]).toBeLessThan(cb.aoFimDeFala.mock.invocationCallOrder[0]!);
  });

  it('tokens não finais só aparecem no parcial', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('voce', cb, fabrica).iniciar();
    sessoes[0]!.emitir('result', resultado(token('Olá '), token('mun', false)));
    expect(cb.aoParcial).toHaveBeenLastCalledWith('Olá mun');
    sessoes[0]!.emitir('endpoint');
    expect(cb.aoFalar).toHaveBeenCalledWith(expect.objectContaining({ quem: 'voce', texto: 'Olá' }));
  });

  it('endpoint sem texto só avisa o fim de fala', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('voce', cb, fabrica).iniciar();
    sessoes[0]!.emitir('endpoint');
    expect(cb.aoFalar).not.toHaveBeenCalled();
    expect(cb.aoFimDeFala).toHaveBeenCalledTimes(1);
  });

  it('entrega a fala que o acumulador fecha por tempo, sem endpoint', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('result', resultado(token('começo ')));
    vi.setSystemTime(AGORA + 30_000);
    sessoes[0]!.emitir('result', resultado(token('fim')));
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
    expect(cb.aoFalar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'começo fim', em: AGORA + 30_000 }));
    expect(cb.aoFimDeFala).not.toHaveBeenCalled();
  });
});

describe('reconexão', () => {
  it('queda reconecta com espera e volta ao ok', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('disconnected', 'rede caiu');
    expect(cb.aoStatus).toHaveBeenLastCalledWith('reconectando');
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(fabrica).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fabrica).toHaveBeenCalledTimes(2);
    expect(cb.aoStatus.mock.calls).toEqual([['ok'], ['reconectando'], ['ok']]);
  });

  it('error seguido de disconnected da mesma sessão agenda uma só reconexão', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('error', new Error('socket'));
    sessoes[0]!.emitir('disconnected');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(2);
    expect(cb.aoStatus.mock.calls).toEqual([['ok'], ['reconectando'], ['ok']]);
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);
  });

  it('o disconnected que o close() da própria sessão emite é ignorado', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('error', new Error('socket'));
    // o close() da sessão falsa já emitiu disconnected('client_closed') dentro do handler do error
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);
    expect(cb.aoStatus.mock.calls).toEqual([['ok'], ['reconectando']]);
  });

  it('eventos de uma sessão já substituída são ignorados', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fabrica).toHaveBeenCalledTimes(2);
    cb.aoStatus.mockClear();

    sessoes[0]!.emitir('error', new Error('atrasado'));
    sessoes[0]!.emitir('disconnected');
    sessoes[0]!.emitir('result', resultado(token('velho')));
    sessoes[0]!.emitir('endpoint');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(2);
    expect(cb.aoStatus).not.toHaveBeenCalled();
    expect(cb.aoParcial).not.toHaveBeenCalled();
    expect(cb.aoFimDeFala).not.toHaveBeenCalled();
  });

  it('connect que falha à toa entra no ciclo de espera crescente e depois zera a contagem', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica((i) => (i < 2 ? { connect: rejeita(new Error('rede')) } : {}));
    await expect(criarSessaoSoniox('voce', cb, fabrica).iniciar()).resolves.toBeUndefined();
    expect(cb.aoStatus.mock.calls).toEqual([['reconectando']]);
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000); // 2ª tentativa falha
    expect(fabrica).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fabrica).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // 3ª tentativa conecta
    expect(fabrica).toHaveBeenCalledTimes(3);
    expect(cb.aoStatus).toHaveBeenLastCalledWith('ok');

    sessoes[2]!.emitir('disconnected');
    await vi.advanceTimersByTimeAsync(1000); // contagem voltou ao início: 1 s
    expect(fabrica).toHaveBeenCalledTimes(4);
  });

  it('a espera para no teto de 15 s', async () => {
    const { fabrica } = criarFabrica(() => ({ connect: rejeita(new Error('rede')) }));
    await criarSessaoSoniox('voce', criarCb(), fabrica).iniciar();
    for (const espera of [1000, 2000, 4000, 8000, 15_000, 15_000]) {
      const antes = fabrica.mock.calls.length;
      await vi.advanceTimersByTimeAsync(espera - 1);
      expect(fabrica).toHaveBeenCalledTimes(antes);
      await vi.advanceTimersByTimeAsync(1);
      expect(fabrica).toHaveBeenCalledTimes(antes + 1);
    }
  });

  it('fábrica que lança vira reconexão, sem rejeitar o iniciar', async () => {
    const cb = criarCb();
    const sessao = falsa();
    const fabrica = vi
      .fn<(c: SttSessionConfig) => SessaoSdk>()
      .mockImplementationOnce(() => {
        throw new Error('config inválida');
      })
      .mockReturnValue(sessao.sdk);
    await expect(criarSessaoSoniox('voce', cb, fabrica).iniciar()).resolves.toBeUndefined();
    expect(cb.aoStatus.mock.calls).toEqual([['reconectando']]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb.aoStatus.mock.calls).toEqual([['reconectando'], ['ok']]);
  });

  it('um error de outro tipo com a sessão conectada também reconecta', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('voce', cb, fabrica).iniciar();
    sessoes[0]!.emitir('error', new Error('falha de rede'));
    expect(cb.aoStatus).toHaveBeenLastCalledWith('reconectando');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fabrica).toHaveBeenCalledTimes(2);
  });

  it('a fala que ficou no buffer sobrevive à reconexão e fecha no próximo endpoint', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('result', resultado(token('Qual ')));
    sessoes[0]!.emitir('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    sessoes[1]!.emitir('result', resultado(token('o prazo?')));
    sessoes[1]!.emitir('endpoint');
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
    expect(cb.aoFalar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'Qual o prazo?' }));
  });
});

describe('erros de chave e de cota', () => {
  it('chave inválida não reconecta', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica(() => ({ connect: rejeita(erroDe(AuthError)) }));
    await criarSessaoSoniox('voce', cb, fabrica).iniciar();
    expect(cb.aoStatus.mock.calls).toEqual([['erro', 'chave']]);
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(1);
    expect(cb.aoStatus).toHaveBeenCalledTimes(1);
  });

  it('cota esgotada no connect não reconecta', async () => {
    const cb = criarCb();
    const { fabrica } = criarFabrica(() => ({ connect: rejeita(erroDe(QuotaError)) }));
    await criarSessaoSoniox('voce', cb, fabrica).iniciar();
    expect(cb.aoStatus.mock.calls).toEqual([['erro', 'cota']]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['AuthError', AuthError, 'chave'],
    ['QuotaError', QuotaError, 'cota'],
  ] as const)('%s no evento error não reconecta', async (_nome, classe, motivo) => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    await criarSessaoSoniox('outros', cb, fabrica).iniciar();
    sessoes[0]!.emitir('error', erroDe(classe));
    sessoes[0]!.emitir('disconnected'); // o SDK costuma emitir os dois
    expect(cb.aoStatus.mock.calls).toEqual([['ok'], ['erro', motivo]]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(1);
  });

  it('chave inválida numa tentativa de reconexão para o ciclo', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica((i) => (i === 1 ? { connect: rejeita(erroDe(AuthError)) } : {}));
    await criarSessaoSoniox('voce', cb, fabrica).iniciar();
    sessoes[0]!.emitir('disconnected');
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb.aoStatus.mock.calls).toEqual([['ok'], ['reconectando'], ['erro', 'chave']]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(2);
  });
});

describe('enviarAudio', () => {
  const pcm = new Uint8Array(2);

  it('repassa o áudio ao SDK quando conectado', async () => {
    const { fabrica, sessoes } = criarFabrica();
    const s = criarSessaoSoniox('voce', criarCb(), fabrica);
    await s.iniciar();
    s.enviarAudio(pcm);
    expect(sessoes[0]!.mock.sendAudio).toHaveBeenCalledWith(pcm);
  });

  it('áudio antes de iniciar é descartado', () => {
    const { fabrica } = criarFabrica();
    const s = criarSessaoSoniox('voce', criarCb(), fabrica);
    expect(() => s.enviarAudio(pcm)).not.toThrow();
    expect(fabrica).not.toHaveBeenCalled();
  });

  it('áudio enquanto o connect não terminou é descartado', async () => {
    const { fabrica, sessoes } = criarFabrica(() => ({ connect: () => new Promise<void>(() => undefined) }));
    const s = criarSessaoSoniox('voce', criarCb(), fabrica);
    void s.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    s.enviarAudio(pcm);
    expect(sessoes[0]!.mock.sendAudio).not.toHaveBeenCalled();
  });

  it('áudio pausado é descartado e volta a passar depois de retomar', async () => {
    const sdk = falsa();
    const s = criarSessaoSoniox('voce', criarCb(), () => sdk.sdk);
    await s.iniciar();
    s.pausar();
    s.enviarAudio(pcm);
    expect(sdk.mock.sendAudio).not.toHaveBeenCalled();
    s.retomar();
    s.enviarAudio(pcm);
    expect(sdk.mock.sendAudio).toHaveBeenCalledTimes(1);
  });

  it('áudio durante a reconexão é descartado', async () => {
    const { fabrica, sessoes } = criarFabrica();
    const s = criarSessaoSoniox('voce', criarCb(), fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('disconnected');
    s.enviarAudio(pcm);
    expect(sessoes[0]!.mock.sendAudio).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    s.enviarAudio(pcm);
    expect(sessoes[0]!.mock.sendAudio).not.toHaveBeenCalled();
    expect(sessoes[1]!.mock.sendAudio).toHaveBeenCalledWith(pcm);
  });

  it('áudio depois de encerrar é descartado', async () => {
    const sdk = falsa();
    const s = criarSessaoSoniox('voce', criarCb(), () => sdk.sdk);
    await s.iniciar();
    await s.encerrar();
    s.enviarAudio(pcm);
    expect(sdk.mock.sendAudio).not.toHaveBeenCalled();
  });

  it('nunca lança, mesmo que o sendAudio do SDK lance', async () => {
    const sdk = falsa({
      sendAudio: () => {
        throw new Error('Cannot send audio: session is in "closed" state');
      },
    });
    const s = criarSessaoSoniox('voce', criarCb(), () => sdk.sdk);
    await s.iniciar();
    expect(() => s.enviarAudio(pcm)).not.toThrow();
    expect(sdk.mock.sendAudio).toHaveBeenCalledTimes(1);
  });
});

describe('pausar e retomar', () => {
  it('repassam ao SDK', async () => {
    const sdk = falsa();
    const s = criarSessaoSoniox('voce', criarCb(), () => sdk.sdk);
    await s.iniciar();
    s.pausar();
    expect(sdk.mock.pause).toHaveBeenCalledTimes(1);
    s.retomar();
    expect(sdk.mock.resume).toHaveBeenCalledTimes(1);
  });

  it('pausa pedida durante a reconexão vale para a sessão nova', async () => {
    const { fabrica, sessoes } = criarFabrica();
    const s = criarSessaoSoniox('voce', criarCb(), fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('disconnected');
    s.pausar();
    expect(sessoes[0]!.mock.pause).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sessoes[1]!.mock.pause).toHaveBeenCalledTimes(1);
    s.enviarAudio(new Uint8Array(2));
    expect(sessoes[1]!.mock.sendAudio).not.toHaveBeenCalled();
  });

  it('pausar e retomar depois de encerrar não tocam o SDK', async () => {
    const sdk = falsa();
    const s = criarSessaoSoniox('voce', criarCb(), () => sdk.sdk);
    await s.iniciar();
    await s.encerrar();
    s.pausar();
    s.retomar();
    expect(sdk.mock.pause).not.toHaveBeenCalled();
    expect(sdk.mock.resume).not.toHaveBeenCalled();
  });
});

describe('encerrar', () => {
  it('entrega a fala pendente e não reconecta', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('result', resultado(token('Combinado, fechamos.')));
    await s.encerrar();
    sessoes[0]!.emitir('disconnected');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
    expect(cb.aoFalar).toHaveBeenCalledWith({ quem: 'outros', texto: 'Combinado, fechamos.', idioma: 'pt', em: AGORA });
    expect(fabrica).toHaveBeenCalledTimes(1);
    expect(sessoes[0]!.mock.finish).toHaveBeenCalledTimes(1);
  });

  it('sem texto pendente não chama aoFalar', async () => {
    const cb = criarCb();
    const { fabrica } = criarFabrica();
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    await s.encerrar();
    expect(cb.aoFalar).not.toHaveBeenCalled();
  });

  it('ignora o erro do finish e ainda entrega a fala', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica(() => ({ finish: rejeita(new Error('socket fechado')) }));
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('result', resultado(token('Até logo.')));
    await expect(s.encerrar()).resolves.toBeUndefined();
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
  });

  it('é idempotente', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('result', resultado(token('Uma vez só.')));
    const primeira = s.encerrar();
    const segunda = s.encerrar();
    await Promise.all([primeira, segunda]);
    await s.encerrar();
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
    expect(sessoes[0]!.mock.finish).toHaveBeenCalledTimes(1);
  });

  it('depois de encerrar nenhum evento chama os callbacks', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    await s.encerrar();
    cb.aoStatus.mockClear();
    sessoes[0]!.emitir('result', resultado(token('fantasma')));
    sessoes[0]!.emitir('endpoint');
    sessoes[0]!.emitir('error', new Error('x'));
    sessoes[0]!.emitir('disconnected');
    expect(cb.aoParcial).not.toHaveBeenCalled();
    expect(cb.aoFalar).not.toHaveBeenCalled();
    expect(cb.aoFimDeFala).not.toHaveBeenCalled();
    expect(cb.aoStatus).not.toHaveBeenCalled();
  });

  it('cancela a reconexão agendada', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica();
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('disconnected');
    await s.encerrar();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(1);
    expect(cb.aoStatus.mock.calls).toEqual([['ok'], ['reconectando']]);
  });

  it('encerrar com o connect ainda pendente não informa ok depois', async () => {
    const cb = criarCb();
    let conectou!: () => void;
    const { fabrica, sessoes } = criarFabrica(() => ({ connect: () => new Promise<void>((r) => (conectou = r)) }));
    const s = criarSessaoSoniox('voce', cb, fabrica);
    const inicio = s.iniciar();
    await vi.advanceTimersByTimeAsync(0);
    await s.encerrar();
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);
    conectou();
    await inicio;
    expect(cb.aoStatus).not.toHaveBeenCalled();
    s.enviarAudio(new Uint8Array(2));
    expect(sessoes[0]!.mock.sendAudio).not.toHaveBeenCalled();
  });

  it('encerrar sem ter iniciado não faz nada e impede iniciar depois', async () => {
    const cb = criarCb();
    const { fabrica } = criarFabrica();
    const s = criarSessaoSoniox('voce', cb, fabrica);
    await s.encerrar();
    await s.iniciar();
    expect(fabrica).not.toHaveBeenCalled();
    expect(cb.aoStatus).not.toHaveBeenCalled();
    expect(cb.aoFalar).not.toHaveBeenCalled();
  });

  it('o texto que o finish() libera ainda entra na fala final, sem chamar aoParcial', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica((i) => ({
      finish: () => {
        sessoes[i]!.emitir('result', resultado(token('e fechamos.')));
        sessoes[i]!.emitir('endpoint');
        return Promise.resolve();
      },
    }));
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('result', resultado(token('Então '), token('esse', false)));
    cb.aoParcial.mockClear();
    await s.encerrar();
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
    expect(cb.aoFalar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'Então e fechamos.' }));
    expect(cb.aoParcial).not.toHaveBeenCalled();
    expect(cb.aoFimDeFala).not.toHaveBeenCalled();
  });

  it('queda durante o finish() não dispara reconexão', async () => {
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica((i) => ({
      finish: () => {
        sessoes[i]!.emitir('error', new Error('fechou antes de terminar'));
        sessoes[i]!.emitir('disconnected');
        return Promise.reject(new Error('fechou antes de terminar'));
      },
    }));
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    await s.encerrar();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fabrica).toHaveBeenCalledTimes(1);
    expect(cb.aoStatus.mock.calls).toEqual([['ok']]);
  });

  it('não espera o finish() para sempre: após o tempo máximo entrega a fala e fecha a sessão', async () => {
    expect(TEMPO_MAX_ENCERRAR_MS).toBe(5000);
    const cb = criarCb();
    const { fabrica, sessoes } = criarFabrica(() => ({ finish: () => new Promise<void>(() => undefined) }));
    const s = criarSessaoSoniox('outros', cb, fabrica);
    await s.iniciar();
    sessoes[0]!.emitir('result', resultado(token('Última frase.')));

    let terminou = false;
    const encerrando = s.encerrar().then(() => (terminou = true));
    await vi.advanceTimersByTimeAsync(TEMPO_MAX_ENCERRAR_MS - 1);
    expect(terminou).toBe(false);
    expect(cb.aoFalar).not.toHaveBeenCalled();
    expect(sessoes[0]!.mock.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await encerrando;
    expect(terminou).toBe(true);
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
    expect(cb.aoFalar).toHaveBeenCalledWith(expect.objectContaining({ texto: 'Última frase.' }));
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);

    // um segundo encerrar() devolve o mesmo resultado, sem entregar de novo
    await s.encerrar();
    expect(cb.aoFalar).toHaveBeenCalledTimes(1);
  });

  it('o finish() que termina a tempo não deixa temporizador pendente', async () => {
    const { fabrica } = criarFabrica();
    const s = criarSessaoSoniox('outros', criarCb(), fabrica);
    await s.iniciar();
    await s.encerrar();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fecha a sessão do SDK ao terminar, mesmo que o finish tenha falhado', async () => {
    const { fabrica, sessoes } = criarFabrica(() => ({ finish: rejeita(new Error('x')) }));
    const s = criarSessaoSoniox('outros', criarCb(), fabrica);
    await s.iniciar();
    await s.encerrar();
    expect(sessoes[0]!.mock.close).toHaveBeenCalledTimes(1);
  });
});

describe('fabricaSoniox', () => {
  it('cria sessões do SDK sem abrir conexão', () => {
    const sessao = fabricaSoniox('chave-de-teste')(CONFIG_SONIOX);
    for (const metodo of ['connect', 'sendAudio', 'pause', 'resume', 'finish', 'close', 'on'] as const) {
      expect(typeof sessao[metodo]).toBe('function');
    }
  });
});
