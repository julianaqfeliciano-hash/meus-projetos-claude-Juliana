import { describe, it, expect } from 'vitest';
import { interpretarCartao, MARCADORES } from './interpretar-cartao';

describe('interpretarCartao', () => {
  it('conceito com marcadores', () => {
    expect(interpretarCartao('conceito', 'TÍTULO: Rateio\nEXPLICAÇÃO: Divide custos.\nCOMO EXPLICAR AO CLIENTE: É a divisão.')).toEqual({
      titulo: 'Rateio',
      campos: { explicacao: 'Divide custos.', comoExplicar: 'É a divisão.' },
    });
  });

  it('diga-isso e resposta com marcadores', () => {
    expect(interpretarCartao('diga-isso', 'TÍTULO: Prazo da entrega\nDIGA ISSO: Entregamos em duas semanas.')).toEqual({
      titulo: 'Prazo da entrega',
      campos: { digaIsso: 'Entregamos em duas semanas.' },
    });
    expect(interpretarCartao('resposta', 'TÍTULO: O que é rateio?\nRESPOSTA: Divisão de custos.')).toEqual({
      titulo: 'O que é rateio?',
      campos: { resposta: 'Divisão de custos.' },
    });
  });

  it('marcador incompleto no fim não vaza', () => {
    expect(interpretarCartao('diga-isso', 'TÍTULO: Prazo\nDIGA ISSO: Em duas semanas.\nCOMO EX').campos.digaIsso).toBe('Em duas semanas.');
  });

  it('todo prefixo parcial de marcador no início de uma linha é escondido, sem sumir com o campo anterior', () => {
    for (const marcador of Object.values(MARCADORES)) {
      for (let n = 1; n < marcador.length; n++) {
        const r = interpretarCartao('diga-isso', `TÍTULO: Prazo\nDIGA ISSO: Em duas semanas.\n${marcador.slice(0, n)}`);
        expect(r).toEqual({ titulo: 'Prazo', campos: { digaIsso: 'Em duas semanas.' } });
      }
    }
  });

  it('marcador completo sem valor ainda não cria campo vazio', () => {
    expect(interpretarCartao('diga-isso', 'TÍTULO: Prazo\nDIGA ISSO:')).toEqual({ titulo: 'Prazo', campos: {} });
    expect(interpretarCartao('diga-isso', 'TÍTULO: Prazo\nDIGA ISSO: \n')).toEqual({ titulo: 'Prazo', campos: {} });
  });

  it('valor na linha seguinte ao marcador e com várias linhas', () => {
    expect(interpretarCartao('conceito', 'TÍTULO:\nRateio\nEXPLICAÇÃO:\nDivide custos.\nEntre áreas.\n')).toEqual({
      titulo: 'Rateio',
      campos: { explicacao: 'Divide custos.\nEntre áreas.' },
    });
  });

  it('streaming: cada prefixo do texto completo devolve um estado coerente', () => {
    const completo = 'TÍTULO: Rateio\nEXPLICAÇÃO: Divide custos.\nCOMO EXPLICAR AO CLIENTE: É a divisão.';
    const marcadores = Object.values(MARCADORES);
    for (let n = 0; n <= completo.length; n++) {
      const { titulo, campos } = interpretarCartao('conceito', completo.slice(0, n));
      const valores = [titulo, ...Object.values(campos)].filter((v) => v !== undefined);
      for (const v of valores) {
        expect(v).toBeTruthy();
        for (const m of marcadores) expect(v).not.toContain(m);
        expect(completo).toContain(v);
      }
    }
    expect(interpretarCartao('conceito', completo)).toEqual({
      titulo: 'Rateio',
      campos: { explicacao: 'Divide custos.', comoExplicar: 'É a divisão.' },
    });
  });

  it('marcador só vale no início de uma linha', () => {
    expect(interpretarCartao('diga-isso', 'TÍTULO: Prazo\nDIGA ISSO: Veja o TÍTULO: e a RESPOSTA: do manual.')).toEqual({
      titulo: 'Prazo',
      campos: { digaIsso: 'Veja o TÍTULO: e a RESPOSTA: do manual.' },
    });
  });

  it('maiúsculas e minúsculas contam: "Título:" não é marcador', () => {
    expect(interpretarCartao('conceito', 'Título: Rateio\nExplicação: Divide custos.').campos).toEqual({
      explicacao: 'Título: Rateio\nExplicação: Divide custos.',
    });
  });

  it('o que vem antes do primeiro marcador é ignorado quando há marcadores', () => {
    expect(interpretarCartao('resposta', 'Claro!\nRESPOSTA: Sim.')).toEqual({ campos: { resposta: 'Sim.' } });
  });

  it('só o título: sem campos e sem cair no campo principal', () => {
    expect(interpretarCartao('conceito', 'TÍTULO: Rateio')).toEqual({ titulo: 'Rateio', campos: {} });
  });

  it('texto sem marcadores vai para o campo principal', () => {
    expect(interpretarCartao('conceito', 'Rateio é dividir custos.').campos).toEqual({ explicacao: 'Rateio é dividir custos.' });
    expect(interpretarCartao('diga-isso', '  Fechamos em duas semanas.  ').campos).toEqual({ digaIsso: 'Fechamos em duas semanas.' });
    expect(interpretarCartao('resposta', 'Sim, pode.').campos).toEqual({ resposta: 'Sim, pode.' });
    expect(interpretarCartao('resposta', 'Sim, pode.')).not.toHaveProperty('titulo');
  });

  it('texto vazio, só espaços ou só um pedaço de marcador não gera campo', () => {
    for (const t of ['', '   ', '\n', 'T', 'TÍT', 'TÍTULO', 'DIGA IS', 'R']) {
      expect(interpretarCartao('conceito', t)).toEqual({ campos: {} });
    }
  });

  it('com texto sem marcadores, um pedaço de marcador no fim também é escondido', () => {
    expect(interpretarCartao('conceito', 'Rateio é dividir custos.\nEXPL').campos).toEqual({ explicacao: 'Rateio é dividir custos.' });
  });

  it('repetição do mesmo marcador mantém a primeira', () => {
    expect(interpretarCartao('diga-isso', 'DIGA ISSO: Primeira.\nDIGA ISSO: Segunda.').campos).toEqual({ digaIsso: 'Primeira.' });
  });

  it('aceita quebras de linha do Windows', () => {
    expect(interpretarCartao('conceito', 'TÍTULO: Rateio\r\nEXPLICAÇÃO: Divide custos.\r\n')).toEqual({
      titulo: 'Rateio',
      campos: { explicacao: 'Divide custos.' },
    });
  });
});
