import { describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { verificarChaveAnthropic, verificarChaveSoniox } from './chaves-verificacao';
import { MODELO_DETECTOR } from './modelos';

const anthropic = (retrieve: () => Promise<unknown>) =>
  ({ models: { retrieve: vi.fn(retrieve) } }) as unknown as Pick<Anthropic, 'models'> & {
    models: { retrieve: ReturnType<typeof vi.fn> };
  };
const soniox = (list: () => Promise<unknown>) => ({ models: { list: vi.fn(list) } });
const erroHttp = (statusCode: number | undefined) => Object.assign(new Error('http'), { statusCode });

describe('verificarChaveAnthropic', () => {
  it('ok quando o modelo do detector é encontrado', async () => {
    const cliente = anthropic(() => Promise.resolve({}));
    expect(await verificarChaveAnthropic(cliente)).toBe('ok');
    expect(cliente.models.retrieve).toHaveBeenCalledWith(MODELO_DETECTOR);
  });

  it('inválida com AuthenticationError', async () => {
    const cliente = anthropic(() => Promise.reject(Object.create(Anthropic.AuthenticationError.prototype)));
    expect(await verificarChaveAnthropic(cliente)).toBe('invalida');
  });

  it('inválida com PermissionDeniedError', async () => {
    const cliente = anthropic(() => Promise.reject(Object.create(Anthropic.PermissionDeniedError.prototype)));
    expect(await verificarChaveAnthropic(cliente)).toBe('invalida');
  });

  it('erro de rede, limite ou qualquer outro erro não invalida a chave', async () => {
    for (const erro of [
      Object.create(Anthropic.APIConnectionError.prototype),
      Object.create(Anthropic.RateLimitError.prototype),
      new Error('x'),
    ]) {
      expect(await verificarChaveAnthropic(anthropic(() => Promise.reject(erro)))).toBe('erro-rede');
    }
  });
});

describe('verificarChaveSoniox', () => {
  it('ok quando a lista de modelos vem', async () => {
    expect(await verificarChaveSoniox(soniox(() => Promise.resolve({ models: [] })))).toBe('ok');
  });

  it('inválida com 401 ou 403', async () => {
    expect(await verificarChaveSoniox(soniox(() => Promise.reject(erroHttp(401))))).toBe('invalida');
    expect(await verificarChaveSoniox(soniox(() => Promise.reject(erroHttp(403))))).toBe('invalida');
  });

  it('outros status, erro sem status e valores que não são Error viram erro-rede', async () => {
    expect(await verificarChaveSoniox(soniox(() => Promise.reject(erroHttp(500))))).toBe('erro-rede');
    expect(await verificarChaveSoniox(soniox(() => Promise.reject(erroHttp(undefined))))).toBe('erro-rede');
    expect(await verificarChaveSoniox(soniox(() => Promise.reject(new Error('offline'))))).toBe('erro-rede');
    expect(await verificarChaveSoniox(soniox(() => Promise.reject('texto')))).toBe('erro-rede');
    expect(await verificarChaveSoniox(soniox(() => Promise.reject(null)))).toBe('erro-rede');
  });
});
