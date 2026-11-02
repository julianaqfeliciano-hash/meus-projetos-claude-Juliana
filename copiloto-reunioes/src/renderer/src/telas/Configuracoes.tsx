import { useEffect, useState } from 'react';
import type { AcaoAtalho, Preferencias, ResultadoChave } from '../../../shared/tipos';
import { copiloto, mensagemDeErro } from '../api';

const CAMPO =
  'w-full rounded border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const BOTAO =
  'rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const LINK = 'text-blue-700 underline hover:text-blue-900';

type Provedor = 'anthropic' | 'soniox';

const TEXTO_RESULTADO: Record<ResultadoChave, string> = {
  ok: '✓ válida',
  invalida: 'chave inválida',
  'erro-rede': 'sem internet',
};

const ROTULO_ATALHO: Record<AcaoAtalho, string> = {
  ajudarResponder: 'Me ajuda a responder',
  explicar: 'Explicar um termo',
  digitar: 'Digitar pergunta',
  ocultar: 'Ocultar ou mostrar o painel',
  pausar: 'Pausar ou retomar a escuta',
  anterior: 'Cartão anterior',
  proximo: 'Próximo cartão',
};
const ACOES = Object.keys(ROTULO_ATALHO) as AcaoAtalho[];

interface Props {
  preferencias: Preferencias;
  temChaves: Record<Provedor, boolean>;
  statusChaves: Record<Provedor, ResultadoChave | null>;
  /** Depois de salvar as chaves: a janela consulta o estado delas de novo. */
  aoSalvarChaves: () => void;
  /** Depois de salvar as preferências: a janela relê as preferências (tamanho da letra, por exemplo). */
  aoSalvarPreferencias: () => void;
}

function EstadoDaChave({ resultado }: { resultado: ResultadoChave | undefined | 'verificando' }) {
  if (!resultado) return null;
  if (resultado === 'verificando') return <span className="text-slate-500">verificando…</span>;
  return <span className={resultado === 'ok' ? 'text-green-700' : 'text-red-700'}>{TEXTO_RESULTADO[resultado]}</span>;
}

/** Os microfones disponíveis. Sem permissão o navegador esconde os nomes; uma abertura rápida do microfone os revela. */
function useMicrofones(): { microfones: MediaDeviceInfo[]; erro: string | null } {
  const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    const entradas = async () =>
      (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    (async () => {
      let lista = await entradas();
      if (lista.length > 0 && lista.every((d) => d.label === '')) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          for (const faixa of stream.getTracks()) faixa.stop();
          lista = await entradas();
        } catch (e) {
          console.warn('Não consegui abrir o microfone para ler os nomes dos dispositivos:', e);
        }
      }
      if (ativo) setMicrofones(lista);
    })().catch((e: unknown) => {
      if (ativo) setErro(mensagemDeErro(e));
    });
    return () => {
      ativo = false;
    };
  }, []);
  return { microfones, erro };
}

export function Configuracoes({ preferencias, temChaves, statusChaves, aoSalvarChaves, aoSalvarPreferencias }: Props) {
  const { microfones, erro: erroMicrofones } = useMicrofones();

  const [chaves, setChaves] = useState<Record<Provedor, string>>({ anthropic: '', soniox: '' });
  const [resultados, setResultados] = useState<Partial<Record<Provedor, ResultadoChave>>>({});
  const [salvandoChaves, setSalvandoChaves] = useState(false);
  const [erroChaves, setErroChaves] = useState<string | null>(null);

  const [sobreVoce, setSobreVoce] = useState(preferencias.sobreVoce);
  const [microfoneId, setMicrofoneId] = useState(preferencias.microfoneId);
  const [atalhos, setAtalhos] = useState(preferencias.atalhos);
  const [tamanhoLetra, setTamanhoLetra] = useState(preferencias.tamanhoLetra);
  const [opacidadePainel, setOpacidadePainel] = useState(preferencias.opacidadePainel);
  const [invisivel, setInvisivel] = useState(preferencias.invisivelNoCompartilhamento);
  const [errosAtalhos, setErrosAtalhos] = useState<Record<AcaoAtalho, string | null> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const alguma = chaves.anthropic.trim() !== '' || chaves.soniox.trim() !== '';

  async function salvarChaves() {
    setSalvandoChaves(true);
    setErroChaves(null);
    try {
      const pedido: { anthropic?: string; soniox?: string } = {};
      if (chaves.anthropic.trim() !== '') pedido.anthropic = chaves.anthropic.trim();
      if (chaves.soniox.trim() !== '') pedido.soniox = chaves.soniox.trim();
      const resposta = await copiloto.config.salvarChaves(pedido);
      setResultados(resposta);
      // Só as chaves válidas foram guardadas; as outras ficam no campo para a usuária corrigir.
      setChaves((atuais) => ({
        anthropic: resposta.anthropic === 'ok' ? '' : atuais.anthropic,
        soniox: resposta.soniox === 'ok' ? '' : atuais.soniox,
      }));
      aoSalvarChaves();
    } catch (e) {
      setErroChaves(mensagemDeErro(e));
    } finally {
      setSalvandoChaves(false);
    }
  }

  async function salvarPreferencias() {
    setSalvando(true);
    setErroSalvar(null);
    setSalvo(false);
    try {
      const erros = await copiloto.config.salvar({
        ...preferencias,
        sobreVoce,
        microfoneId,
        atalhos,
        tamanhoLetra,
        opacidadePainel,
        invisivelNoCompartilhamento: invisivel,
      });
      setErrosAtalhos(erros);
      setSalvo(ACOES.every((acao) => erros[acao] === null));
      aoSalvarPreferencias();
    } catch (e) {
      setErroSalvar(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  function campoDaChave(provedor: Provedor, rotulo: string, link: { href: string; texto: string }) {
    const resultado = resultados[provedor] ?? (temChaves[provedor] ? (statusChaves[provedor] ?? 'verificando') : undefined);
    return (
      <div>
        <label className="block">
          <span className="mb-1 block font-medium">{rotulo}</span>
          <input
            type="password"
            autoComplete="off"
            className={CAMPO}
            value={chaves[provedor]}
            placeholder={temChaves[provedor] ? 'Chave salva — cole outra para trocar' : 'Cole a chave aqui'}
            onChange={(e) => setChaves((atuais) => ({ ...atuais, [provedor]: e.target.value }))}
          />
        </label>
        <p className="mt-1 flex flex-wrap items-center gap-x-3">
          <EstadoDaChave resultado={resultado} />
          <a className={LINK} href={link.href} target="_blank" rel="noreferrer">
            {link.texto}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Chaves de acesso</h2>
        <p className="text-slate-600">
          As chaves ficam guardadas no seu computador, criptografadas pelo Windows. Cada uma é testada na hora de salvar.
        </p>
        {campoDaChave('anthropic', 'Chave da Anthropic (IA)', {
          href: 'https://console.anthropic.com',
          texto: 'Criar chave em console.anthropic.com',
        })}
        {campoDaChave('soniox', 'Chave da Soniox (transcrição)', {
          href: 'https://soniox.com',
          texto: 'Criar chave em soniox.com',
        })}
        <div className="flex items-center gap-4">
          <button type="button" className={BOTAO} disabled={!alguma || salvandoChaves} onClick={() => void salvarChaves()}>
            {salvandoChaves ? 'Testando…' : 'Salvar chaves'}
          </button>
          {erroChaves && <span className="text-red-700">{erroChaves}</span>}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Sobre você</h2>
        <label className="block">
          <span className="mb-1 block text-slate-600">
            Opcional. Ajuda as sugestões a saírem na primeira pessoa e de acordo com o seu papel.
          </span>
          <textarea
            className={CAMPO}
            rows={3}
            value={sobreVoce}
            placeholder="Ex.: Sou consultora de implantação do sistema X na empresa Y"
            onChange={(e) => setSobreVoce(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Microfone</span>
          <select className={CAMPO} value={microfoneId ?? ''} onChange={(e) => setMicrofoneId(e.target.value || null)}>
            <option value="">Padrão do Windows</option>
            {microfoneId && !microfones.some((m) => m.deviceId === microfoneId) && (
              <option value={microfoneId}>Microfone salvo (não encontrado agora)</option>
            )}
            {microfones.map((m, i) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Microfone ${i + 1}`}
              </option>
            ))}
          </select>
          {erroMicrofones && <span className="mt-1 block text-red-700">{erroMicrofones}</span>}
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Atalhos</h2>
        <p className="text-slate-600">Escreva como em Control+Alt+Space: Ctrl, Alt ou Shift, mais uma tecla.</p>
        <div className="space-y-3">
          {ACOES.map((acao) => (
            <div key={acao}>
              <label className="grid items-center gap-2 sm:grid-cols-[14rem_1fr]">
                <span>{ROTULO_ATALHO[acao]}</span>
                <input
                  className={CAMPO}
                  value={atalhos[acao]}
                  onChange={(e) => setAtalhos((atuais) => ({ ...atuais, [acao]: e.target.value }))}
                />
              </label>
              {errosAtalhos?.[acao] && <p className="mt-1 text-red-700 sm:ml-[14.5rem]">{errosAtalhos[acao]}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Aparência do painel</h2>
        <label className="block">
          <span className="mb-1 block font-medium">Tamanho da letra</span>
          <select
            className={CAMPO}
            value={tamanhoLetra}
            onChange={(e) => setTamanhoLetra(e.target.value === 'grande' ? 'grande' : 'normal')}
          >
            <option value="normal">Normal</option>
            <option value="grande">Grande</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Opacidade do painel: {Math.round(opacidadePainel * 100)}%</span>
          <input
            type="range"
            className="w-full"
            min={0.6}
            max={1}
            step={0.05}
            value={opacidadePainel}
            onChange={(e) => setOpacidadePainel(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="size-5" checked={invisivel} onChange={(e) => setInvisivel(e.target.checked)} />
          <span>Invisível no compartilhamento de tela</span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4 pb-8">
        <button type="button" className={BOTAO} disabled={salvando} onClick={() => void salvarPreferencias()}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        {salvo && <span className="text-green-700">✓ Salvo</span>}
        {erroSalvar && <span className="text-red-700">{erroSalvar}</span>}
      </div>
    </div>
  );
}
