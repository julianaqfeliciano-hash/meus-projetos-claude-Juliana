import { afterEach, beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ConteudoCartao,
  ContextoReuniao,
  Fala,
  ItemDetectado,
  Quem,
  ResumoReuniao,
  TipoCartao,
} from '../../shared/tipos';
import { TEXTO_AVISO } from '../../shared/textos';
import type { CallbacksStt, SttSession } from '../transcricao/sessao-soniox';
import type { Detector } from '../ia/detector';
import type { Explicador, PedidoCartao } from '../ia/explicador';
import type { Resumidor } from '../ia/resumo';
import { RecusaIa } from '../ia/erros';
import { AgendadorDetector } from './agendador';
import { criarSessaoReuniao, type DepsReuniao, type SessaoReuniao } from './sessao-reuniao';

const INICIO = new Date('2026-11-01T13:00:00.000Z');
const ERRO_PADRAO = 'não consegui agora — aperte Ctrl+Alt+Espaço para tentar de novo';
const MIN = 60_000;

const ctx: ContextoReuniao = {
  documentos: [
    { caminho: 'C:\\docs\\Manual.pdf', nome: 'Manual.pdf', tipo: 'pdf', aviso: null, partes: [{ rotulo: 'p. 1', texto: 'x' }] },
  ],
  contexto: 'Cliente hospital',
  sobreVoce: 'Consultora',
  idioma: 'auto',
};

const resumoFalso: ResumoReuniao = {
  assuntos: ['Implantação'],
  duvidasCliente: [],
  decisoes: [],
  pendencias: [],
  proximosPassos: [],
};

const pergunta = (texto: string): ItemDetectado => ({ tipo: 'pergunta', texto, idioma: 'pt' });
const conceito = (texto: string): ItemDetectado => ({ tipo: 'conceito', texto, idioma: 'pt' });
/** Conteúdo válido para qualquer tipo de cartão, sem título (o cartão fica com o alvo). */
const conteudoValido = (): ConteudoCartao => ({ campos: { digaIsso: 'x', explicacao: 'x', resposta: 'x' }, fontes: [] });
const erroDe = (classe: { prototype: Error }) => Object.create(classe.prototype) as Error;

/** Promessa que o teste resolve quando quiser. */
function adiada<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promessa, resolver };
}

function sttFalsa() {
  return {
    iniciar: vi.fn(() => Promise.resolve()),
    enviarAudio: vi.fn(),
    pausar: vi.fn(),
    retomar: vi.fn(),
    encerrar: vi.fn(() => Promise.resolve()),
  } satisfies SttSession;
}

let detector: { detectar: Mock<Detector['detectar']> };
let explicador: { preaquecer: Mock<Explicador['preaquecer']>; explicar: Mock<Explicador['explicar']> };
let resumidor: { resumir: Mock<Resumidor['resumir']> };
let stts: Map<Quem, ReturnType<typeof sttFalsa>>;
let cbs: Map<Quem, CallbacksStt>;
let deps: DepsReuniao & {
  criarStt: Mock<DepsReuniao['criarStt']>;
  publicar: Mock<DepsReuniao['publicar']>;
  salvar: Mock<DepsReuniao['salvar']>;
};
let aviso: MockInstance<typeof console.warn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(INICIO);
  aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  detector = { detectar: vi.fn<Detector['detectar']>().mockResolvedValue([]) };
  explicador = {
    preaquecer: vi.fn<Explicador['preaquecer']>().mockResolvedValue(undefined),
    explicar: vi.fn<Explicador['explicar']>().mockResolvedValue(conteudoValido()),
  };
  resumidor = { resumir: vi.fn<Resumidor['resumir']>().mockResolvedValue(resumoFalso) };
  stts = new Map();
  cbs = new Map();
  let ids = 0;
  deps = {
    criarStt: vi.fn<DepsReuniao['criarStt']>((quem, cb) => {
      const s = sttFalsa();
      stts.set(quem, s);
      cbs.set(quem, cb);
      return s;
    }),
    detector,
    explicador,
    resumidor,
    publicar: vi.fn<DepsReuniao['publicar']>(),
    salvar: vi.fn<DepsReuniao['salvar']>().mockResolvedValue(undefined),
    gerarId: () => `id-${++ids}`,
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function iniciada(modo: 'audio' | 'ensaio' = 'ensaio'): Promise<SessaoReuniao> {
  const s = criarSessaoReuniao(deps, { modo, contexto: ctx });
  await s.iniciar();
  return s;
}

/** Fala do STT falso de `quem`, com o horário atual. */
function falaStt(quem: Quem, texto: string): void {
  const f: Fala = { quem, texto, idioma: 'pt', em: Date.now() };
  cbs.get(quem)!.aoFalar(f);
}

const pedido = (n: number): PedidoCartao => explicador.explicar.mock.calls[n][0];
const tiposAvisos = (s: SessaoReuniao) => s.instantaneo().avisos.map((a) => a.tipo);

describe('início e estados', () => {
  it('modo áudio cria as duas sessões e preaquece', async () => {
    const s = criarSessaoReuniao(deps, { modo: 'audio', contexto: ctx });
    expect(s.instantaneo().estado).toBe('preparando');
    await s.iniciar();
    expect(deps.criarStt).toHaveBeenCalledTimes(2);
    expect(deps.criarStt.mock.calls.map((c) => c[0]).sort()).toEqual(['outros', 'voce']);
    expect(stts.get('voce')!.iniciar).toHaveBeenCalledTimes(1);
    expect(stts.get('outros')!.iniciar).toHaveBeenCalledTimes(1);
    expect(explicador.preaquecer).toHaveBeenCalled();
    expect(s.instantaneo().estado).toBe('ouvindo');
    expect(s.instantaneo().modo).toBe('audio');
  });

  it('não espera o pré-aquecimento terminar', async () => {
    explicador.preaquecer.mockReturnValue(new Promise(() => undefined));
    const s = await iniciada('ensaio');
    expect(s.instantaneo().estado).toBe('ouvindo');
  });

  it('modo ensaio não cria sessões de transcrição', async () => {
    await iniciada('ensaio');
    expect(deps.criarStt).not.toHaveBeenCalled();
  });

  it('alternarPausa repassa às sessões e ao agendador', async () => {
    const s = await iniciada('audio');
    s.alternarPausa();
    expect(s.instantaneo().estado).toBe('pausado');
    expect(stts.get('voce')!.pausar).toHaveBeenCalledTimes(1);
    expect(stts.get('outros')!.pausar).toHaveBeenCalledTimes(1);

    falaStt('outros', 'Fala que chegou depois da pausa');
    cbs.get('outros')!.aoFimDeFala();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(detector.detectar).not.toHaveBeenCalled();

    s.alternarPausa();
    expect(s.instantaneo().estado).toBe('ouvindo');
    expect(stts.get('voce')!.retomar).toHaveBeenCalledTimes(1);
    expect(stts.get('outros')!.retomar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(detector.detectar).toHaveBeenCalledTimes(1);
  });

  it('receberAudio só repassa em ouvindo', async () => {
    const s = await iniciada('audio');
    const pcm = new Uint8Array([1, 2]);
    s.receberAudio('outros', pcm);
    expect(stts.get('outros')!.enviarAudio).toHaveBeenCalledWith(pcm);
    expect(stts.get('voce')!.enviarAudio).not.toHaveBeenCalled();
    s.alternarPausa();
    s.receberAudio('outros', pcm);
    expect(stts.get('outros')!.enviarAudio).toHaveBeenCalledTimes(1);
  });
});

describe('falas e transcrição', () => {
  it('aoFalar e aoParcial atualizam o instantâneo; fim de fala limpa o parcial', async () => {
    const s = await iniciada('audio');
    cbs.get('outros')!.aoParcial('Qual o');
    expect(s.instantaneo().parciais).toEqual({ voce: '', outros: 'Qual o' });
    falaStt('outros', 'Qual o prazo?');
    cbs.get('outros')!.aoFimDeFala();
    expect(s.instantaneo().parciais.outros).toBe('');
    expect(s.instantaneo().transcricao).toEqual([{ quem: 'outros', texto: 'Qual o prazo?', idioma: 'pt', em: Date.now() }]);
  });

  it('fim de fala dos outros chama o detector com os últimos 3 min e os itens cobertos', async () => {
    const s = await iniciada('ensaio');
    s.falaEnsaio('voce', 'Bom dia');
    await vi.advanceTimersByTimeAsync(3.5 * MIN);
    detector.detectar.mockClear();
    s.falaEnsaio('outros', 'Qual o prazo?');
    await vi.advanceTimersByTimeAsync(1499);
    expect(detector.detectar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(detector.detectar).toHaveBeenCalledWith(
      [{ quem: 'outros', texto: 'Qual o prazo?', idioma: 'pt', em: Date.now() - 1500 }],
      [],
    );
  });

  it('fim de fala de "Você" não chama o detector', async () => {
    await iniciada('audio');
    falaStt('voce', 'Oi');
    cbs.get('voce')!.aoFimDeFala();
    await vi.advanceTimersByTimeAsync(1500);
    expect(detector.detectar).not.toHaveBeenCalled();
  });

  it('falaEnsaio vazia ou fora de ouvindo é ignorada', async () => {
    const s = await iniciada('ensaio');
    s.falaEnsaio('outros', '   ');
    s.alternarPausa();
    s.falaEnsaio('outros', 'Qual o prazo?');
    expect(s.instantaneo().transcricao).toEqual([]);
  });
});

describe('cartões automáticos', () => {
  it('pergunta detectada vira cartão diga-isso pronto', async () => {
    const s = await iniciada('ensaio');
    detector.detectar.mockResolvedValue([{ tipo: 'pergunta', texto: 'Qual o prazo?', idioma: 'pt' }]);
    explicador.explicar.mockImplementation(async (_p, cb) => {
      cb({ campos: { digaIsso: 'Em duas' }, fontes: [] });
      return { titulo: 'Prazo', campos: { digaIsso: 'Em duas semanas.' }, fontes: [] };
    });
    s.falaEnsaio('outros', 'Qual o prazo?');
    await vi.advanceTimersByTimeAsync(1500);
    expect(s.instantaneo().cartoes[0]).toMatchObject({
      tipo: 'diga-isso',
      estado: 'pronto',
      titulo: 'Prazo',
      origem: 'automatico',
      campos: { digaIsso: 'Em duas semanas.' },
    });
    expect(pedido(0)).toMatchObject({ tipo: 'diga-isso', alvo: 'Qual o prazo?' });
  });

  it('nasce escrevendo com o alvo e mescla campos, fontes e título', async () => {
    const s = await iniciada('ensaio');
    detector.detectar.mockResolvedValue([conceito('Rateio')]);
    const fim = adiada<ConteudoCartao>();
    let atualizar!: (c: ConteudoCartao) => void;
    explicador.explicar.mockImplementation((_p, cb) => {
      atualizar = cb;
      return fim.promessa;
    });
    s.falaEnsaio('outros', 'Fazemos rateio.');
    await vi.advanceTimersByTimeAsync(1500);
    expect(s.instantaneo().cartoes[0]).toMatchObject({
      tipo: 'conceito',
      titulo: 'Rateio',
      estado: 'escrevendo',
      campos: {},
      fontes: [],
      criadoEm: Date.now(),
    });

    atualizar({ campos: { explicacao: 'Divide' }, fontes: [] });
    expect(s.instantaneo().cartoes[0]).toMatchObject({ titulo: 'Rateio', campos: { explicacao: 'Divide' } });
    const fonte = { arquivo: 'Manual.pdf', local: 'p. 1' };
    atualizar({ titulo: 'Rateio de custos', campos: { explicacao: 'Divide custos.', comoExplicar: 'É' }, fontes: [fonte] });
    expect(s.instantaneo().cartoes[0]).toMatchObject({
      titulo: 'Rateio de custos',
      estado: 'escrevendo',
      campos: { explicacao: 'Divide custos.', comoExplicar: 'É' },
      fontes: [fonte],
    });

    fim.resolver({ campos: { explicacao: 'Divide custos.', comoExplicar: 'É simples.' }, fontes: [fonte] });
    await vi.advanceTimersByTimeAsync(0);
    expect(s.instantaneo().cartoes[0]).toMatchObject({
      titulo: 'Rateio de custos',
      estado: 'pronto',
      campos: { explicacao: 'Divide custos.', comoExplicar: 'É simples.' },
    });
  });

  it('não repete conceito já coberto', async () => {
    const s = await iniciada('ensaio');
    detector.detectar.mockResolvedValueOnce([conceito('APIs REST')]).mockResolvedValueOnce([conceito('api rest')]);
    s.falaEnsaio('outros', 'Usamos APIs REST.');
    await vi.advanceTimersByTimeAsync(1500);
    s.falaEnsaio('outros', 'A api rest é antiga.');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(detector.detectar).toHaveBeenCalledTimes(2);
    expect(detector.detectar.mock.calls[1][1]).toEqual(['api rest']);
    expect(explicador.explicar).toHaveBeenCalledTimes(1);
  });

  it('no máximo 1 cartão automático a cada 8 s', async () => {
    const s = await iniciada('ensaio');
    detector.detectar.mockResolvedValueOnce([conceito('Rateio'), conceito('NF-e')]);
    s.falaEnsaio('outros', 'Rateio e NF-e.');
    await vi.advanceTimersByTimeAsync(1500);
    expect(s.instantaneo().cartoes.map((c) => c.titulo)).toEqual(['Rateio']);
    await vi.advanceTimersByTimeAsync(7999);
    expect(explicador.explicar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(s.instantaneo().cartoes.map((c) => c.titulo)).toEqual(['NF-e', 'Rateio']);
    expect(s.instantaneo().indiceAtual).toBe(0);
  });

  it('no máximo 2 explicações automáticas ao mesmo tempo', async () => {
    const s = await iniciada('ensaio');
    const pendentes: Array<ReturnType<typeof adiada<ConteudoCartao>>> = [];
    explicador.explicar.mockImplementation(() => {
      const p = adiada<ConteudoCartao>();
      pendentes.push(p);
      return p.promessa;
    });
    detector.detectar
      .mockResolvedValueOnce([conceito('Rateio'), conceito('NF-e')])
      .mockResolvedValueOnce([conceito('Lote')]);
    s.falaEnsaio('outros', 'Rateio e NF-e.');
    await vi.advanceTimersByTimeAsync(1500 + 8000);
    expect(explicador.explicar).toHaveBeenCalledTimes(2);
    s.falaEnsaio('outros', 'E o lote?');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(explicador.explicar).toHaveBeenCalledTimes(2);

    pendentes[0].resolver(conteudoValido());
    await vi.advanceTimersByTimeAsync(0);
    expect(explicador.explicar).toHaveBeenCalledTimes(3);
    expect(s.instantaneo().cartoes[0].titulo).toBe('Lote');
  });

  it('erro de limite no detector desacelera; outros erros só pulam o ciclo', async () => {
    const desacelerar = vi.spyOn(AgendadorDetector.prototype, 'desacelerar');
    const s = await iniciada('ensaio');
    detector.detectar.mockRejectedValueOnce(new Error('rede')).mockRejectedValueOnce(erroDe(Anthropic.RateLimitError));
    s.falaEnsaio('outros', 'Primeira');
    await vi.advanceTimersByTimeAsync(1500);
    expect(desacelerar).not.toHaveBeenCalled();
    s.falaEnsaio('outros', 'Segunda');
    await vi.advanceTimersByTimeAsync(1500);
    expect(desacelerar).toHaveBeenCalledWith(60_000);
    expect(s.instantaneo().cartoes).toEqual([]);
    expect(aviso).toHaveBeenCalledTimes(2);
  });

  it('pausa segura a fila automática; retomar continua', async () => {
    const s = await iniciada('ensaio');
    detector.detectar.mockResolvedValueOnce([conceito('Rateio'), conceito('NF-e')]);
    s.falaEnsaio('outros', 'Rateio e NF-e.');
    await vi.advanceTimersByTimeAsync(1500);
    s.alternarPausa();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(explicador.explicar).toHaveBeenCalledTimes(1);
    s.alternarPausa();
    expect(explicador.explicar).toHaveBeenCalledTimes(2);
    expect(pedido(1)).toMatchObject({ tipo: 'conceito', alvo: 'NF-e' });
  });

  it('resultado do detector que chega depois de encerrar é descartado', async () => {
    const s = await iniciada('ensaio');
    const deteccao = adiada<ItemDetectado[]>();
    detector.detectar.mockReturnValueOnce(deteccao.promessa);
    s.falaEnsaio('outros', 'Rateio?');
    await vi.advanceTimersByTimeAsync(1500);
    await s.encerrar();
    deteccao.resolver([conceito('Rateio')]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(explicador.explicar).not.toHaveBeenCalled();
  });
});

describe('erros dos cartões', () => {
  async function cartaoQueFalhaCom(erro: unknown) {
    const s = await iniciada('ensaio');
    explicador.explicar.mockRejectedValue(erro);
    s.explicar();
    await vi.advanceTimersByTimeAsync(0);
    return s;
  }

  it('erro do explicador marca o cartão', async () => {
    const s = await cartaoQueFalhaCom(new Error('falhou'));
    expect(s.instantaneo().cartoes[0]).toMatchObject({ estado: 'erro', erro: ERRO_PADRAO });
    expect(s.instantaneo().avisos).toEqual([]);
  });

  it('recusa da IA tem texto próprio', async () => {
    const s = await cartaoQueFalhaCom(new RecusaIa());
    expect(s.instantaneo().cartoes[0]).toMatchObject({ estado: 'erro', erro: 'não foi possível gerar esta sugestão' });
  });

  it('chave inválida também gera o aviso de chave', async () => {
    const s = await cartaoQueFalhaCom(erroDe(Anthropic.AuthenticationError));
    expect(s.instantaneo().cartoes[0]).toMatchObject({ estado: 'erro', erro: ERRO_PADRAO });
    expect(s.instantaneo().avisos).toEqual([{ id: expect.any(String), tipo: 'chave', texto: TEXTO_AVISO.chave }]);
  });

  it('sem permissão também gera o aviso de chave', async () => {
    const s = await cartaoQueFalhaCom(erroDe(Anthropic.PermissionDeniedError));
    expect(tiposAvisos(s)).toEqual(['chave']);
  });

  it.each<TipoCartao>(['diga-isso', 'conceito', 'resposta'])('cartão %s que termina com o campo principal vazio vira erro', async (tipo) => {
    const s = await iniciada('ensaio');
    const outros = { 'diga-isso': { explicacao: 'x' }, conceito: { digaIsso: 'x', comoExplicar: 'x' }, resposta: { digaIsso: 'x' } };
    explicador.explicar.mockResolvedValue({ titulo: 'T', campos: { ...outros[tipo] }, fontes: [] });
    if (tipo === 'diga-isso') s.ajudarResponder();
    else if (tipo === 'conceito') s.explicar();
    else s.perguntar('Qual o SLA?');
    await vi.advanceTimersByTimeAsync(0);
    expect(s.instantaneo().cartoes[0]).toMatchObject({ tipo, estado: 'erro', erro: ERRO_PADRAO });
  });
});

describe('atalhos e pergunta digitada', () => {
  it('atalho ignora o limite de 8 s', async () => {
    const s = await iniciada('ensaio');
    s.falaEnsaio('voce', 'Fala antiga');
    await vi.advanceTimersByTimeAsync(61_000);
    detector.detectar.mockResolvedValueOnce([conceito('Rateio')]);
    s.falaEnsaio('outros', 'O que é rateio?');
    await vi.advanceTimersByTimeAsync(1500);
    expect(explicador.explicar).toHaveBeenCalledTimes(1);

    s.ajudarResponder();
    expect(explicador.explicar).toHaveBeenCalledTimes(2);
    expect(pedido(1)).toEqual({
      tipo: 'diga-isso',
      janela: [{ quem: 'outros', texto: 'O que é rateio?', idioma: 'pt', em: Date.now() - 1500 }],
    });
    expect(s.instantaneo().cartoes[0]).toMatchObject({ tipo: 'diga-isso', titulo: '…', origem: 'atalho' });
  });

  it('atalho ignora o limite de concorrência', async () => {
    const s = await iniciada('ensaio');
    explicador.explicar.mockReturnValue(new Promise(() => undefined));
    detector.detectar.mockResolvedValueOnce([conceito('Rateio'), conceito('NF-e')]);
    s.falaEnsaio('outros', 'Rateio e NF-e.');
    await vi.advanceTimersByTimeAsync(1500 + 8000);
    expect(explicador.explicar).toHaveBeenCalledTimes(2);
    s.explicar();
    s.ajudarResponder();
    expect(explicador.explicar).toHaveBeenCalledTimes(4);
  });

  it('explicar pede um conceito com os últimos 60 s', async () => {
    const s = await iniciada('ensaio');
    s.falaEnsaio('outros', 'Fazemos rateio.');
    s.explicar();
    expect(pedido(0)).toEqual({ tipo: 'conceito', janela: [expect.objectContaining({ texto: 'Fazemos rateio.' })] });
    expect(s.instantaneo().cartoes[0]).toMatchObject({ tipo: 'conceito', titulo: '…', origem: 'atalho' });
  });

  it('perguntar usa o texto como alvo e título, com os últimos 180 s', async () => {
    const s = await iniciada('ensaio');
    s.falaEnsaio('outros', 'Fala de 3,5 min atrás');
    await vi.advanceTimersByTimeAsync(30_000);
    s.falaEnsaio('outros', 'Fala de 3 min atrás');
    await vi.advanceTimersByTimeAsync(3 * MIN);
    explicador.explicar.mockClear();
    s.perguntar('  Qual o SLA?  ');
    expect(pedido(0)).toEqual({
      tipo: 'resposta',
      alvo: 'Qual o SLA?',
      janela: [expect.objectContaining({ texto: 'Fala de 3 min atrás' })],
    });
    expect(s.instantaneo().cartoes[0]).toMatchObject({ tipo: 'resposta', titulo: 'Qual o SLA?', origem: 'digitado' });
  });

  it('pergunta vazia é ignorada', async () => {
    const s = await iniciada('ensaio');
    s.perguntar('   ');
    expect(explicador.explicar).not.toHaveBeenCalled();
    expect(s.instantaneo().cartoes).toEqual([]);
  });

  it('atalhos funcionam em pausa', async () => {
    const s = await iniciada('ensaio');
    s.alternarPausa();
    s.ajudarResponder();
    expect(explicador.explicar).toHaveBeenCalledTimes(1);
  });

  it('atalhos fora de reunião ativa não fazem nada', async () => {
    const nova = criarSessaoReuniao(deps, { modo: 'ensaio', contexto: ctx });
    expect(() => {
      nova.ajudarResponder();
      nova.explicar();
      nova.perguntar('x');
      nova.navegar(1);
    }).not.toThrow();
    expect(explicador.explicar).not.toHaveBeenCalled();
    expect(deps.publicar).not.toHaveBeenCalled();
    await nova.iniciar();
    await nova.encerrar();
    nova.ajudarResponder();
    expect(explicador.explicar).not.toHaveBeenCalled();
  });

  it('navegar limita o índice entre 0 e o último cartão', async () => {
    const s = await iniciada('ensaio');
    s.navegar(1);
    expect(s.instantaneo().indiceAtual).toBe(0);
    s.explicar();
    s.explicar();
    s.explicar();
    s.navegar(-1);
    expect(s.instantaneo().indiceAtual).toBe(0);
    for (let i = 0; i < 5; i++) s.navegar(1);
    expect(s.instantaneo().indiceAtual).toBe(2);
    s.navegar(-1);
    expect(s.instantaneo().indiceAtual).toBe(1);
    s.ajudarResponder();
    expect(s.instantaneo().indiceAtual).toBe(0);
  });
});

describe('verificação a cada 30 s', () => {
  it('pausa automática após 15 min de silêncio', async () => {
    const s = await iniciada('audio');
    await vi.advanceTimersByTimeAsync(15 * MIN);
    expect(s.instantaneo().estado).toBe('ouvindo');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(s.instantaneo().estado).toBe('pausado');
    expect(tiposAvisos(s)).toEqual(['pausa-automatica']);
    expect(stts.get('outros')!.pausar).toHaveBeenCalled();
  });

  it('conta o silêncio a partir da última fala', async () => {
    const s = await iniciada('audio');
    await vi.advanceTimersByTimeAsync(10 * MIN);
    falaStt('voce', 'Ainda estou aqui');
    await vi.advanceTimersByTimeAsync(15 * MIN);
    expect(s.instantaneo().estado).toBe('ouvindo');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(s.instantaneo().estado).toBe('pausado');
  });

  it('retomar tira o aviso e não pausa de novo logo em seguida', async () => {
    const s = await iniciada('audio');
    await vi.advanceTimersByTimeAsync(15.5 * MIN);
    s.alternarPausa();
    expect(s.instantaneo().estado).toBe('ouvindo');
    expect(tiposAvisos(s)).toEqual([]);
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(s.instantaneo().estado).toBe('ouvindo');
  });

  it('avisa quando não ouve os outros', async () => {
    const s = await iniciada('audio');
    await vi.advanceTimersByTimeAsync(2 * MIN + 10_000);
    falaStt('voce', 'Vocês me ouvem?');
    await vi.advanceTimersByTimeAsync(20_000); // 2 min 30 s
    expect(s.instantaneo().avisos).toEqual([
      { id: expect.any(String), tipo: 'sem-som-outros', texto: TEXTO_AVISO['sem-som-outros'] },
    ]);
    falaStt('voce', 'Alô?');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tiposAvisos(s)).toEqual(['sem-som-outros']);

    falaStt('outros', 'Ouvimos sim');
    expect(tiposAvisos(s)).toEqual([]);
  });

  it('não avisa nos primeiros 2 min nem quando os outros falaram há pouco', async () => {
    const s = await iniciada('audio');
    falaStt('voce', 'Bom dia');
    await vi.advanceTimersByTimeAsync(2 * MIN);
    expect(tiposAvisos(s)).toEqual([]);
    falaStt('outros', 'Bom dia');
    await vi.advanceTimersByTimeAsync(30_000);
    falaStt('voce', 'Vamos lá');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tiposAvisos(s)).toEqual([]);
  });

  it('modo ensaio não verifica silêncio, mas roda o detector', async () => {
    const s = await iniciada('ensaio');
    await vi.advanceTimersByTimeAsync(16 * MIN);
    expect(s.instantaneo().estado).toBe('ouvindo');
    s.falaEnsaio('voce', 'Oi');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(detector.detectar).toHaveBeenCalledTimes(1);
  });
});

describe('status da transcrição', () => {
  it('aoStatus atualiza a conexão e erros de chave/cota viram aviso uma vez só', async () => {
    const s = await iniciada('audio');
    expect(s.instantaneo().conexao).toEqual({ voce: 'ok', outros: 'ok' });
    cbs.get('outros')!.aoStatus('reconectando');
    cbs.get('outros')!.aoStatus('reconectando');
    expect(s.instantaneo().conexao).toEqual({ voce: 'ok', outros: 'reconectando' });
    expect(s.instantaneo().avisos).toEqual([]);

    cbs.get('outros')!.aoStatus('erro', 'cota');
    cbs.get('voce')!.aoStatus('erro', 'cota');
    expect(s.instantaneo().conexao).toEqual({ voce: 'erro', outros: 'erro' });
    expect(s.instantaneo().avisos).toEqual([{ id: expect.any(String), tipo: 'cota', texto: TEXTO_AVISO.cota }]);

    cbs.get('voce')!.aoStatus('erro', 'chave');
    expect(tiposAvisos(s)).toEqual(['cota', 'chave']);
  });
});

describe('encerrar', () => {
  /** Reunião de ensaio com um cartão diga-isso ("Qual o prazo?") e um conceito ("Rateio") prontos. */
  async function reuniaoComCartoes(): Promise<SessaoReuniao> {
    const s = await iniciada('ensaio');
    detector.detectar.mockResolvedValueOnce([pergunta('Qual o prazo?'), conceito('Rateio')]);
    explicador.explicar.mockImplementation(async (p) =>
      p.tipo === 'diga-isso'
        ? { titulo: 'Prazo', campos: { digaIsso: 'Em duas semanas.' }, fontes: [] }
        : { titulo: 'Rateio', campos: { explicacao: 'Divide custos.' }, fontes: [] },
    );
    s.falaEnsaio('outros', 'Qual o prazo?');
    await vi.advanceTimersByTimeAsync(1500 + 8000);
    expect(s.instantaneo().cartoes.map((c) => [c.tipo, c.estado])).toEqual([
      ['conceito', 'pronto'],
      ['diga-isso', 'pronto'],
    ]);
    return s;
  }

  it('encerrar salva resumo e conceitos, sem transcrição nem diga-isso', async () => {
    const s = await reuniaoComCartoes();
    await vi.advanceTimersByTimeAsync(20 * MIN);
    const item = await s.encerrar();
    expect(deps.salvar).toHaveBeenCalledWith(item);
    expect(JSON.stringify(item)).not.toContain('Qual o prazo?'); // nem fala nem diga-isso
    expect(JSON.stringify(item)).not.toContain('Em duas semanas');
    expect(item!.conceitos).toEqual([{ termo: 'Rateio', explicacao: 'Divide custos.', fontes: [] }]);
    expect(item).toEqual({
      id: expect.any(String),
      tipo: 'reuniao',
      data: INICIO.toISOString(),
      duracaoMin: 20,
      contexto: 'Cliente hospital',
      documentos: ['Manual.pdf'],
      resumo: resumoFalso,
      conceitos: [{ termo: 'Rateio', explicacao: 'Divide custos.', fontes: [] }],
    });
    expect(resumidor.resumir).toHaveBeenCalledWith(
      [expect.objectContaining({ quem: 'outros', texto: 'Qual o prazo?' })],
      ['Rateio'],
    );
    expect(s.instantaneo().transcricao).toEqual([]);
    expect(s.instantaneo().estado).toBe('concluida');
  });

  it('resumo que falha 2x salva só os conceitos', async () => {
    const s = await reuniaoComCartoes();
    resumidor.resumir.mockRejectedValue(new Error('falhou'));
    const item = await s.encerrar();
    expect(resumidor.resumir).toHaveBeenCalledTimes(2);
    expect(item!.resumo).toBeNull();
    expect(item!.conceitos).toHaveLength(1);
    expect(deps.salvar).toHaveBeenCalledWith(item);
    expect(tiposAvisos(s)).toEqual(['resumo-falhou']);
  });

  it('resumo que falha 1x usa a nova tentativa', async () => {
    const s = await reuniaoComCartoes();
    resumidor.resumir.mockRejectedValueOnce(new Error('falhou'));
    const item = await s.encerrar();
    expect(item!.resumo).toEqual(resumoFalso);
    expect(tiposAvisos(s)).toEqual([]);
  });

  it('fecha as transcrições antes do resumo, e a fala final entra nele', async () => {
    const s = await iniciada('audio');
    stts.get('outros')!.encerrar.mockImplementation(async () => falaStt('outros', 'Última fala'));
    const item = await s.encerrar();
    expect(stts.get('voce')!.encerrar).toHaveBeenCalled();
    expect(resumidor.resumir).toHaveBeenCalledWith([expect.objectContaining({ texto: 'Última fala' })], []);
    expect(item!.resumo).toEqual(resumoFalso);
    expect(s.instantaneo().parciais).toEqual({ voce: '', outros: '' });
  });

  it('espera as explicações em andamento antes de resumir', async () => {
    const s = await iniciada('ensaio');
    const fim = adiada<ConteudoCartao>();
    explicador.explicar.mockReturnValue(fim.promessa);
    s.explicar();
    const encerrando = s.encerrar();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.instantaneo().estado).toBe('encerrando');
    expect(resumidor.resumir).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    fim.resolver({ titulo: 'Lote', campos: { explicacao: 'Junta notas.' }, fontes: [] });
    const item = await encerrando;
    expect(resumidor.resumir).toHaveBeenCalledWith([], ['Lote']);
    expect(item!.conceitos).toEqual([{ termo: 'Lote', explicacao: 'Junta notas.', fontes: [] }]);
  });

  it('não espera mais de 25 s pelas explicações', async () => {
    const s = await iniciada('ensaio');
    explicador.explicar.mockReturnValue(new Promise(() => undefined));
    s.explicar();
    let item: unknown = 'pendente';
    void s.encerrar().then((i) => (item = i));
    await vi.advanceTimersByTimeAsync(24_999);
    expect(item).toBe('pendente');
    await vi.advanceTimersByTimeAsync(1);
    expect(item).toMatchObject({ tipo: 'reuniao', conceitos: [] });
  });

  it('descarta a fila automática ao encerrar', async () => {
    const s = await iniciada('ensaio');
    detector.detectar.mockResolvedValueOnce([conceito('Rateio'), conceito('NF-e')]);
    s.falaEnsaio('outros', 'Rateio e NF-e.');
    await vi.advanceTimersByTimeAsync(1500);
    await s.encerrar();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(explicador.explicar).toHaveBeenCalledTimes(1);
  });

  it('encerrar duas vezes devolve o mesmo item e salva uma vez', async () => {
    const s = await iniciada('ensaio');
    const [a, b] = await Promise.all([s.encerrar(), s.encerrar()]);
    const c = await s.encerrar();
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(deps.salvar).toHaveBeenCalledTimes(1);
  });

  it('fora de ouvindo/pausado devolve null', async () => {
    const s = criarSessaoReuniao(deps, { modo: 'ensaio', contexto: ctx });
    expect(await s.encerrar()).toBeNull();
    expect(deps.salvar).not.toHaveBeenCalled();
  });

  it('funciona a partir da pausa', async () => {
    const s = await iniciada('audio');
    s.alternarPausa();
    expect(await s.encerrar()).toMatchObject({ tipo: 'reuniao' });
    expect(s.instantaneo().estado).toBe('concluida');
  });

  it('se salvar falha, limpa a transcrição e repassa o erro', async () => {
    const s = await iniciada('ensaio');
    s.falaEnsaio('outros', 'Qual o prazo?');
    deps.salvar.mockRejectedValue(new Error('disco cheio'));
    await expect(s.encerrar()).rejects.toThrow('disco cheio');
    expect(s.instantaneo().transcricao).toEqual([]);
    expect(s.instantaneo().estado).toBe('concluida');
  });
});

describe('descartar', () => {
  it('para tudo, limpa a transcrição e não salva nada', async () => {
    const s = await iniciada('audio');
    falaStt('outros', 'Qual o prazo?');
    s.descartar();
    expect(deps.salvar).not.toHaveBeenCalled();
    expect(resumidor.resumir).not.toHaveBeenCalled();
    expect(stts.get('outros')!.encerrar).toHaveBeenCalled();
    expect(s.instantaneo().transcricao).toEqual([]);
    expect(s.instantaneo().estado).toBe('concluida');

    falaStt('outros', 'Fala final entregue pelo encerramento');
    expect(s.instantaneo().transcricao).toEqual([]);
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(detector.detectar).not.toHaveBeenCalled();
    expect(await s.encerrar()).toBeNull();
  });
});

describe('instantâneo e publicação', () => {
  it('instantaneo devolve cópias', async () => {
    const s = await iniciada('ensaio');
    s.falaEnsaio('outros', 'Qual o prazo?');
    s.explicar();
    const i = s.instantaneo();
    i.cartoes[0].titulo = 'mexido';
    i.cartoes[0].campos.explicacao = 'mexido';
    i.transcricao[0].texto = 'mexido';
    i.transcricao.push(i.transcricao[0]);
    i.parciais.outros = 'mexido';
    i.conexao.outros = 'erro';
    i.cartoes.pop();
    const j = s.instantaneo();
    expect(j.cartoes).toHaveLength(1);
    expect(j.cartoes[0].titulo).toBe('…');
    expect(j.cartoes[0].campos).toEqual({});
    expect(j.transcricao).toEqual([expect.objectContaining({ texto: 'Qual o prazo?' })]);
    expect(j.parciais.outros).toBe('');
    expect(j.conexao.outros).toBe('ok');
  });

  it('publica no máximo 1 vez a cada 100 ms, e a última sempre sai', async () => {
    const s = await iniciada('audio');
    await vi.advanceTimersByTimeAsync(1000);
    deps.publicar.mockClear();
    const cb = cbs.get('outros')!;
    cb.aoParcial('Q');
    cb.aoParcial('Qu');
    cb.aoParcial('Qua');
    cb.aoParcial('Qual');
    expect(deps.publicar).toHaveBeenCalledTimes(1);
    expect(deps.publicar.mock.calls[0][0].parciais.outros).toBe('Q');
    await vi.advanceTimersByTimeAsync(99);
    expect(deps.publicar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(deps.publicar).toHaveBeenCalledTimes(2);
    expect(deps.publicar.mock.calls[1][0].parciais.outros).toBe('Qual');
    expect(s.instantaneo().parciais.outros).toBe('Qual');
  });

  it('publica o estado final e nada depois de concluída', async () => {
    const s = await iniciada('ensaio');
    const lenta = adiada<ConteudoCartao>();
    let atualizar!: (c: ConteudoCartao) => void;
    explicador.explicar.mockImplementation((_p, cb) => {
      atualizar = cb;
      return lenta.promessa;
    });
    s.explicar();
    const encerrando = s.encerrar();
    await vi.advanceTimersByTimeAsync(25_000);
    await encerrando;
    expect(deps.publicar.mock.lastCall![0].estado).toBe('concluida');
    const total = deps.publicar.mock.calls.length;

    atualizar({ campos: { explicacao: 'Tarde demais' }, fontes: [] });
    lenta.resolver(conteudoValido());
    await vi.advanceTimersByTimeAsync(1000);
    expect(deps.publicar).toHaveBeenCalledTimes(total);
  });

  it('callbacks não lançam quando publicar falha', async () => {
    deps.publicar.mockImplementation(() => {
      throw new Error('janela fechada');
    });
    const s = await iniciada('audio');
    const cb = cbs.get('outros')!;
    expect(() => {
      cb.aoParcial('Qual');
      cb.aoFalar({ quem: 'outros', texto: 'Qual o prazo?', idioma: 'pt', em: Date.now() });
      cb.aoFimDeFala();
      cb.aoStatus('erro', 'chave');
    }).not.toThrow();

    let atualizacaoLancou = false;
    explicador.explicar.mockImplementation(async (_p, aoAtualizar) => {
      try {
        aoAtualizar({ campos: { explicacao: 'Divide' }, fontes: [] });
      } catch {
        atualizacaoLancou = true;
      }
      return conteudoValido();
    });
    await vi.advanceTimersByTimeAsync(200);
    s.explicar();
    await vi.advanceTimersByTimeAsync(200);
    expect(atualizacaoLancou).toBe(false);
    expect(s.instantaneo().cartoes[0].estado).toBe('pronto');
    expect(aviso).toHaveBeenCalled();
  });
});
