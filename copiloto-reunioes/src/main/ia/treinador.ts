import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { AvaliacaoResposta, ConfigTreino, PerguntaTreino, RelatorioTreino } from '../../shared/tipos';
import { pedirEstruturado } from './estruturado';
import { MODELO_PRINCIPAL } from './modelos';

export interface RespostaTreino {
  pergunta: string;
  resposta: string;
  avaliacao: AvaliacaoResposta;
}

/** Coach do treino de entrevista. É só simulação para praticar: nunca é usado numa entrevista de verdade. */
export interface Treinador {
  gerarPerguntas(cfg: ConfigTreino): Promise<PerguntaTreino[]>;
  avaliar(cfg: ConfigTreino, pergunta: string, resposta: string): Promise<AvaliacaoResposta>;
  relatorio(cfg: ConfigTreino, respostas: RespostaTreino[]): Promise<RelatorioTreino>;
}

const esquemaPerguntas = z.strictObject({ perguntas: z.array(z.string()) });

const esquemaAvaliacao: z.ZodType<AvaliacaoResposta> = z.strictObject({
  foiBem: z.array(z.string()),
  faltou: z.array(z.string()),
  respostaMelhorada: z.string(),
  dicasIngles: z.array(z.string()),
});

const esquemaRelatorio: z.ZodType<RelatorioTreino> = z.strictObject({
  pontosFortes: z.array(z.string()),
  aTreinar: z.array(z.string()),
  perguntasMaisFracas: z.array(z.string()),
});

const NOME_IDIOMA: Record<ConfigTreino['idioma'], string> = { pt: 'português', en: 'inglês' };

const DESCRICAO_TIPO: Record<ConfigTreino['tipo'], string> = {
  comportamental: 'comportamentais (experiências passadas, situações vividas, atitudes e soft skills)',
  tecnica: 'técnicas (conhecimentos e habilidades que a vaga exige)',
  mista: 'uma mistura de comportamentais e técnicas',
};

/** Igual nas três chamadas de um treino, e sem data nem id, para a parte fixa do pedido não variar. */
function montarSystem(cfg: ConfigTreino): Anthropic.Beta.Messages.BetaTextBlockParam[] {
  const curriculo = cfg.curriculo.trim() || 'não informado';
  const texto =
    'Você é uma entrevistadora experiente e está ajudando a usuária a PRATICAR uma entrevista de emprego. ' +
    'Isto é uma simulação de treino; seja exigente, mas respeitosa e útil.\n\n' +
    `Descrição da vaga:\n${cfg.vaga.trim()}\n\n` +
    `Currículo da usuária:\n${curriculo}`;
  return [{ type: 'text', text: texto }];
}

function pedir<T>(cliente: Anthropic, cfg: ConfigTreino, tarefa: string, esquema: z.ZodType<T>): Promise<T> {
  return pedirEstruturado(cliente, {
    modelo: MODELO_PRINCIPAL,
    esforco: 'medium',
    system: montarSystem(cfg),
    mensagens: [{ role: 'user', content: tarefa }],
    esquema,
    maxTokens: 8000,
  });
}

function tarefaPerguntas(cfg: ConfigTreino): string {
  return (
    `Faça ${cfg.quantidade} perguntas de entrevista, em ${NOME_IDIOMA[cfg.idioma]}, ` +
    `${DESCRICAO_TIPO[cfg.tipo]}. Adapte-as à vaga e ao currículo da usuária. ` +
    'Cada pergunta deve ser completa e independente das outras, sem numeração.'
  );
}

function tarefaAvaliacao(cfg: ConfigTreino, pergunta: string, resposta: string): string {
  const idioma = NOME_IDIOMA[cfg.idioma];
  const dicas =
    cfg.idioma === 'en'
      ? 'dicasIngles: dicas de vocabulário e de gramática do inglês que ela usou, escritas em português.'
      : 'dicasIngles: deixe como lista vazia ([]), porque a entrevista é em português.';
  return (
    `A entrevista é em ${idioma}. Avalie a resposta da usuária à pergunta abaixo.\n\n` +
    `Pergunta:\n${pergunta}\n\n` +
    `Resposta da usuária:\n${resposta.trim() || '(em branco)'}\n\n` +
    'Escreva os comentários sempre em português. Preencha:\n' +
    '- foiBem: o que foi bem na resposta.\n' +
    '- faltou: o que faltou ou pode melhorar. Se a resposta estiver vazia, diga o que ela precisava conter.\n' +
    `- respostaMelhorada: uma versão melhorada da resposta, em ${idioma}, para a usuária treinar dizendo.\n` +
    `- ${dicas}`
  );
}

function descreverResposta(r: RespostaTreino, i: number): string {
  const lista = (itens: string[]) => (itens.length > 0 ? itens.join('; ') : 'nada');
  return (
    `Pergunta ${i + 1}: ${r.pergunta}\n` +
    `Resposta: ${r.resposta.trim() || '(em branco)'}\n` +
    `Foi bem: ${lista(r.avaliacao.foiBem)}\n` +
    `Faltou: ${lista(r.avaliacao.faltou)}`
  );
}

function tarefaRelatorio(respostas: RespostaTreino[]): string {
  return (
    'O treino terminou. Veja cada pergunta, a resposta da usuária e a avaliação dela:\n\n' +
    `${respostas.map(descreverResposta).join('\n\n')}\n\n` +
    'Faça o relatório final, em português: pontosFortes (o que ela faz bem), ' +
    'aTreinar (o que ela deve treinar) e perguntasMaisFracas (o texto das perguntas em que ela foi pior).'
  );
}

export function criarTreinador(cliente: Anthropic, gerarId: () => string): Treinador {
  return {
    async gerarPerguntas(cfg) {
      const { perguntas } = await pedir(cliente, cfg, tarefaPerguntas(cfg), esquemaPerguntas);
      return perguntas
        .map((p) => p.trim())
        .filter((p) => p !== '')
        .slice(0, cfg.quantidade)
        .map((texto) => ({ id: gerarId(), texto }));
    },

    async avaliar(cfg, pergunta, resposta) {
      const avaliacao = await pedir(cliente, cfg, tarefaAvaliacao(cfg, pergunta, resposta), esquemaAvaliacao);
      return cfg.idioma === 'en' ? avaliacao : { ...avaliacao, dicasIngles: [] };
    },

    relatorio(cfg, respostas) {
      return pedir(cliente, cfg, tarefaRelatorio(respostas), esquemaRelatorio);
    },
  };
}
