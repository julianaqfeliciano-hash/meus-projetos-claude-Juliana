import mammoth from 'mammoth';
import type { ParteDoc } from '../../shared/tipos';
import { dividirTexto } from './dividir';
import { decodificarEntidades } from './texto';

const MAX_ROTULO = 60;

/** HTML do mammoth → texto puro: parágrafos, itens e linhas de tabela viram linhas; entidades são decodificadas. */
function htmlParaTexto(html: string): string {
  const semTags = html
    .replace(/<br\s*\/?>|<\/(?:p|li|tr|h[1-6]|ul|ol|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  return decodificarEntidades(semTags)
    .split('\n')
    .map((linha) => linha.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((linha) => linha !== '')
    .join('\n');
}

/**
 * Divide o DOCX nos títulos (h1–h3): o rótulo é o texto do título (até 60 caracteres) e o texto antes do
 * primeiro título é "seção 1". Sem nenhum título, vira "seção N" sobre `dividirTexto`.
 * Seção maior que o limite é dividida e as partes seguintes ganham "(cont.)".
 */
export async function lerDocx(caminho: string): Promise<ParteDoc[]> {
  const { value: html } = await mammoth.convertToHtml({ path: caminho });

  const titulos = [...html.matchAll(/<h[1-3](?:\s[^>]*)?>([\s\S]*?)<\/h[1-3]>/gi)];
  if (titulos.length === 0) {
    return dividirTexto(htmlParaTexto(html)).map((texto, i) => ({ rotulo: `seção ${i + 1}`, texto }));
  }

  const secoes: { rotulo: string; html: string }[] = [];
  const antes = html.slice(0, titulos[0].index);
  if (htmlParaTexto(antes)) secoes.push({ rotulo: 'seção 1', html: antes });
  titulos.forEach((titulo, i) => {
    const fim = titulos[i + 1]?.index ?? html.length;
    const rotulo = Array.from(htmlParaTexto(titulo[1]).replace(/\n/g, ' ')).slice(0, MAX_ROTULO).join('').trim();
    secoes.push({ rotulo: rotulo || `seção ${secoes.length + 1}`, html: html.slice(titulo.index + titulo[0].length, fim) });
  });

  return secoes.flatMap((secao) =>
    dividirTexto(htmlParaTexto(secao.html)).map((texto, i) => ({
      rotulo: i === 0 ? secao.rotulo : `${secao.rotulo} (cont.)`,
      texto,
    })),
  );
}
