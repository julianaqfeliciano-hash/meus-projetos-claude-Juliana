import { describe, expect, it } from 'vitest';
import { ATALHOS_PADRAO } from '../config/atalhos';
import { PREFERENCIAS_PADRAO } from '../config/preferencias';
import {
  ERRO_PEDIDO,
  lerChavesDaTela,
  lerConfigTreino,
  lerPedidoReuniao,
  lerPreferenciasDaTela,
  lerRespostas,
  paraBytes,
} from './entrada';

const avaliacao = { foiBem: ['clareza'], faltou: [], respostaMelhorada: 'Melhor.', dicasIngles: [] };
const cfg = { vaga: 'Analista', curriculo: '', idioma: 'pt', tipo: 'mista', quantidade: 5 };

describe('lerPreferenciasDaTela', () => {
  it('aceita as preferências e devolve só os campos da tela, com os atalhos normalizados', () => {
    const lidas = lerPreferenciasDaTela({
      ...PREFERENCIAS_PADRAO,
      atalhos: { ...ATALHOS_PADRAO, explicar: 'alt+ctrl+y' },
      extra: 'ignorado',
    });
    expect(lidas.atalhos.explicar).toBe('Control+Alt+Y');
    expect(lidas).not.toHaveProperty('extra');
    expect(lidas).not.toHaveProperty('painel');
    expect(lidas).not.toHaveProperty('ultimosArquivos');
  });

  it('recusa opacidade fora de 0,6 a 1, atalho faltando ou campo de outro tipo', () => {
    expect(() => lerPreferenciasDaTela({ ...PREFERENCIAS_PADRAO, opacidadePainel: 0.5 })).toThrow(ERRO_PEDIDO);
    expect(() => lerPreferenciasDaTela({ ...PREFERENCIAS_PADRAO, opacidadePainel: Number.NaN })).toThrow(ERRO_PEDIDO);
    const semPausar: Record<string, string> = { ...ATALHOS_PADRAO };
    delete semPausar.pausar;
    expect(() => lerPreferenciasDaTela({ ...PREFERENCIAS_PADRAO, atalhos: semPausar })).toThrow(ERRO_PEDIDO);
    expect(() => lerPreferenciasDaTela({ ...PREFERENCIAS_PADRAO, sobreVoce: 3 })).toThrow(ERRO_PEDIDO);
    expect(() => lerPreferenciasDaTela(null)).toThrow(ERRO_PEDIDO);
  });
});

describe('lerPedidoReuniao', () => {
  it('aceita um pedido válido', () => {
    const pedido = { caminhos: ['a.pdf'], contexto: 'x', idioma: 'auto', modo: 'ensaio' };
    expect(lerPedidoReuniao(pedido)).toEqual(pedido);
  });

  it('recusa modo, idioma ou caminhos inválidos', () => {
    const base = { caminhos: [], contexto: '', idioma: 'pt', modo: 'audio' };
    expect(() => lerPedidoReuniao({ ...base, modo: 'video' })).toThrow(ERRO_PEDIDO);
    expect(() => lerPedidoReuniao({ ...base, idioma: 'es' })).toThrow(ERRO_PEDIDO);
    expect(() => lerPedidoReuniao({ ...base, caminhos: [1] })).toThrow(ERRO_PEDIDO);
  });
});

describe('lerConfigTreino e lerRespostas', () => {
  it('aceita configuração e respostas válidas', () => {
    expect(lerConfigTreino(cfg)).toEqual(cfg);
    expect(lerRespostas([{ pergunta: 'P?', resposta: 'R', avaliacao }])).toEqual([
      { pergunta: 'P?', resposta: 'R', avaliacao },
    ]);
  });

  it('recusa quantidade fora de 5, 8 ou 10 e avaliação malformada', () => {
    expect(() => lerConfigTreino({ ...cfg, quantidade: 7 })).toThrow(ERRO_PEDIDO);
    expect(() => lerRespostas([{ pergunta: 'P?', resposta: 'R', avaliacao: { ...avaliacao, foiBem: 'tudo' } }])).toThrow(
      ERRO_PEDIDO,
    );
    expect(() => lerRespostas('nada')).toThrow(ERRO_PEDIDO);
  });
});

describe('lerChavesDaTela', () => {
  it('apara as chaves e ignora as vazias ou ausentes', () => {
    expect(lerChavesDaTela({ anthropic: '  sk-1\n', soniox: '   ' })).toEqual({ anthropic: 'sk-1' });
    expect(lerChavesDaTela({})).toEqual({});
  });

  it('recusa chave que não é texto', () => {
    expect(() => lerChavesDaTela({ anthropic: 42 })).toThrow(ERRO_PEDIDO);
    expect(() => lerChavesDaTela('sk')).toThrow(ERRO_PEDIDO);
  });
});

describe('paraBytes', () => {
  it('aceita ArrayBuffer e visões, e recusa o resto', () => {
    expect(paraBytes(new Uint8Array([1, 2]).buffer)).toEqual(new Uint8Array([1, 2]));
    const visao = new Uint8Array([9, 1, 2, 9]).subarray(1, 3);
    expect(paraBytes(visao)).toEqual(new Uint8Array([1, 2]));
    expect(paraBytes('pcm')).toBeNull();
    expect(paraBytes([1, 2])).toBeNull();
  });
});
