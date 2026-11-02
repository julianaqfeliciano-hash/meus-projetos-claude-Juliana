import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  Cartao,
  CamposCartao,
  EstadoReuniao,
  InstantaneoReuniao,
  ItemHistoricoReuniao,
  Quem,
  StatusConexao,
  TipoCartao,
} from '../../../shared/tipos';
import { copiloto, mensagemDeErro } from '../api';
import { DetalheReuniao, textoDaFonte } from './Historico';

const CAMPO =
  'w-full rounded border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const BOTAO =
  'rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const BOTAO_SECUNDARIO =
  'rounded border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const BOTAO_PERIGO =
  'rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50';

/** A transcrição mostrada vai até aqui: o resto continua na memória do programa, só não desenha tudo de novo. */
const MAX_FALAS_NA_TELA = 200;

const TEXTO_ESTADO: Record<EstadoReuniao, string> = {
  preparando: 'Preparando…',
  ouvindo: 'Ouvindo',
  pausado: 'Pausado',
  encerrando: 'Encerrando e gerando o resumo…',
  concluida: 'Reunião encerrada',
};
const TEXTO_CONEXAO: Record<StatusConexao, string> = { ok: 'conectado', reconectando: 'reconectando…', erro: 'erro' };
const NOME_QUEM: Record<Quem, string> = { voce: 'Você', outros: 'Outros' };

const TIPO_DO_CARTAO: Record<TipoCartao, string> = { 'diga-isso': 'Diga isso', conceito: 'Conceito', resposta: 'Resposta' };
const CAMPOS_DO_CARTAO: Record<TipoCartao, { campo: keyof CamposCartao; rotulo: string | null }[]> = {
  'diga-isso': [{ campo: 'digaIsso', rotulo: null }],
  conceito: [
    { campo: 'explicacao', rotulo: null },
    { campo: 'comoExplicar', rotulo: 'Como explicar ao cliente' },
  ],
  resposta: [{ campo: 'resposta', rotulo: null }],
};

/** O cartão em tamanho grande: o mesmo conteúdo do painel flutuante. */
function CartaoGrande({ cartao, atual }: { cartao: Cartao; atual: boolean }) {
  const campos = CAMPOS_DO_CARTAO[cartao.tipo].filter(({ campo }) => (cartao.campos[campo] ?? '') !== '');
  return (
    <article
      className={`space-y-2 rounded-lg border bg-white p-4 ${atual ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-slate-700">{TIPO_DO_CARTAO[cartao.tipo]}</span>
          {cartao.titulo}
        </p>
        {cartao.estado === 'escrevendo' && <span className="animate-pulse text-slate-500">escrevendo…</span>}
      </header>
      {campos.map(({ campo, rotulo }) => (
        <div key={campo}>
          {rotulo && <p className="font-medium text-slate-600">{rotulo}</p>}
          <p className="whitespace-pre-wrap">{cartao.campos[campo]}</p>
        </div>
      ))}
      {cartao.estado === 'erro' && (
        <p className="text-red-700">{cartao.erro ?? 'Não foi possível gerar esta sugestão.'}</p>
      )}
      {cartao.fontes.length > 0 && (
        <p className="text-slate-600">Fontes: {cartao.fontes.map(textoDaFonte).join(' · ')}</p>
      )}
    </article>
  );
}

interface Props {
  modo: 'audio' | 'ensaio';
  /** O último estado publicado pelo processo principal; `null` antes do primeiro. */
  instantaneo: InstantaneoReuniao | null;
  /** Ids dos avisos que a janela já mostra no topo, para não repetir aqui. */
  avisosJaMostrados: string[];
  aoVoltar: () => void;
  aoVerHistorico: () => void;
}

export function Reuniao({ modo, instantaneo, avisosJaMostrados, aoVoltar, aoVerHistorico }: Props) {
  const [encerrando, setEncerrando] = useState(false);
  const [fim, setFim] = useState<{ item: ItemHistoricoReuniao | null; erro: string | null } | null>(null);
  const [fala, setFala] = useState('');
  const [quemFala, setQuemFala] = useState<Quem>('outros');
  const fimDaTranscricao = useRef<HTMLDivElement>(null);

  const estado = instantaneo?.estado ?? 'preparando';
  // Encerrada sem o nosso pedido (ex.: pelo botão do painel). Durante o nosso `encerrar`, o estado `concluida`
  // chega um instante antes da resposta, e o resumo ainda vem por ela.
  const encerradaEmOutroLugar = fim === null && !encerrando && estado === 'concluida';
  const podePausar = estado === 'ouvindo' || estado === 'pausado';
  const transcricao = instantaneo?.transcricao.slice(-MAX_FALAS_NA_TELA) ?? [];

  useEffect(() => {
    const caixa = fimDaTranscricao.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [transcricao.length, instantaneo?.parciais.voce, instantaneo?.parciais.outros]);

  async function encerrar() {
    setEncerrando(true);
    try {
      setFim({ item: await copiloto.reuniao.encerrar(), erro: null });
    } catch (e) {
      // A reunião já terminou (áudio e transcrição foram encerrados): só resta contar o que aconteceu.
      setFim({ item: null, erro: mensagemDeErro(e) });
    } finally {
      setEncerrando(false);
    }
  }

  function enviarFala(e: FormEvent) {
    e.preventDefault();
    const texto = fala.trim();
    if (texto === '') return;
    copiloto.reuniao.falaEnsaio(quemFala, texto);
    setFala('');
  }

  if (fim || encerradaEmOutroLugar) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold">Reunião encerrada</h1>
        {fim?.erro && <p className="text-red-700">{fim.erro}</p>}
        {fim?.item && <DetalheReuniao item={fim.item} />}
        {fim && !fim.item && !fim.erro && <p>Esta reunião já tinha sido encerrada.</p>}
        {encerradaEmOutroLugar && <p>A reunião foi encerrada pelo painel. O resumo está no Histórico.</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BOTAO} onClick={aoVoltar}>
            Nova reunião
          </button>
          <button type="button" className={BOTAO_SECUNDARIO} onClick={aoVerHistorico}>
            Ver no Histórico
          </button>
        </div>
      </div>
    );
  }

  const textoDoEstado =
    modo === 'ensaio' && estado === 'ouvindo' && !encerrando ? 'Em andamento' : TEXTO_ESTADO[encerrando ? 'encerrando' : estado];
  const avisos = (instantaneo?.avisos ?? []).filter((a) => !avisosJaMostrados.includes(a.id));
  const bloqueada = encerrando || estado === 'encerrando';
  const cartoes = instantaneo?.cartoes ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{modo === 'ensaio' ? 'Ensaio' : 'Reunião'}</h1>
          <p className="text-slate-700">
            <span className="font-medium">{textoDoEstado}</span>
            {modo === 'audio' && instantaneo && (
              <span className="text-slate-600">
                {' · '}
                {(['voce', 'outros'] as const).map((q) => `${NOME_QUEM[q]}: ${TEXTO_CONEXAO[instantaneo.conexao[q]]}`).join(' · ')}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className={BOTAO_SECUNDARIO}
            disabled={bloqueada || !podePausar}
            onClick={() => copiloto.reuniao.alternarPausa()}
          >
            {estado === 'pausado' ? 'Retomar' : 'Pausar'}
          </button>
          <button type="button" className={BOTAO_PERIGO} disabled={bloqueada} onClick={() => void encerrar()}>
            {bloqueada ? 'Encerrando…' : 'Encerrar'}
          </button>
        </div>
      </header>

      {avisos.map((aviso) => (
        <p key={aviso.id} role="alert" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          {aviso.texto}
        </p>
      ))}

      {modo === 'ensaio' && (
        <form onSubmit={enviarFala} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <fieldset className="flex gap-4">
            <legend className="sr-only">Quem está falando</legend>
            {(['outros', 'voce'] as const).map((q) => (
              <label key={q} className="flex items-center gap-2">
                <input type="radio" name="quem-fala" checked={quemFala === q} onChange={() => setQuemFala(q)} />
                {NOME_QUEM[q]}
              </label>
            ))}
          </fieldset>
          <input
            className={`${CAMPO} min-w-0 flex-1`}
            value={fala}
            placeholder="Digite o que foi dito"
            aria-label="Fala do ensaio"
            onChange={(e) => setFala(e.target.value)}
          />
          <button type="submit" className={BOTAO} disabled={bloqueada || fala.trim() === ''}>
            Enviar
          </button>
        </form>
      )}

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3" aria-label="Cartões">
          {cartoes.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-slate-600">
              Os cartões aparecem aqui quando alguém fizer uma pergunta ou citar um termo técnico. O mais novo fica em cima.
            </p>
          )}
          {cartoes.map((cartao, i) => (
            <CartaoGrande key={cartao.id} cartao={cartao} atual={i === instantaneo?.indiceAtual} />
          ))}
        </section>

        <section aria-label="Transcrição" className="min-w-0">
          <h2 className="mb-2 text-xl font-semibold">Transcrição</h2>
          <div ref={fimDaTranscricao} className="max-h-[60vh] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
            {transcricao.length === 0 && !instantaneo?.parciais.voce && !instantaneo?.parciais.outros && (
              <p className="text-slate-500">{modo === 'ensaio' ? 'As falas digitadas aparecem aqui.' : 'Nada ouvido ainda.'}</p>
            )}
            {transcricao.map((f, i) => (
              <p key={`${f.em}-${i}`}>
                <span className="font-semibold">{NOME_QUEM[f.quem]}:</span> {f.texto}
              </p>
            ))}
            {(['voce', 'outros'] as const).map(
              (q) =>
                instantaneo?.parciais[q] && (
                  <p key={q} className="text-slate-500">
                    <span className="font-semibold">{NOME_QUEM[q]}:</span> {instantaneo.parciais[q]}
                  </p>
                ),
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
