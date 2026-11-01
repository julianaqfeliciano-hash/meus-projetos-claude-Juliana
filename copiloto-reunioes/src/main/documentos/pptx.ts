import JSZip from 'jszip';
import type { ParteDoc } from '../../shared/tipos';
import { decodificarEntidades } from './texto';

// Número do slide, data, rodapé, cabeçalho e miniatura do slide (nas notas) não são conteúdo.
const FORMA = /<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g;
const PLACEHOLDER_DE_RODAPE = /<p:ph\b[^>]*\btype="(?:sldNum|dt|ftr|hdr|sldImg)"/;

/** Texto das tags <a:t>, com uma quebra de linha a cada parágrafo (</a:p>) e a cada <a:br/>. */
function textoDoXml(xml: string): string {
  const conteudo = xml.replace(FORMA, (forma) => (PLACEHOLDER_DE_RODAPE.test(forma) ? '' : forma));
  const linhas: string[] = [];
  let linha = '';
  for (const m of conteudo.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/?>|<\/a:p>/g)) {
    if (m[1] !== undefined) {
      linha += decodificarEntidades(m[1]);
    } else {
      linhas.push(linha);
      linha = '';
    }
  }
  linhas.push(linha);
  return linhas.map((l) => l.trim()).filter((l) => l !== '').join('\n');
}

async function lerNotas(zip: JSZip, nomeSlide: string): Promise<string> {
  const rels = await zip.file(`ppt/slides/_rels/${nomeSlide}.rels`)?.async('string');
  const alvo = rels?.match(/Target="(?:\.\.\/|\/ppt\/)notesSlides\/([^"]+)"/)?.[1];
  if (!alvo) return '';
  const xml = await zip.file(`ppt/notesSlides/${alvo}`)?.async('string');
  return xml ? textoDoXml(xml) : '';
}

/** Cada slide com texto vira uma parte "slide N" (N é a posição no arquivo), com as notas anexadas em "Notas: …". */
export async function lerPptx(buf: Uint8Array): Promise<ParteDoc[]> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .flatMap((nome) => {
      const m = nome.match(/^ppt\/slides\/(slide(\d+)\.xml)$/);
      return m ? [{ arquivo: m[1], numero: Number(m[2]) }] : [];
    })
    .sort((a, b) => a.numero - b.numero);

  const partes: ParteDoc[] = [];
  for (const { arquivo, numero } of slides) {
    const xml = await zip.file(`ppt/slides/${arquivo}`)?.async('string');
    let texto = xml ? textoDoXml(xml) : '';
    const notas = await lerNotas(zip, arquivo);
    if (notas) texto += `${texto ? '\n' : ''}Notas: ${notas}`;
    if (texto) partes.push({ rotulo: `slide ${numero}`, texto });
  }
  return partes;
}
