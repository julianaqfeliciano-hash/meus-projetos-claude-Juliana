import type { CamposCartao, Cartao, TipoCartao } from '../../../shared/tipos';
import { textoFonte } from './rotulos';

const NOME_DO_TIPO: Record<TipoCartao, string> = { 'diga-isso': 'Diga isso', conceito: 'Conceito', resposta: 'Resposta' };

interface CampoDoCartao {
  campo: keyof CamposCartao;
  rotulo: string | null;
  /** O texto principal do cartão aparece maior que o resto. */
  grande?: boolean;
}

const CAMPOS_DO_TIPO: Record<TipoCartao, CampoDoCartao[]> = {
  'diga-isso': [{ campo: 'digaIsso', rotulo: null, grande: true }],
  conceito: [
    { campo: 'explicacao', rotulo: 'Explicação' },
    { campo: 'comoExplicar', rotulo: 'Como explicar ao cliente' },
  ],
  resposta: [{ campo: 'resposta', rotulo: null }],
};

/** O cursor piscando do texto que ainda está chegando. */
function Cursor() {
  return (
    <span aria-hidden="true" className="animate-pulse">
      ▍
    </span>
  );
}

interface Props {
  cartao: Cartao;
  /** É o cartão da vez (`indiceAtual`): sempre aberto e com borda de destaque. */
  destaque: boolean;
  /** Um cartão que não é o da vez fica recolhido, só com o título, até a usuária clicar. */
  aberto: boolean;
  /** Clicar no título de um cartão que não é o da vez. */
  aoAlternar: () => void;
}

export function CartaoView({ cartao, destaque, aberto, aoAlternar }: Props) {
  const expandido = destaque || aberto;
  const campos = CAMPOS_DO_TIPO[cartao.tipo].filter(({ campo }) => (cartao.campos[campo] ?? '') !== '');
  const escrevendo = cartao.estado === 'escrevendo';

  const titulo = (
    <>
      <span className="mr-2 rounded bg-slate-700 px-1.5 py-0.5 text-[0.75em] font-medium text-slate-200">
        {NOME_DO_TIPO[cartao.tipo]}
      </span>
      {cartao.titulo}
    </>
  );

  return (
    <article
      className={`rounded-lg border bg-slate-800 ${destaque ? 'border-sky-400 ring-1 ring-sky-400/50' : 'border-slate-700'}`}
    >
      {destaque ? (
        <h2 className="px-3 pt-2 font-semibold">{titulo}</h2>
      ) : (
        <h2 className="font-semibold">
          <button
            type="button"
            aria-expanded={aberto}
            onClick={aoAlternar}
            className={`w-full px-3 py-2 text-left hover:bg-slate-700/60 ${aberto ? '' : 'truncate'}`}
          >
            {titulo}
          </button>
        </h2>
      )}

      {expandido && (
        <div className="space-y-2 px-3 pt-1 pb-2">
          {campos.map(({ campo, rotulo, grande }, i) => (
            <div key={campo}>
              {rotulo && <p className="text-[0.8em] font-medium text-slate-400">{rotulo}</p>}
              <p className={`whitespace-pre-wrap ${grande ? 'text-[1.25em] leading-snug font-medium' : ''}`}>
                {cartao.campos[campo]}
                {escrevendo && i === campos.length - 1 && <Cursor />}
              </p>
            </div>
          ))}
          {escrevendo && campos.length === 0 && (
            <p>
              <Cursor />
            </p>
          )}
          {cartao.estado === 'erro' && (
            <p role="alert" className="text-red-300">
              {cartao.erro ?? 'Não foi possível gerar esta sugestão.'}
            </p>
          )}
          {cartao.fontes.length > 0 && (
            <p className="text-[0.75em] text-slate-400">{cartao.fontes.map(textoFonte).join(' · ')}</p>
          )}
        </div>
      )}
    </article>
  );
}
