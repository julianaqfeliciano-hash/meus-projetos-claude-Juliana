import { useEffect, useState } from 'react';
import type {
  AvaliacaoResposta,
  ConfigTreino,
  Idioma,
  ItemHistoricoTreino,
  PerguntaTreino,
} from '../../../shared/tipos';
import { copiloto, mensagemDeErro } from '../api';
import { Lista } from './Historico';

const CAMPO =
  'w-full rounded border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const BOTAO =
  'rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const BOTAO_SECUNDARIO =
  'rounded border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

interface RespostaAvaliada {
  pergunta: string;
  resposta: string;
  avaliacao: AvaliacaoResposta;
}

type Fase = 'preparar' | 'perguntas' | 'relatorio';
/** Como a usuária está respondendo à pergunta atual: escolhendo, falando (ditado) ou digitando. */
type ModoResposta = 'escolher' | 'falando' | 'digitando';

function Avaliacao({ avaliacao }: { avaliacao: AvaliacaoResposta }) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <Lista titulo="O que foi bem" itens={avaliacao.foiBem} />
      <Lista titulo="O que faltou" itens={avaliacao.faltou} />
      <div>
        <h4 className="font-semibold">Resposta melhorada</h4>
        <p className="whitespace-pre-wrap">{avaliacao.respostaMelhorada}</p>
      </div>
      <Lista titulo="Dicas de inglês" itens={avaliacao.dicasIngles} />
    </div>
  );
}

export function Treino() {
  const [fase, setFase] = useState<Fase>('preparar');
  const [erro, setErro] = useState<string | null>(null);

  // Preparação
  const [vaga, setVaga] = useState('');
  const [curriculo, setCurriculo] = useState('');
  const [idioma, setIdioma] = useState<Idioma>('pt');
  const [tipo, setTipo] = useState<ConfigTreino['tipo']>('mista');
  const [quantidade, setQuantidade] = useState<ConfigTreino['quantidade']>(5);
  const [gerando, setGerando] = useState(false);

  // Perguntas
  const [config, setConfig] = useState<ConfigTreino | null>(null);
  const [perguntas, setPerguntas] = useState<PerguntaTreino[]>([]);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<RespostaAvaliada[]>([]);
  const [modo, setModo] = useState<ModoResposta>('escolher');
  const [texto, setTexto] = useState('');
  const [parcial, setParcial] = useState('');
  const [avaliando, setAvaliando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // Relatório
  const [item, setItem] = useState<ItemHistoricoTreino | null>(null);

  // O texto que a Soniox já entendeu da fala em andamento; só chega durante o ditado.
  useEffect(() => copiloto.treino.aoDitado(setParcial), []);

  async function lerArquivo(destino: (texto: string) => void) {
    setErro(null);
    try {
      const lido = await copiloto.treino.lerArquivo();
      if (lido !== null) destino(lido);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function comecar() {
    const cfg: ConfigTreino = { vaga: vaga.trim(), curriculo: curriculo.trim(), idioma, tipo, quantidade };
    setGerando(true);
    setErro(null);
    try {
      const geradas = await copiloto.treino.perguntas(cfg);
      setConfig(cfg);
      setPerguntas(geradas);
      setIndice(0);
      setRespostas([]);
      setModo('escolher');
      setTexto('');
      setParcial('');
      setFase('perguntas');
    } catch (e) {
      setErro(mensagemDeErro(e)); // fica na preparação, com o formulário como estava
    } finally {
      setGerando(false);
    }
  }

  async function responderFalando() {
    setErro(null);
    try {
      await copiloto.treino.ditadoIniciar();
      setParcial('');
      setModo('falando');
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function terminei() {
    setErro(null);
    try {
      const falado = (await copiloto.treino.ditadoParar()).trim();
      if (falado === '') {
        setErro('Não ouvi a sua resposta. Tente de novo ou digite.');
        setModo('escolher');
      } else {
        // O texto vai para a caixa de digitação: dá para corrigir o que a transcrição errou antes de enviar.
        setTexto(falado);
        setModo('digitando');
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
      setModo('escolher');
    }
  }

  async function enviarResposta() {
    if (!config) return;
    const pergunta = perguntas[indice].texto;
    const resposta = texto.trim();
    setAvaliando(true);
    setErro(null);
    try {
      const avaliacao = await copiloto.treino.avaliar(config, pergunta, resposta);
      setRespostas((atuais) => [...atuais, { pergunta, resposta, avaliacao }]);
    } catch (e) {
      setErro(mensagemDeErro(e)); // a resposta continua na caixa para tentar de novo
    } finally {
      setAvaliando(false);
    }
  }

  function proximaPergunta() {
    setIndice((i) => i + 1);
    setModo('escolher');
    setTexto('');
    setParcial('');
    setErro(null);
  }

  async function terminar() {
    if (!config) return;
    setFinalizando(true);
    setErro(null);
    try {
      setItem(await copiloto.treino.finalizar(config, respostas));
      setFase('relatorio');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setFinalizando(false);
    }
  }

  function novoTreino() {
    setItem(null);
    setErro(null);
    setFase('preparar');
  }

  if (fase === 'relatorio' && item) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold">Relatório do treino</h1>
        <p className="text-slate-600">Ele foi salvo no Histórico.</p>
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <Lista titulo="Pontos fortes" itens={item.relatorio.pontosFortes} />
          <Lista titulo="Pontos a treinar" itens={item.relatorio.aTreinar} />
          <Lista titulo="Perguntas em que foi pior" itens={item.relatorio.perguntasMaisFracas} />
        </div>
        <button type="button" className={BOTAO} onClick={novoTreino}>
          Novo treino
        </button>
      </div>
    );
  }

  if (fase === 'perguntas' && config) {
    const pergunta = perguntas[indice];
    const respondida = respostas[indice];
    const ultima = indice === perguntas.length - 1;
    const ocupada = avaliando || finalizando || modo === 'falando';
    return (
      <div className="max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            Pergunta {indice + 1} de {perguntas.length}
          </h1>
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            disabled={respostas.length === 0 || ocupada}
            onClick={() => void terminar()}
          >
            {finalizando ? 'Gerando o relatório…' : 'Terminar treino'}
          </button>
        </header>

        <p className="rounded-lg bg-blue-50 p-4 text-xl font-medium">{pergunta.texto}</p>

        {respondida ? (
          <>
            <div>
              <h2 className="font-semibold">Sua resposta</h2>
              <p className="whitespace-pre-wrap">{respondida.resposta}</p>
            </div>
            <Avaliacao avaliacao={respondida.avaliacao} />
            {!ultima && (
              <button type="button" className={BOTAO} disabled={ocupada} onClick={proximaPergunta}>
                Próxima pergunta
              </button>
            )}
          </>
        ) : (
          <>
            {modo === 'escolher' && (
              <div className="flex flex-wrap gap-3">
                <button type="button" className={BOTAO} onClick={() => void responderFalando()}>
                  Responder falando
                </button>
                <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setModo('digitando')}>
                  Digitar resposta
                </button>
              </div>
            )}
            {modo === 'falando' && (
              <div className="space-y-3">
                <p className="animate-pulse font-medium text-red-700">Ouvindo você…</p>
                <p aria-live="polite" className="min-h-16 whitespace-pre-wrap rounded border border-slate-200 bg-white p-3">
                  {parcial || <span className="text-slate-500">Pode começar a falar.</span>}
                </p>
                <button type="button" className={BOTAO} onClick={() => void terminei()}>
                  Terminei
                </button>
              </div>
            )}
            {modo === 'digitando' && (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block font-medium">Sua resposta</span>
                  <textarea
                    className={CAMPO}
                    rows={7}
                    value={texto}
                    disabled={avaliando}
                    onChange={(e) => setTexto(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={BOTAO}
                    disabled={texto.trim() === '' || avaliando}
                    onClick={() => void enviarResposta()}
                  >
                    {avaliando ? 'Avaliando…' : 'Enviar resposta'}
                  </button>
                  <button type="button" className={BOTAO_SECUNDARIO} disabled={avaliando} onClick={() => setModo('escolher')}>
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {ultima && respondida && (
          <p className="text-slate-600">Esta foi a última pergunta. Clique em “Terminar treino” para ver o relatório.</p>
        )}
        {erro && <p className="text-red-700">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Treino de entrevista</h1>

      <section className="space-y-2">
        <label className="block">
          <span className="mb-1 block text-xl font-semibold">Descrição da vaga</span>
          <textarea
            className={CAMPO}
            rows={8}
            value={vaga}
            placeholder="Cole aqui a descrição da vaga"
            onChange={(e) => setVaga(e.target.value)}
          />
        </label>
        <button type="button" className={BOTAO_SECUNDARIO} disabled={gerando} onClick={() => void lerArquivo(setVaga)}>
          Escolher arquivo da vaga
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Currículo (opcional)</h2>
        {curriculo !== '' && (
          <p className="text-slate-700">
            Currículo carregado ({curriculo.trim().split(/\s+/).length.toLocaleString('pt-BR')} palavras).
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BOTAO_SECUNDARIO} disabled={gerando} onClick={() => void lerArquivo(setCurriculo)}>
            {curriculo === '' ? 'Escolher arquivo do currículo' : 'Trocar o arquivo'}
          </button>
          {curriculo !== '' && (
            <button type="button" className={BOTAO_SECUNDARIO} disabled={gerando} onClick={() => setCurriculo('')}>
              Remover
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block font-medium">Idioma da entrevista</span>
          <select className={CAMPO} value={idioma} onChange={(e) => setIdioma(e.target.value === 'en' ? 'en' : 'pt')}>
            <option value="pt">Português</option>
            <option value="en">Inglês</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Tipo de perguntas</span>
          <select className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value as ConfigTreino['tipo'])}>
            <option value="comportamental">Comportamental</option>
            <option value="tecnica">Técnica</option>
            <option value="mista">Mista</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Número de perguntas</span>
          <select
            className={CAMPO}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value === '10' ? 10 : e.target.value === '8' ? 8 : 5)}
          >
            <option value={5}>5</option>
            <option value={8}>8</option>
            <option value={10}>10</option>
          </select>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className={BOTAO} disabled={vaga.trim() === '' || gerando} onClick={() => void comecar()}>
          {gerando ? 'Preparando as perguntas…' : 'Começar o treino'}
        </button>
        {erro && <span className="text-red-700">{erro}</span>}
      </div>
    </div>
  );
}
