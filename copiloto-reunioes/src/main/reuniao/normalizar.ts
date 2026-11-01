/**
 * Chave para comparar itens detectados: minúsculas, sem acentos, sem pontuação, espaços colapsados e
 * um singular simples (palavras com mais de 3 letras perdem o "s" final). "APIs REST" e "api rest" coincidem.
 */
export function normalizarChave(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((palavra) => palavra !== '')
    .map((palavra) => (palavra.length > 3 && palavra.endsWith('s') ? palavra.slice(0, -1) : palavra))
    .join(' ');
}
