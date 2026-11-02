import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { RecusaIa, TempoEsgotado, classificarErro, mensagemErroIa } from './erros';

describe('classificarErro', () => {
  it('classifica erros do SDK', () => {
    expect(classificarErro(Object.create(Anthropic.AuthenticationError.prototype))).toBe('chave');
    expect(classificarErro(Object.create(Anthropic.PermissionDeniedError.prototype))).toBe('permissao');
    expect(classificarErro(Object.create(Anthropic.RateLimitError.prototype))).toBe('limite');
    expect(classificarErro(Object.create(Anthropic.APIConnectionError.prototype))).toBe('rede');
  });

  it('timeout de conexão do SDK também é erro de rede', () => {
    expect(classificarErro(Object.create(Anthropic.APIConnectionTimeoutError.prototype))).toBe('rede');
  });

  it('classifica os erros próprios', () => {
    expect(classificarErro(new RecusaIa())).toBe('recusa');
    expect(classificarErro(new TempoEsgotado())).toBe('tempo');
  });

  it('qualquer outra coisa é "outro"', () => {
    expect(classificarErro(new Error('x'))).toBe('outro');
    expect(classificarErro(Object.create(Anthropic.InternalServerError.prototype))).toBe('outro');
    expect(classificarErro('texto solto')).toBe('outro');
    expect(classificarErro(undefined)).toBe('outro');
  });

  it('não olha a mensagem: um Error com texto de chave inválida continua "outro"', () => {
    expect(classificarErro(new Error('401 authentication_error invalid x-api-key'))).toBe('outro');
  });
});

describe('erros próprios', () => {
  it('são Error, têm nome e mensagem em português', () => {
    const recusa = new RecusaIa();
    const tempo = new TempoEsgotado();
    expect(recusa).toBeInstanceOf(Error);
    expect(tempo).toBeInstanceOf(Error);
    expect(recusa.name).toBe('RecusaIa');
    expect(tempo.name).toBe('TempoEsgotado');
    expect(recusa.message).toMatch(/recus/i);
    expect(tempo.message).toMatch(/tempo/i);
  });
});

describe('mensagemErroIa', () => {
  it('traduz cada classe de erro para uma mensagem em português', () => {
    const chave = 'Chave da Anthropic inválida ou sem permissão — confira nas Configurações.';
    expect(mensagemErroIa(Object.create(Anthropic.AuthenticationError.prototype))).toBe(chave);
    expect(mensagemErroIa(Object.create(Anthropic.PermissionDeniedError.prototype))).toBe(chave);
    expect(mensagemErroIa(Object.create(Anthropic.RateLimitError.prototype))).toBe(
      'Limite de uso da IA atingido — aguarde um pouco e tente de novo.',
    );
    expect(mensagemErroIa(Object.create(Anthropic.APIConnectionError.prototype))).toBe(
      'Sem conexão com a IA — confira a internet.',
    );
    expect(mensagemErroIa(new TempoEsgotado())).toBe('A IA demorou demais — tente de novo.');
    expect(mensagemErroIa(new RecusaIa())).toBe('A IA não conseguiu responder a este pedido.');
  });

  it('nunca repassa o texto original (inglês ou JSON) do erro', () => {
    expect(mensagemErroIa(new Error('400 {"type":"error","error":{"type":"invalid_request_error"}}'))).toBe(
      'Algo deu errado — tente de novo.',
    );
    expect(mensagemErroIa(new SyntaxError('Unexpected end of JSON input'))).toBe('Algo deu errado — tente de novo.');
  });
});
