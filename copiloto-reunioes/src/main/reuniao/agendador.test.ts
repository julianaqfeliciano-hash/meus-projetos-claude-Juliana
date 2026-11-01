import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendadorDetector } from './agendador';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** `executar` que só termina quando o teste chama `terminar()`. */
function execucaoControlada() {
  const terminos: Array<() => void> = [];
  const executar = vi.fn(() => new Promise<void>((resolve) => terminos.push(resolve)));
  const terminar = () => terminos.shift()?.();
  return { executar, terminar };
}

describe('AgendadorDetector', () => {
  it('fim de fala dos outros dispara após 1,5 s', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1499);
    expect(executar).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('novo fim de fala reinicia a espera', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1000);
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1499);
    expect(executar).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('intervalo só dispara com fala nova', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar);
    a.iniciar();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(0);
    a.novaFala();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('fala já vista por uma execução não dispara o intervalo de novo', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.novaFala();
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500);
    expect(executar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('junta disparos durante execução em um só', async () => {
    const { executar, terminar } = execucaoControlada();
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500);
    expect(executar).toHaveBeenCalledTimes(1);

    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500);
    a.novaFala();
    await vi.advanceTimersByTimeAsync(10_000);
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500);
    expect(executar).toHaveBeenCalledTimes(1);

    terminar();
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(2);
    terminar();
    await vi.advanceTimersByTimeAsync(0);
    expect(executar).toHaveBeenCalledTimes(2);
  });

  it('uma execução que falha não trava as próximas', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const executar = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValue(undefined);
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500);
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500);
    expect(executar).toHaveBeenCalledTimes(2);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('desacelerar dobra o intervalo', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.desacelerar(60_000);
    a.novaFala();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('o intervalo volta ao normal quando o prazo de desacelerar passa', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.desacelerar(60_000);
    await vi.advanceTimersByTimeAsync(60_000); // tiques em 20, 40 e 60 s
    a.novaFala();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('respeita as opções de tempo', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar, { intervaloMs: 1000, atrasoFimDeFalaMs: 200 });
    a.iniciar();
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(200);
    expect(executar).toHaveBeenCalledTimes(1);
    a.novaFala();
    await vi.advanceTimersByTimeAsync(1000);
    expect(executar).toHaveBeenCalledTimes(2);
  });

  it('parar cancela tudo, inclusive a execução que estava junta', async () => {
    const { executar, terminar } = execucaoControlada();
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500);
    a.fimDeFalaOutros();
    await vi.advanceTimersByTimeAsync(1500); // fica junta, esperando a 1ª terminar
    a.fimDeFalaOutros(); // espera de 1,5 s em andamento
    a.novaFala();
    a.parar();
    terminar();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(executar).toHaveBeenCalledTimes(1);

    a.fimDeFalaOutros(); // parado: ignora
    await vi.advanceTimersByTimeAsync(1500);
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('volta a funcionar depois de parar e iniciar', async () => {
    const executar = vi.fn(() => Promise.resolve());
    const a = new AgendadorDetector(executar);
    a.iniciar();
    a.parar();
    a.iniciar();
    a.novaFala();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(executar).toHaveBeenCalledTimes(1);
  });
});
