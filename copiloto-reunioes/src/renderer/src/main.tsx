import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CopilotoApi } from '../../shared/ipc';
import { TEXTO_AVISO } from '../../shared/textos';
import type { InstantaneoReuniao, Quem } from '../../shared/tipos';
import { copiloto, mensagemDeErro } from './api';
import { descartarSomPreparado, iniciarCaptura, prepararSomDoComputador } from './audio/captura-audio';
import { Configuracoes } from './telas/Configuracoes';
import { Historico } from './telas/Historico';
import { NovaReuniao, type PedidoReuniao } from './telas/NovaReuniao';
import { Reuniao } from './telas/Reuniao';
import { Treino } from './telas/Treino';
import './estilos.css';

type Config = Awaited<ReturnType<CopilotoApi['config']['obter']>>;
type Tela = 'nova' | 'treino' | 'historico' | 'config';

const INTERVALO_CONSULTA_MS = 2000;
const DURACAO_MAX_CONSULTA_MS = 30_000;

const ITENS_DO_MENU: { tela: Tela; rotulo: string }[] = [
  { tela: 'nova', rotulo: 'Nova reunião' },
  { tela: 'treino', rotulo: 'Treino de entrevista' },
  { tela: 'historico', rotulo: 'Histórico' },
  { tela: 'config', rotulo: 'Configurações' },
];

// Soltar um arquivo fora da área de arquivos não pode abrir o arquivo na janela (o processo principal também recusa).
for (const evento of ['dragover', 'drop']) window.addEventListener(evento, (e) => e.preventDefault());

/** Alguma chave salva ainda está sendo verificada pelo processo principal? */
const verificandoChaves = (c: Config): boolean =>
  (['anthropic', 'soniox'] as const).some((provedor) => c.temChaves[provedor] && c.statusChaves[provedor] === null);

/**
 * As configurações do processo principal. Consulta de novo a cada 2 s, por até 30 s, enquanto o estado de alguma
 * chave salva ainda é desconhecido (a verificação roda em segundo plano na abertura do programa).
 * `reconsultar` faz uma nova rodada, por exemplo depois de salvar as chaves.
 */
function useConfig(aoPrimeiraConsulta: (c: Config) => void): {
  config: Config | null;
  erro: string | null;
  reconsultar: () => void;
} {
  const [config, setConfig] = useState<Config | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);
  const primeira = useRef(true);
  const aoPrimeira = useRef(aoPrimeiraConsulta);
  useEffect(() => {
    aoPrimeira.current = aoPrimeiraConsulta;
  });

  useEffect(() => {
    let ativo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const inicio = Date.now();
    async function consultar() {
      try {
        const atual = await copiloto.config.obter();
        if (!ativo) return;
        setConfig(atual);
        setErro(null);
        if (primeira.current) {
          primeira.current = false;
          aoPrimeira.current(atual);
        }
        if (!verificandoChaves(atual) || Date.now() - inicio >= DURACAO_MAX_CONSULTA_MS) return;
        temporizador = setTimeout(() => void consultar(), INTERVALO_CONSULTA_MS);
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e));
      }
    }
    void consultar();
    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [rodada]);

  return { config, erro, reconsultar: () => setRodada((r) => r + 1) };
}

/** Em que pé está a captura de áudio. `falhou` guarda o motivo e fica até a usuária tentar de novo ou a captura parar. */
type EstadoCaptura = { estado: 'parada' | 'abrindo' | 'ligada' } | { estado: 'falhou'; mensagem: string };
const CAPTURA_PARADA: EstadoCaptura = { estado: 'parada' };

/**
 * Liga e desliga a captura de áudio quando o processo principal manda (`aoComandoCaptura`) e informa o estado dela.
 * `tentarDeNovo` repete o último pedido: o clique da usuária também dá ao navegador a "ação do usuário" que o
 * `getDisplayMedia` exige e que um comando do processo principal não traz. Um `parar` que chega enquanto a captura
 * ainda abre desfaz a abertura.
 */
function useCapturaDeAudio(microfoneId: string | null): {
  captura: EstadoCaptura;
  limpar: () => void;
  tentarDeNovo: () => void;
} {
  const [captura, setCaptura] = useState<EstadoCaptura>(CAPTURA_PARADA);
  const microfone = useRef(microfoneId);
  useEffect(() => {
    microfone.current = microfoneId;
  });
  const repetir = useRef<(() => void) | null>(null);

  useEffect(() => {
    let geracao = 0;
    let parar: (() => void) | null = null;
    let pedido: Quem[] | null = null;
    const pararTudo = () => {
      geracao += 1;
      parar?.();
      parar = null;
    };
    const iniciar = (quem: Quem[]) => {
      pararTudo();
      pedido = quem;
      setCaptura({ estado: 'abrindo' });
      const minha = geracao;
      const falhou = (e: unknown) => {
        if (geracao === minha) setCaptura({ estado: 'falhou', mensagem: mensagemDeErro(e) });
      };
      iniciarCaptura(quem, microfone.current, falhou).then((p) => {
        if (geracao !== minha) {
          p();
          return;
        }
        parar = p;
        setCaptura({ estado: 'ligada' });
      }, falhou);
    };
    repetir.current = () => {
      if (pedido) iniciar(pedido);
    };
    const descadastrar = copiloto.aoComandoCaptura((comando) => {
      if (comando.acao === 'iniciar') {
        iniciar(comando.quem);
      } else {
        pedido = null;
        pararTudo();
        setCaptura(CAPTURA_PARADA); // sem captura pedida, um erro dela não tem mais o que dizer
      }
    });
    return () => {
      descadastrar();
      pararTudo();
      repetir.current = null;
    };
  }, []);

  return { captura, limpar: () => setCaptura(CAPTURA_PARADA), tentarDeNovo: () => repetir.current?.() };
}

function App() {
  const [tela, setTela] = useState<Tela>('nova');
  const [emReuniao, setEmReuniao] = useState<{ modo: PedidoReuniao['modo'] } | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [instantaneo, setInstantaneo] = useState<InstantaneoReuniao | null>(null);

  // Sem a chave da Anthropic o programa não faz nada: abre direto nas Configurações.
  const { config, erro: erroConfig, reconsultar } = useConfig((c) => {
    if (!c.temChaves.anthropic) setTela('config');
  });
  const { captura, limpar: limparCaptura, tentarDeNovo: tentarCapturaDeNovo } = useCapturaDeAudio(
    config?.preferencias.microfoneId ?? null,
  );
  const falhaDaCaptura = captura.estado === 'falhou' ? captura.mensagem : null;
  const reuniaoNoAr = emReuniao !== null || iniciando; // enquanto dura, a falha da captura não pode ser dispensada

  // O painel também precisa saber: ele não tem como pedir uma nova tentativa, só avisar para voltar a esta janela.
  useEffect(() => {
    copiloto.audio.falhaCaptura(falhaDaCaptura);
  }, [falhaDaCaptura]);

  // O estado da reunião é guardado aqui, e não na tela, para não perder o que chegou antes de ela abrir.
  useEffect(() => copiloto.reuniao.aoInstantaneo(setInstantaneo), []);

  async function iniciarReuniao(pedido: PedidoReuniao) {
    // Dentro do clique em Iniciar (antes de qualquer `await`): só agora o navegador aceita pedir o som do computador.
    // O processo principal manda ligar a captura bem depois, quando já leu os documentos.
    if (pedido.modo === 'audio') prepararSomDoComputador();
    setInstantaneo(null);
    setIniciando(true);
    try {
      await copiloto.reuniao.iniciar(pedido);
    } catch (e) {
      descartarSomPreparado();
      throw e;
    } finally {
      setIniciando(false);
    }
    setEmReuniao({ modo: pedido.modo });
  }

  function sairDaReuniao(proxima: Tela) {
    setEmReuniao(null);
    setInstantaneo(null);
    setTela(proxima);
  }

  const chaveInvalida = config !== null && (config.statusChaves.anthropic === 'invalida' || config.statusChaves.soniox === 'invalida');
  const avisosDoApp = config?.avisos ?? [];
  const letraGrande = config?.preferencias.tamanhoLetra === 'grande';

  return (
    <div className={`flex h-screen bg-slate-50 text-slate-900 ${letraGrande ? 'text-lg' : ''}`}>
      <nav aria-label="Menu" className="flex w-60 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3">
        <p className="px-3 py-2 text-xl font-semibold">Copiloto de Reuniões</p>
        {ITENS_DO_MENU.map(({ tela: destino, rotulo }) => (
          <button
            key={destino}
            type="button"
            disabled={emReuniao !== null}
            aria-current={emReuniao === null && tela === destino ? 'page' : undefined}
            onClick={() => setTela(destino)}
            className={`rounded px-3 py-2 text-left font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              emReuniao === null && tela === destino ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {rotulo}
          </button>
        ))}
        {emReuniao && (
          <p className="mt-3 px-3 text-slate-600">
            {emReuniao.modo === 'ensaio' ? 'Ensaio' : 'Reunião'} em andamento. Encerre para usar o menu.
          </p>
        )}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-2 empty:hidden">
          {chaveInvalida && (
            <p role="alert" className="flex flex-wrap items-center gap-3 bg-red-50 px-4 py-2 text-red-900">
              <span>{TEXTO_AVISO.chave}</span>
              {emReuniao === null && (
                <button type="button" className="font-medium underline" onClick={() => setTela('config')}>
                  Abrir as Configurações
                </button>
              )}
            </p>
          )}
          {avisosDoApp.map((aviso) => (
            <p key={aviso.id} role="alert" className="bg-amber-50 px-4 py-2 text-amber-900">
              {aviso.texto}
            </p>
          ))}
          {falhaDaCaptura && (
            <p role="alert" className="flex flex-wrap items-center gap-3 bg-red-50 px-4 py-2 text-red-900">
              <span>Falha na captura de áudio: {falhaDaCaptura}</span>
              <button type="button" className="font-medium underline" onClick={tentarCapturaDeNovo}>
                Tentar de novo
              </button>
              {!reuniaoNoAr && (
                <button type="button" className="font-medium underline" onClick={limparCaptura}>
                  Fechar aviso
                </button>
              )}
            </p>
          )}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {config === null ? (
            erroConfig ? (
              <p className="space-x-3 text-red-700">
                <span>{erroConfig}</span>
                <button type="button" className="underline" onClick={reconsultar}>
                  Tentar de novo
                </button>
              </p>
            ) : (
              <p className="text-slate-600">Carregando…</p>
            )
          ) : (
            <>
              {emReuniao && (
                <Reuniao
                  modo={emReuniao.modo}
                  instantaneo={instantaneo}
                  avisosJaMostrados={avisosDoApp.map((a) => a.id)}
                  capturaFalhou={falhaDaCaptura !== null}
                  aoTentarCapturaDeNovo={tentarCapturaDeNovo}
                  aoVoltar={() => sairDaReuniao('nova')}
                  aoVerHistorico={() => sairDaReuniao('historico')}
                />
              )}
              {/* Nova reunião e Treino ficam montadas, só escondidas: trocar de tela não apaga o que a usuária preencheu. */}
              <div hidden={emReuniao !== null || tela !== 'nova'}>
                <NovaReuniao aoIniciar={iniciarReuniao} />
              </div>
              <div hidden={emReuniao !== null || tela !== 'treino'}>
                <Treino />
              </div>
              {emReuniao === null && tela === 'historico' && <Historico />}
              {emReuniao === null && tela === 'config' && (
                <Configuracoes
                  preferencias={config.preferencias}
                  temChaves={config.temChaves}
                  statusChaves={config.statusChaves}
                  aoSalvarChaves={reconsultar}
                  aoSalvarPreferencias={reconsultar}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
