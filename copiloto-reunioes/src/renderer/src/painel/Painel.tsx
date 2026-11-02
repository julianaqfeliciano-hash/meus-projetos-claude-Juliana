import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import type { InstantaneoReuniao, Preferencias, Quem } from '../../../shared/tipos';
import { copiloto, mensagemDeErro } from '../api';
import { CartaoView } from './CartaoView';
import { rotuloEstado } from './rotulos';

const ARRASTAR = '[-webkit-app-region:drag]';
const NAO_ARRASTAR = '[-webkit-app-region:no-drag]';

const NOME_QUEM: Record<Quem, string> = { voce: 'Você', outros: 'Outros' };
const LETRA: Record<Preferencias['tamanhoLetra'], string> = { normal: 'text-base', grande: 'text-xl' };

const FALAS_NA_TRANSCRICAO = 10;
/** Os níveis chegam a cada 200 ms enquanto há captura; sem nenhum por tanto tempo, o medidor volta a zero. */
const SILENCIO_DO_MEDIDOR_MS = 800;

const BOTAO =
  'rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[0.85em] font-medium hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50';
const BOTAO_PERIGO = 'border-red-500 bg-red-700 hover:bg-red-600';

/** O nível chega de 0 a 1 (valor eficaz): a fala fica perto de 0,1, então a raiz deixa a barra mais legível. */
const larguraDaBarra = (nivel: number): string => `${Math.round(Math.min(1, Math.sqrt(nivel) * 1.5) * 100)}%`;

/** Cuida sozinho dos níveis de áudio, que chegam várias vezes por segundo, para o painel todo não redesenhar a cada um. */
function Medidor({ quem }: { quem: Quem }) {
  const [nivel, setNivel] = useState(0);

  useEffect(() => {
    let silencio: ReturnType<typeof setTimeout> | undefined;
    const descadastrar = copiloto.audio.aoNivel((q, n) => {
      if (q !== quem) return;
      setNivel(n);
      clearTimeout(silencio);
      silencio = setTimeout(() => setNivel(0), SILENCIO_DO_MEDIDOR_MS);
    });
    return () => {
      descadastrar();
      clearTimeout(silencio);
    };
  }, [quem]);

  return (
    <div className="flex items-center gap-1 text-[0.75em] text-slate-300">
      <span>{NOME_QUEM[quem]}</span>
      <div
        role="meter"
        aria-label={`Nível de áudio: ${NOME_QUEM[quem]}`}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={nivel}
        className="h-1.5 w-10 overflow-hidden rounded bg-slate-700"
      >
        <div className="h-full bg-emerald-400 transition-[width] duration-100" style={{ width: larguraDaBarra(nivel) }} />
      </div>
    </div>
  );
}

export function Painel() {
  const [instantaneo, setInstantaneo] = useState<InstantaneoReuniao | null>(null);
  const [tamanhoLetra, setTamanhoLetra] = useState<Preferencias['tamanhoLetra']>('normal');
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const [transcricaoVisivel, setTranscricaoVisivel] = useState(false);
  const [digitando, setDigitando] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [encerrando, setEncerrando] = useState(false);
  const [erroEncerrar, setErroEncerrar] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  /** Se a caixa "Perguntar" está aberta, para que Enter, Esc e perder o foco só terminem a digitação uma vez. */
  const caixaAberta = useRef(false);
  const fimDaTranscricao = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      copiloto.reuniao.aoInstantaneo((i) => {
        // Reunião encerrada: o painel fica escondido, mas não guarda as falas dela até a próxima.
        setInstantaneo(i.estado === 'concluida' ? null : i);
        // Uma reunião nova (ou voltando a ouvir) não carrega o erro do encerramento da anterior.
        if (i.estado !== 'encerrando' && i.estado !== 'concluida') setErroEncerrar(null);
      }),
    [],
  );

  useEffect(() => copiloto.painel.aoPreferencias((p) => setTamanhoLetra(p.tamanhoLetra)), []);

  // O painel nunca pede foco por conta própria: só o atalho "Digitar pergunta" (via processo principal) o dá.
  useEffect(
    () =>
      copiloto.painel.aoDigitar(() => {
        caixaAberta.current = true;
        // O campo precisa estar na tela para receber o foco, então a atualização não pode esperar.
        flushSync(() => setDigitando(true));
        campo.current?.focus();
      }),
    [],
  );

  const transcricao = instantaneo?.transcricao ?? [];
  const parcialVoce = instantaneo?.parciais.voce ?? '';
  const parcialOutros = instantaneo?.parciais.outros ?? '';
  useEffect(() => {
    const caixa = fimDaTranscricao.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [transcricaoVisivel, transcricao.length, parcialVoce, parcialOutros]);

  /** Esconde e limpa a caixa e devolve o foco ao programa da reunião. Com `texto`, faz a pergunta antes. */
  function terminarDigitacao(texto?: string) {
    if (!caixaAberta.current) return;
    caixaAberta.current = false;
    setDigitando(false);
    setPergunta('');
    if (texto) copiloto.reuniao.perguntar(texto);
    copiloto.painel.terminarDigitacao();
  }

  function aoTeclarNoCampo(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') terminarDigitacao(pergunta.trim() || undefined);
    else if (e.key === 'Escape') terminarDigitacao();
  }

  async function encerrar() {
    setErroEncerrar(null);
    setEncerrando(true);
    try {
      await copiloto.reuniao.encerrar();
    } catch (e) {
      setErroEncerrar(mensagemDeErro(e));
    } finally {
      setEncerrando(false);
    }
  }

  function alternarCartao(id: string) {
    setAbertos((atuais) => {
      const novos = new Set(atuais);
      if (!novos.delete(id)) novos.add(id);
      return novos;
    });
  }

  const estado = instantaneo?.estado ?? 'preparando';
  const podePausar = estado === 'ouvindo' || estado === 'pausado';
  const bloqueado = encerrando || estado === 'encerrando';
  const cartoes = instantaneo?.cartoes ?? [];
  // Os cartões chegam do mais novo ao mais velho. O da vez sobe para o topo e os outros ficam abaixo, na mesma ordem.
  const atual = cartoes.at(instantaneo?.indiceAtual ?? 0);
  const emOrdem = atual ? [atual, ...cartoes.filter((c) => c.id !== atual.id)] : cartoes;
  const falasMostradas = transcricao.slice(-FALAS_NA_TRANSCRICAO);
  const primeiraFalaMostrada = transcricao.length - falasMostradas.length;

  return (
    <div className={`flex h-screen flex-col bg-slate-900 text-slate-100 ${LETRA[tamanhoLetra]}`}>
      <header className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-700 px-3 py-2 select-none ${ARRASTAR}`}>
        <span className="min-w-0 flex-1 font-semibold">{instantaneo ? rotuloEstado(instantaneo) : ''}</span>
        <Medidor quem="voce" />
        <Medidor quem="outros" />
        <div className="flex gap-2">
          <button
            type="button"
            className={`${BOTAO} ${NAO_ARRASTAR}`}
            disabled={bloqueado || !podePausar}
            onClick={() => copiloto.reuniao.alternarPausa()}
          >
            {estado === 'pausado' ? 'Retomar' : 'Pausar'}
          </button>
          <button
            type="button"
            className={`${BOTAO} ${BOTAO_PERIGO} ${NAO_ARRASTAR}`}
            disabled={bloqueado || instantaneo === null}
            onClick={() => void encerrar()}
          >
            Encerrar
          </button>
        </div>
      </header>

      {instantaneo?.avisos.map((aviso) => (
        <p key={aviso.id} role="alert" className="bg-amber-300 px-3 py-1.5 text-[0.85em] text-amber-950">
          {aviso.texto}
        </p>
      ))}
      {erroEncerrar && (
        <p role="alert" className="bg-red-300 px-3 py-1.5 text-[0.85em] text-red-950">
          {erroEncerrar}
        </p>
      )}

      <main className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2" aria-label="Cartões">
        {cartoes.length === 0 && (
          <p className="p-2 text-slate-400">
            {instantaneo ? 'Os cartões aparecem aqui quando alguém fizer uma pergunta ou citar um termo técnico.' : 'Aguardando a reunião…'}
          </p>
        )}
        {emOrdem.map((cartao) => (
          <CartaoView
            key={cartao.id}
            cartao={cartao}
            destaque={cartao.id === atual?.id}
            aberto={abertos.has(cartao.id)}
            aoAlternar={() => alternarCartao(cartao.id)}
          />
        ))}
      </main>

      <footer className="space-y-2 border-t border-slate-700 p-2">
        {transcricaoVisivel && (
          <div
            ref={fimDaTranscricao}
            aria-label="Transcrição ao vivo"
            className="max-h-36 space-y-1 overflow-y-auto rounded border border-slate-700 bg-slate-800 p-2 text-[0.85em]"
          >
            {falasMostradas.length === 0 && !parcialVoce && !parcialOutros && <p className="text-slate-400">Nada ouvido ainda.</p>}
            {falasMostradas.map((f, i) => (
              <p key={primeiraFalaMostrada + i}>
                <span className="font-semibold">{NOME_QUEM[f.quem]}:</span> {f.texto}
              </p>
            ))}
            {parcialVoce && (
              <p className="text-slate-400">
                <span className="font-semibold">{NOME_QUEM.voce}:</span> {parcialVoce}
              </p>
            )}
            {parcialOutros && (
              <p className="text-slate-400">
                <span className="font-semibold">{NOME_QUEM.outros}:</span> {parcialOutros}
              </p>
            )}
          </div>
        )}

        <div hidden={!digitando}>
          <input
            ref={campo}
            value={pergunta}
            placeholder="Pergunte algo — Enter envia, Esc cancela"
            aria-label="Perguntar"
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={aoTeclarNoCampo}
            onBlur={() => terminarDigitacao()}
            className="w-full rounded border border-slate-500 bg-slate-800 px-2 py-1.5 focus:ring-2 focus:ring-sky-400 focus:outline-none"
          />
        </div>

        <button type="button" className={BOTAO} aria-pressed={transcricaoVisivel} onClick={() => setTranscricaoVisivel((v) => !v)}>
          {transcricaoVisivel ? 'Esconder transcrição' : 'Mostrar transcrição'}
        </button>
      </footer>
    </div>
  );
}
