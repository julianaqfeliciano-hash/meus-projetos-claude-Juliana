import type { AcaoAtalho } from '../../shared/tipos';

export const ATALHOS_PADRAO: Record<AcaoAtalho, string> = {
  ajudarResponder: 'Control+Alt+Space',
  explicar: 'Control+Alt+X',
  digitar: 'Control+Alt+D',
  ocultar: 'Control+Alt+O',
  pausar: 'Control+Alt+B',
  anterior: 'Control+Alt+,',
  proximo: 'Control+Alt+.',
};

const MODIFICADORES = ['Control', 'Alt', 'Shift'] as const;

const APELIDOS_MODIFICADOR: Record<string, (typeof MODIFICADORES)[number]> = {
  ctrl: 'Control',
  control: 'Control',
  commandorcontrol: 'Control',
  cmdorctrl: 'Control',
  alt: 'Alt',
  shift: 'Shift',
};

function normalizarTecla(tecla: string): string {
  const minuscula = tecla.toLowerCase();
  if (minuscula === 'space' || minuscula === 'espaço' || minuscula === 'espaco') return 'Space';
  return tecla.length === 1 ? tecla.toUpperCase() : tecla;
}

/** Devolve os modificadores (na ordem Control, Alt, Shift) e as demais teclas de um atalho. */
function separar(atalho: string): { modificadores: string[]; teclas: string[] } {
  const presentes = new Set<string>();
  const teclas: string[] = [];
  for (const parte of atalho.split('+')) {
    const texto = parte.trim();
    if (texto === '') continue;
    const modificador = APELIDOS_MODIFICADOR[texto.toLowerCase()];
    if (modificador) presentes.add(modificador);
    else teclas.push(normalizarTecla(texto));
  }
  return { modificadores: MODIFICADORES.filter((m) => presentes.has(m)), teclas };
}

export function normalizarAtalho(a: string): string {
  const { modificadores, teclas } = separar(a);
  return [...modificadores, ...teclas].join('+');
}

const ERRO_FORMATO = 'Use Ctrl, Alt ou Shift com uma tecla';
const ERRO_REPETIDO = 'Atalho repetido';
const ERRO_ALTGR = 'Gera um símbolo no teclado brasileiro (AltGr)';

const CONFLITOS: ReadonlyMap<string, string> = new Map([
  ...[
    'Control+Shift+M',
    'Control+Shift+O',
    'Control+Shift+K',
    'Control+Shift+A',
    'Control+Shift+S',
    'Control+Shift+D',
    'Control+Shift+H',
    'Control+Shift+Space',
    'Control+Space',
    'Control+Alt+E',
  ].map((a): [string, string] => [a, 'Usado pelo Microsoft Teams']),
  ...['Control+D', 'Control+E', 'Control+Alt+C', 'Control+Alt+P', 'Control+Alt+H', 'Control+Alt+S', 'Control+Alt+L'].map(
    (a): [string, string] => [a, 'Usado pelo Google Meet'],
  ),
]);

// No teclado ABNT2 o AltGr equivale a Ctrl+Alt e produz estes símbolos.
const TECLAS_ALTGR = new Set(['Q', 'W', 'E', 'C', '1', '2', '3', '4', '5', '6', '=', '[', ']']);

function erroDoAtalho(normalizado: string, jaUsados: ReadonlySet<string>): string | null {
  const { modificadores, teclas } = separar(normalizado);
  if (modificadores.length === 0 || teclas.length !== 1) return ERRO_FORMATO;
  if (jaUsados.has(normalizado)) return ERRO_REPETIDO;
  const conflito = CONFLITOS.get(normalizado);
  if (conflito) return conflito;
  if (modificadores.join('+') === 'Control+Alt' && TECLAS_ALTGR.has(teclas[0])) return ERRO_ALTGR;
  return null;
}

export function validarAtalhos(atalhos: Record<AcaoAtalho, string>): Record<AcaoAtalho, string | null> {
  const resultado = {} as Record<AcaoAtalho, string | null>;
  const jaUsados = new Set<string>();
  for (const acao of Object.keys(ATALHOS_PADRAO) as AcaoAtalho[]) {
    const normalizado = normalizarAtalho(atalhos[acao]);
    resultado[acao] = erroDoAtalho(normalizado, jaUsados);
    jaUsados.add(normalizado);
  }
  return resultado;
}
