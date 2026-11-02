import { useRef, useState, type DragEvent } from 'react';
import { mensagemAviso } from '../../../shared/textos';
import {
  LIMITE_TOKENS_DOCUMENTOS,
  type DocumentoLido,
  type IdiomaSugestao,
} from '../../../shared/tipos';
import type { DocumentosLidos } from '../../../shared/ipc';
import { copiloto, mensagemDeErro } from '../api';

const CAMPO =
  'w-full rounded border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const BOTAO =
  'rounded bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const BOTAO_SECUNDARIO =
  'rounded border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

export interface PedidoReuniao {
  caminhos: string[];
  contexto: string;
  idioma: IdiomaSugestao;
  modo: 'audio' | 'ensaio';
}

interface Props {
  /** Inicia a reunião; rejeita com uma mensagem pronta para mostrar. Ao dar certo, a janela passa à tela da reunião. */
  aoIniciar: (pedido: PedidoReuniao) => Promise<void>;
}

const nomeDoArquivo = (caminho: string): string => caminho.split(/[\\/]/).pop() || caminho;
const formatarNumero = (n: number): string => n.toLocaleString('pt-BR');

const UNIDADE: Record<DocumentoLido['tipo'], [string, string]> = {
  pdf: ['página', 'páginas'],
  pptx: ['slide', 'slides'],
  xlsx: ['aba', 'abas'],
  docx: ['seção', 'seções'],
  texto: ['parte', 'partes'],
  outro: ['parte', 'partes'],
};

function situacaoDoArquivo(doc: DocumentoLido | undefined, lendo: boolean): { texto: string; problema: boolean } {
  if (!doc) return { texto: lendo ? 'lendo…' : 'ainda não lido', problema: false };
  if (doc.aviso) return { texto: mensagemAviso(doc.aviso), problema: true };
  const n = doc.partes.length;
  if (n === 0) return { texto: 'nenhum texto encontrado', problema: true };
  const [singular, plural] = UNIDADE[doc.tipo];
  return { texto: `${n} ${n === 1 ? singular : plural}`, problema: false };
}

export function NovaReuniao({ aoIniciar }: Props) {
  const [caminhos, setCaminhos] = useState<string[]>([]);
  const [leitura, setLeitura] = useState<DocumentosLidos | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);
  const [contexto, setContexto] = useState('');
  const [idioma, setIdioma] = useState<IdiomaSugestao>('auto');
  const [avisou, setAvisou] = useState(false);
  const [iniciando, setIniciando] = useState<PedidoReuniao['modo'] | null>(null);
  const [erroInicio, setErroInicio] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const leituraAtual = useRef(0);

  /** Define a lista de arquivos e lê tudo de novo (a contagem de tokens vale para a lista inteira). */
  async function carregar(lista: string[]) {
    const minha = ++leituraAtual.current;
    setCaminhos(lista);
    setErroLeitura(null);
    if (lista.length === 0) {
      setLeitura(null);
      setLendo(false);
      return;
    }
    setLendo(true);
    try {
      const lida = await copiloto.documentos.ler(lista);
      if (leituraAtual.current === minha) setLeitura(lida);
    } catch (e) {
      if (leituraAtual.current === minha) {
        setLeitura(null);
        setErroLeitura(mensagemDeErro(e));
      }
    } finally {
      if (leituraAtual.current === minha) setLendo(false);
    }
  }

  function adicionar(novos: string[]) {
    const lista = [...new Set([...caminhos, ...novos.filter((c) => c !== '')])];
    if (lista.length === caminhos.length) return;
    void carregar(lista);
  }

  async function escolher() {
    setErroLista(null);
    try {
      adicionar(await copiloto.documentos.escolher());
    } catch (e) {
      setErroLista(mensagemDeErro(e));
    }
  }

  async function usarOsMesmos() {
    setErroLista(null);
    try {
      const { preferencias } = await copiloto.config.obter();
      if (preferencias.ultimosArquivos.length === 0) {
        setErroLista('Ainda não há uma reunião anterior com arquivos.');
        return;
      }
      adicionar(preferencias.ultimosArquivos);
    } catch (e) {
      setErroLista(mensagemDeErro(e));
    }
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    adicionar(Array.from(e.dataTransfer.files, (arquivo) => copiloto.documentos.caminhoDoArquivo(arquivo)));
  }

  function aoSairDoArraste(e: DragEvent<HTMLDivElement>) {
    // Passar por cima de um filho também dispara `dragleave`; só vale sair da área toda.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false);
  }

  async function iniciar(modo: PedidoReuniao['modo']) {
    setIniciando(modo);
    setErroInicio(null);
    try {
      await aoIniciar({ caminhos, contexto, idioma, modo });
      // A reunião começou: o formulário volta ao início, e o aviso aos participantes vale uma reunião de cada vez.
      void carregar([]);
      setContexto('');
      setAvisou(false);
    } catch (e) {
      setErroInicio(mensagemDeErro(e));
    } finally {
      setIniciando(null);
    }
  }

  const tokens = leitura?.tokens ?? 0;
  const acimaDoLimite = tokens > LIMITE_TOKENS_DOCUMENTOS;
  const proporcao = Math.min(1, tokens / LIMITE_TOKENS_DOCUMENTOS);
  const semLeitura = caminhos.length > 0 && leitura === null; // falhou ou ainda não terminou: o limite é desconhecido
  const bloqueada = lendo || iniciando !== null || acimaDoLimite || semLeitura;
  const corDaBarra = acimaDoLimite ? 'bg-red-600' : proporcao >= 0.8 ? 'bg-amber-500' : 'bg-blue-600';

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Nova reunião</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Documentos (opcional)</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={aoSairDoArraste}
          onDrop={aoSoltar}
          className={`space-y-3 rounded-lg border-2 border-dashed p-4 ${
            arrastando ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'
          }`}
        >
          <p className="text-slate-600">
            Arraste os arquivos para cá. Aceito PDF (com texto), Word, PowerPoint, Excel, TXT e MD.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BOTAO_SECUNDARIO} disabled={iniciando !== null} onClick={() => void escolher()}>
              Escolher arquivos
            </button>
            <button type="button" className={BOTAO_SECUNDARIO} disabled={iniciando !== null} onClick={() => void usarOsMesmos()}>
              Usar os mesmos da última reunião
            </button>
          </div>
          {erroLista && <p className="text-red-700">{erroLista}</p>}

          {caminhos.length > 0 && (
            <ul className="divide-y divide-slate-200">
              {caminhos.map((caminho) => {
                const doc = leitura?.docs.find((d) => d.caminho === caminho);
                const situacao = situacaoDoArquivo(doc, lendo);
                return (
                  <li key={caminho} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={caminho}>
                        {nomeDoArquivo(caminho)}
                      </p>
                      <p className={situacao.problema ? 'text-amber-700' : 'text-slate-600'}>{situacao.texto}</p>
                    </div>
                    <button
                      type="button"
                      className={BOTAO_SECUNDARIO}
                      disabled={iniciando !== null}
                      aria-label={`Remover ${nomeDoArquivo(caminho)}`}
                      onClick={() => void carregar(caminhos.filter((c) => c !== caminho))}
                    >
                      Remover
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <div
            className="h-3 overflow-hidden rounded bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={LIMITE_TOKENS_DOCUMENTOS}
            aria-valuenow={Math.min(tokens, LIMITE_TOKENS_DOCUMENTOS)}
          >
            <div className={`h-full ${corDaBarra}`} style={{ width: `${proporcao * 100}%` }} />
          </div>
          <p className="mt-1 text-slate-700">
            {formatarNumero(tokens)} / {formatarNumero(LIMITE_TOKENS_DOCUMENTOS)} tokens
            {leitura?.estimado ? ' (estimado)' : ''}
            {lendo ? ' — lendo os arquivos…' : ''}
          </p>
          {acimaDoLimite && (
            <p className="mt-1 text-red-700">Os arquivos passam do limite. Remova alguns para começar.</p>
          )}
          {erroLeitura && (
            <p className="mt-1 text-red-700">
              {erroLeitura}{' '}
              <button type="button" className="underline" onClick={() => void carregar(caminhos)}>
                Tentar de novo
              </button>
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xl font-semibold">Contexto da reunião (opcional)</span>
          <span className="mb-1 block text-slate-600">Cliente, objetivo e assuntos esperados.</span>
          <textarea className={CAMPO} rows={4} value={contexto} onChange={(e) => setContexto(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Idioma das sugestões</span>
          <select className={CAMPO} value={idioma} onChange={(e) => setIdioma(e.target.value as IdiomaSugestao)}>
            <option value="auto">Automático</option>
            <option value="pt">Português</option>
            <option value="en">Inglês</option>
          </select>
        </label>
      </section>

      <section className="space-y-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={avisou}
            onChange={(e) => setAvisou(e.target.checked)}
          />
          <span>Avisei os participantes de que a reunião será transcrita.</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BOTAO} disabled={bloqueada || !avisou} onClick={() => void iniciar('audio')}>
            {iniciando === 'audio' ? 'Iniciando…' : 'Iniciar'}
          </button>
          <button type="button" className={BOTAO_SECUNDARIO} disabled={bloqueada} onClick={() => void iniciar('ensaio')}>
            {iniciando === 'ensaio' ? 'Iniciando…' : 'Ensaiar'}
          </button>
          <span className="text-slate-600">O ensaio não usa o áudio: você digita as falas.</span>
        </div>
        {erroInicio && <p className="text-red-700">{erroInicio}</p>}
      </section>
    </div>
  );
}
