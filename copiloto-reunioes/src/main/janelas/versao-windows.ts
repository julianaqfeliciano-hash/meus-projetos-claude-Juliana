/** Primeira build do Windows 10 (versão 2004) em que `WDA_EXCLUDEFROMCAPTURE` tira a janela da captura. */
const BUILD_MINIMA = 19041;

/**
 * `release` é o `os.release()` do Windows (ex.: "10.0.19045"; o Windows 11 também começa com "10.0").
 * Em versões anteriores, a janela protegida aparece como um retângulo preto em vez de sumir.
 */
export function suportaExclusaoCaptura(release: string): boolean {
  const partes = /^10\.\d+\.(\d+)/.exec(release);
  return partes !== null && Number(partes[1]) >= BUILD_MINIMA;
}
