import { useEffect, useState } from 'react';
import { TEXTO_AVISO } from '../../../shared/textos';
import type {
  Fonte,
  Idioma,
  ItemHistorico,
  ItemHistoricoReuniao,
  ItemHistoricoTreino,
  ResumoItemHistorico,
} from '../../../shared/tipos';
import { copiloto, mensagemDeErro } from '../api';

const BOTAO_SECUNDARIO =
  'rounded border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const BOTAO_PERIGO =
  'rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50';

const TIPO_ENTREVISTA = { comportamental: 'comportamental', tecnica: 'técnica', mista: 'mista' } as const;
const IDIOMA: Record<Idioma, string> = { pt: 'português', en: 'inglês' };

const formatarData = (iso: string): string => {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const textoDaFonte = (f: Fonte): string => `${f.arquivo}, ${f.local}`;

/** Um título e uma lista de tópicos; some quando não há itens. */
export function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <h4 className="font-semibold">{titulo}</h4>
      <ul className="list-disc space-y-1 pl-6">
        {itens.map((texto, i) => (
          <li key={i}>{texto}</li>
        ))}
      </ul>
    </div>
  );
}

/** O resumo e os conceitos de uma reunião; também aparece na tela da reunião, logo após encerrar. */
export function DetalheReuniao({ item }: { item: ItemHistoricoReuniao }) {
  const { resumo } = item;
  return (
    <div className="space-y-5">
      <p className="text-slate-600">
        {formatarData(item.data)} · {item.duracaoMin} min
      </p>
      {item.contexto.trim() !== '' && (
        <div>
          <h3 className="text-lg font-semibold">Contexto</h3>
          <p className="whitespace-pre-wrap">{item.contexto}</p>
        </div>
      )}
      <Lista titulo="Documentos" itens={item.documentos} />

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Resumo</h3>
        {resumo ? (
          <>
            <Lista titulo="Assuntos tratados" itens={resumo.assuntos} />
            <Lista titulo="Dúvidas do cliente" itens={resumo.duvidasCliente} />
            <Lista titulo="Decisões" itens={resumo.decisoes} />
            <Lista titulo="Pendências" itens={resumo.pendencias} />
            <Lista titulo="Próximos passos" itens={resumo.proximosPassos} />
          </>
        ) : (
          <p className="text-amber-700">{TEXTO_AVISO['resumo-falhou']}</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Conceitos explicados</h3>
        {item.conceitos.length === 0 && <p className="text-slate-600">Nenhum conceito nesta reunião.</p>}
        {item.conceitos.map((conceito, i) => (
          <div key={i} className="rounded border border-slate-200 bg-white p-3">
            <h4 className="font-semibold">{conceito.termo}</h4>
            <p className="whitespace-pre-wrap">{conceito.explicacao}</p>
            {conceito.fontes.length > 0 && (
              <p className="mt-1 text-slate-600">Fontes: {conceito.fontes.map(textoDaFonte).join(' · ')}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function DetalheTreino({ item }: { item: ItemHistoricoTreino }) {
  return (
    <div className="space-y-5">
      <p className="text-slate-600">
        {formatarData(item.data)} · em {IDIOMA[item.idioma]} · {TIPO_ENTREVISTA[item.tipoEntrevista]}
      </p>
      {item.vagaResumo.trim() !== '' && (
        <div>
          <h3 className="text-lg font-semibold">Vaga</h3>
          <p className="whitespace-pre-wrap">{item.vagaResumo}</p>
        </div>
      )}
      <Lista titulo="Perguntas respondidas" itens={item.perguntas} />
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Relatório</h3>
        <Lista titulo="Pontos fortes" itens={item.relatorio.pontosFortes} />
        <Lista titulo="Pontos a treinar" itens={item.relatorio.aTreinar} />
        <Lista titulo="Perguntas em que foi pior" itens={item.relatorio.perguntasMaisFracas} />
      </section>
    </div>
  );
}

export function Historico() {
  const [itens, setItens] = useState<ResumoItemHistorico[] | null>(null);
  const [aberto, setAberto] = useState<ItemHistorico | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [versao, setVersao] = useState(0); // mudar o número lê a lista de novo
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    let ativo = true;
    copiloto.historico.listar().then(
      (lista) => {
        if (ativo) setItens(lista);
      },
      (e: unknown) => {
        if (ativo) setErro(mensagemDeErro(e));
      },
    );
    return () => {
      ativo = false;
    };
  }, [versao]);

  async function abrir(id: string) {
    try {
      const item = await copiloto.historico.obter(id);
      if (item) {
        setErro(null);
        setConfirmando(false);
        setAberto(item);
      } else {
        setErro('Não encontrei este item. Ele pode ter sido apagado.');
        recarregar();
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function apagar(id: string) {
    setApagando(true);
    try {
      await copiloto.historico.apagar(id);
      setAberto(null);
      setConfirmando(false);
      setErro(null);
      recarregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setApagando(false);
    }
  }

  if (aberto) {
    return (
      <div className="max-w-3xl space-y-6">
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setAberto(null)}>
          ← Voltar ao Histórico
        </button>
        <h1 className="text-2xl font-semibold">{aberto.tipo === 'reuniao' ? 'Reunião' : 'Treino de entrevista'}</h1>
        {aberto.tipo === 'reuniao' ? <DetalheReuniao item={aberto} /> : <DetalheTreino item={aberto} />}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
          {confirmando ? (
            <>
              <span className="font-medium">Apagar este item do Histórico? Não dá para desfazer.</span>
              <button type="button" className={BOTAO_PERIGO} disabled={apagando} onClick={() => void apagar(aberto.id)}>
                {apagando ? 'Apagando…' : 'Sim, apagar'}
              </button>
              <button type="button" className={BOTAO_SECUNDARIO} disabled={apagando} onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setConfirmando(true)}>
              Apagar
            </button>
          )}
        </div>
        {erro && <p className="text-red-700">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Histórico</h1>
      {erro && <p className="text-red-700">{erro}</p>}
      {itens === null && !erro && <p className="text-slate-600">Carregando…</p>}
      {itens?.length === 0 && <p className="text-slate-600">Ainda não há reuniões nem treinos salvos.</p>}
      <ul className="space-y-2">
        {itens?.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="w-full rounded border border-slate-200 bg-white p-3 text-left hover:border-blue-400 hover:bg-blue-50"
              onClick={() => void abrir(item.id)}
            >
              <span className="block font-medium">{item.titulo}</span>
              <span className="block text-slate-600">
                {item.tipo === 'reuniao' ? 'Reunião' : 'Treino de entrevista'} · {formatarData(item.data)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
