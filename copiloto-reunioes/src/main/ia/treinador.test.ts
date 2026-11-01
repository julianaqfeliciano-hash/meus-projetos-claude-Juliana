import { beforeEach, describe, expect, it } from 'vitest';
import type { AvaliacaoResposta, ConfigTreino, RelatorioTreino } from '../../shared/tipos';
import { RecusaIa } from './erros';
import { BETAS_OPUS, MODELO_PRINCIPAL } from './modelos';
import { criarClienteFalso, respostaTexto } from './apoio-testes';
import { criarTreinador, type RespostaTreino } from './treinador';

const cfg: ConfigTreino = {
  vaga: 'Analista de BI Pleno: SQL, Power BI e comunicação com áreas de negócio.',
  curriculo: 'Cinco anos como analista de dados em varejo; liderou a migração para Power BI.',
  idioma: 'en',
  tipo: 'mista',
  quantidade: 5,
};
const avaliacaoValida: AvaliacaoResposta = {
  foiBem: ['Citou um resultado concreto'],
  faltou: ['Explicar o seu papel na equipe'],
  respostaMelhorada: 'I led the migration and cut report time by 40%.',
  dicasIngles: ['Use "led" em vez de "did lead"'],
};
const relatorioValido: RelatorioTreino = {
  pontosFortes: ['Exemplos concretos'],
  aTreinar: ['Respostas mais curtas'],
  perguntasMaisFracas: ['Fale sobre um conflito na equipe.'],
};
const respostas: RespostaTreino[] = [
  { pergunta: 'Fale sobre um conflito na equipe.', resposta: 'Não tive conflitos.', avaliacao: avaliacaoValida },
  {
    pergunta: 'Como você otimiza uma consulta SQL lenta?',
    resposta: 'Olho o plano de execução e crio índices.',
    avaliacao: { ...avaliacaoValida, foiBem: ['Mencionou o plano de execução'], faltou: ['Citar estatísticas'] },
  },
];

let falso: ReturnType<typeof criarClienteFalso>;
let seq: number;
const gerarId = () => `id-${++seq}`;
beforeEach(() => {
  falso = criarClienteFalso();
  seq = 0;
});

const chamada = () => falso.create.mock.calls[0][0];
const textoDoSystem = () => chamada().system.map((b: { text: string }) => b.text).join('\n');
const tarefa = () => chamada().messages.at(-1).content as string;

describe('gerarPerguntas', () => {
  it('gera a quantidade pedida, com ids vindos de gerarId', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a', 'b', 'c', 'd', 'e', 'f'] })));
    const p = await criarTreinador(falso.cliente, gerarId).gerarPerguntas({ ...cfg, quantidade: 5 });
    expect(p).toHaveLength(5);
    expect(p[0]).toEqual({ id: 'id-1', texto: 'a' });
    expect(p.map((x) => x.id)).toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5']);
    expect(p.map((x) => x.texto)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('aceita menos perguntas do que o pedido, sem inventar ids a mais', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a', 'b', 'c'] })));
    const p = await criarTreinador(falso.cliente, gerarId).gerarPerguntas({ ...cfg, quantidade: 8 });
    expect(p).toEqual([
      { id: 'id-1', texto: 'a' },
      { id: 'id-2', texto: 'b' },
      { id: 'id-3', texto: 'c' },
    ]);
    expect(seq).toBe(3);
  });

  it('apara os textos e descarta as perguntas vazias antes de cortar', async () => {
    falso.create.mockResolvedValue(
      respostaTexto(JSON.stringify({ perguntas: ['  a  ', '', '   ', 'b', 'c'] })),
    );
    const p = await criarTreinador(falso.cliente, gerarId).gerarPerguntas({ ...cfg, quantidade: 5 });
    expect(p).toEqual([
      { id: 'id-1', texto: 'a' },
      { id: 'id-2', texto: 'b' },
      { id: 'id-3', texto: 'c' },
    ]);
  });

  it('Opus com esforço médio, fallback, 8000 tokens e sem parâmetros proibidos', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a'] })));
    await criarTreinador(falso.cliente, gerarId).gerarPerguntas(cfg);
    expect(chamada()).toMatchObject({
      model: MODELO_PRINCIPAL,
      max_tokens: 8000,
      betas: BETAS_OPUS,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
    for (const campo of ['thinking', 'temperature', 'top_p', 'top_k']) expect(chamada()).not.toHaveProperty(campo);
  });

  it('o esquema pedido tem só a lista "perguntas" e additionalProperties: false', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a'] })));
    await criarTreinador(falso.cliente, gerarId).gerarPerguntas(cfg);
    const schema = chamada().output_config.format.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).toEqual(['perguntas']);
  });

  it('o system põe a entrevistadora, a vaga e o currículo, sem data nem id', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a'] })));
    await criarTreinador(falso.cliente, gerarId).gerarPerguntas(cfg);
    const system = textoDoSystem();
    expect(system).toMatch(/entrevistadora experiente/);
    expect(system).toContain(cfg.vaga);
    expect(system).toContain(cfg.curriculo);
    expect(system).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(system).not.toContain('id-1');
  });

  it('currículo vazio vira "não informado"', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a'] })));
    await criarTreinador(falso.cliente, gerarId).gerarPerguntas({ ...cfg, curriculo: '  \n ' });
    expect(textoDoSystem()).toMatch(/não informado/);
  });

  it('pede a quantidade, o idioma e o tipo configurados', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a'] })));
    await criarTreinador(falso.cliente, gerarId).gerarPerguntas({ ...cfg, idioma: 'en', tipo: 'tecnica', quantidade: 8 });
    expect(tarefa()).toContain('8 perguntas');
    expect(tarefa()).toMatch(/em inglês/);
    expect(tarefa()).toMatch(/técnicas/);
  });

  it('em português pede as perguntas em português; mista e comportamental têm textos próprios', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a'] })));
    const t = criarTreinador(falso.cliente, gerarId);
    await t.gerarPerguntas({ ...cfg, idioma: 'pt', tipo: 'comportamental' });
    await t.gerarPerguntas({ ...cfg, idioma: 'pt', tipo: 'mista' });
    const [pt, mista] = falso.create.mock.calls.map((c) => c[0].messages.at(-1).content as string);
    expect(pt).toMatch(/em português/);
    expect(pt).toMatch(/comportamentais/);
    expect(pt).not.toMatch(/técnicas/);
    expect(mista).toMatch(/comportamentais e técnicas/);
  });

  it('resposta fora do esquema é rejeitada', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: 'texto' })));
    await expect(criarTreinador(falso.cliente, gerarId).gerarPerguntas(cfg)).rejects.toThrow();
  });

  it('recusa vira RecusaIa', async () => {
    falso.create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(criarTreinador(falso.cliente, gerarId).gerarPerguntas(cfg)).rejects.toBeInstanceOf(RecusaIa);
  });
});

describe('avaliar', () => {
  it('em inglês devolve a avaliação com as dicas', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(avaliacaoValida)));
    expect(await criarTreinador(falso.cliente, gerarId).avaliar(cfg, 'P', 'R')).toEqual(avaliacaoValida);
  });

  it('em português descarta dicas de inglês', async () => {
    falso.create.mockResolvedValue(
      respostaTexto(JSON.stringify({ foiBem: ['x'], faltou: [], respostaMelhorada: 'y', dicasIngles: ['z'] })),
    );
    const av = await criarTreinador(falso.cliente, gerarId).avaliar({ ...cfg, idioma: 'pt' }, 'P', 'R');
    expect(av).toEqual({ foiBem: ['x'], faltou: [], respostaMelhorada: 'y', dicasIngles: [] });
  });

  it('Opus com esforço médio, fallback e 8000 tokens', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(avaliacaoValida)));
    await criarTreinador(falso.cliente, gerarId).avaliar(cfg, 'P', 'R');
    expect(chamada()).toMatchObject({
      model: MODELO_PRINCIPAL,
      max_tokens: 8000,
      betas: BETAS_OPUS,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
    for (const campo of ['thinking', 'temperature', 'top_p', 'top_k']) expect(chamada()).not.toHaveProperty(campo);
  });

  it('o esquema pedido tem exatamente os campos de AvaliacaoResposta', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(avaliacaoValida)));
    await criarTreinador(falso.cliente, gerarId).avaliar(cfg, 'P', 'R');
    const schema = chamada().output_config.format.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties).sort()).toEqual(['dicasIngles', 'faltou', 'foiBem', 'respostaMelhorada']);
  });

  it('a mensagem traz a pergunta e a resposta; o system traz a vaga e o currículo', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(avaliacaoValida)));
    await criarTreinador(falso.cliente, gerarId).avaliar(cfg, 'Fale sobre um desafio.', 'Migrei os relatórios.');
    expect(tarefa()).toContain('Fale sobre um desafio.');
    expect(tarefa()).toContain('Migrei os relatórios.');
    expect(textoDoSystem()).toContain(cfg.vaga);
    expect(textoDoSystem()).toContain(cfg.curriculo);
  });

  it('pede comentários em português e a resposta melhorada no idioma da entrevista', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(avaliacaoValida)));
    const t = criarTreinador(falso.cliente, gerarId);
    await t.avaliar({ ...cfg, idioma: 'en' }, 'P', 'R');
    await t.avaliar({ ...cfg, idioma: 'pt' }, 'P', 'R');
    const [en, pt] = falso.create.mock.calls.map((c) => c[0].messages.at(-1).content as string);
    expect(en).toMatch(/sempre em português/);
    expect(en).toMatch(/respostaMelhorada[^\n]*em inglês/);
    expect(en).toMatch(/dicasIngles/);
    expect(pt).toMatch(/respostaMelhorada[^\n]*em português/);
    expect(pt).toMatch(/dicasIngles[^\n]*\[\]/);
  });

  it('resposta vazia também é enviada ao modelo', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(avaliacaoValida)));
    await criarTreinador(falso.cliente, gerarId).avaliar(cfg, 'Fale sobre um desafio.', '   ');
    expect(falso.create).toHaveBeenCalledTimes(1);
    expect(tarefa()).toContain('Fale sobre um desafio.');
  });

  it('resposta fora do esquema é rejeitada', async () => {
    const { foiBem, faltou, respostaMelhorada } = avaliacaoValida; // sem dicasIngles
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify({ foiBem, faltou, respostaMelhorada })));
    await expect(criarTreinador(falso.cliente, gerarId).avaliar(cfg, 'P', 'R')).rejects.toThrow();
  });

  it('recusa vira RecusaIa', async () => {
    falso.create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(criarTreinador(falso.cliente, gerarId).avaliar(cfg, 'P', 'R')).rejects.toBeInstanceOf(RecusaIa);
  });
});

describe('relatorio', () => {
  it('valida o esquema e devolve o relatório', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(relatorioValido)));
    expect(await criarTreinador(falso.cliente, gerarId).relatorio(cfg, respostas)).toEqual(relatorioValido);
  });

  it('JSON sem um campo é rejeitado', async () => {
    falso.create.mockResolvedValue(
      respostaTexto(JSON.stringify({ pontosFortes: ['x'], aTreinar: ['y'] })),
    );
    await expect(criarTreinador(falso.cliente, gerarId).relatorio(cfg, respostas)).rejects.toThrow();
  });

  it('Opus com esforço médio, fallback e 8000 tokens', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(relatorioValido)));
    await criarTreinador(falso.cliente, gerarId).relatorio(cfg, respostas);
    expect(chamada()).toMatchObject({
      model: MODELO_PRINCIPAL,
      max_tokens: 8000,
      betas: BETAS_OPUS,
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema' } },
    });
  });

  it('o esquema pedido tem exatamente os campos de RelatorioTreino', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(relatorioValido)));
    await criarTreinador(falso.cliente, gerarId).relatorio(cfg, respostas);
    const schema = chamada().output_config.format.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties).sort()).toEqual(['aTreinar', 'perguntasMaisFracas', 'pontosFortes']);
  });

  it('a mensagem lista cada pergunta, resposta e avaliação, e pede o relatório em português', async () => {
    falso.create.mockResolvedValue(respostaTexto(JSON.stringify(relatorioValido)));
    await criarTreinador(falso.cliente, gerarId).relatorio(cfg, respostas);
    const msg = tarefa();
    for (const r of respostas) {
      expect(msg).toContain(r.pergunta);
      expect(msg).toContain(r.resposta);
      for (const item of [...r.avaliacao.foiBem, ...r.avaliacao.faltou]) expect(msg).toContain(item);
    }
    expect(msg.indexOf(respostas[0].pergunta)).toBeLessThan(msg.indexOf(respostas[1].pergunta));
    expect(msg).toMatch(/em português/);
    expect(textoDoSystem()).toContain(cfg.vaga);
  });

  it('recusa vira RecusaIa', async () => {
    falso.create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(criarTreinador(falso.cliente, gerarId).relatorio(cfg, respostas)).rejects.toBeInstanceOf(RecusaIa);
  });
});
