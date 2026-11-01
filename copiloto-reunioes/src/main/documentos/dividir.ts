/**
 * Divide `texto` em pedaços de no máximo `maxChars` caracteres, sem pedaços vazios.
 * Corta em parágrafos (linha em branco); um parágrafo maior que o limite é cortado em fim de frase
 * (". ") ou de linha; em último caso, o corte é seco.
 */
export function dividirTexto(texto: string, maxChars = 3000): string[] {
  const partes: string[] = [];
  let atual = '';
  const fechar = (): void => {
    if (atual) partes.push(atual);
    atual = '';
  };

  for (const bruto of texto.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const paragrafo = bruto.trim();
    if (!paragrafo) continue;
    if (paragrafo.length > maxChars) {
      fechar();
      partes.push(...cortarParagrafo(paragrafo, maxChars));
    } else if (atual && atual.length + 2 + paragrafo.length <= maxChars) {
      atual += `\n\n${paragrafo}`;
    } else {
      fechar();
      atual = paragrafo;
    }
  }
  fechar();
  return partes;
}

function cortarParagrafo(paragrafo: string, maxChars: number): string[] {
  const partes: string[] = [];
  let atual = '';
  const fechar = (): void => {
    const limpo = atual.trim();
    if (limpo) partes.push(limpo);
    atual = '';
  };

  // Cada frase mantém o separador que a termina (". " ou quebra de linha), então juntá-las devolve o original.
  for (const frase of paragrafo.split(/(?<=\. )|(?<=\n)/)) {
    if (frase.length > maxChars) {
      fechar();
      for (let i = 0; i < frase.length; i += maxChars) {
        const corte = frase.slice(i, i + maxChars).trim();
        if (corte) partes.push(corte);
      }
    } else if (atual.length + frase.length <= maxChars) {
      atual += frase;
    } else {
      fechar();
      atual = frase;
    }
  }
  fechar();
  return partes;
}
