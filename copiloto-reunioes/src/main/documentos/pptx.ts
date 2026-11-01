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

/** Slides na ordem da apresentação: `<p:sldId r:id>` de ppt/presentation.xml, resolvido pelo .rels. Null se não der. */
async function slidesDaApresentacao(zip: JSZip): Promise<string[] | null> {
  const apresentacao = await zip.file('ppt/presentation.xml')?.async('string');
  const rels = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
  if (!apresentacao || !rels) return null;

  const alvos = new Map<string, string>();
  for (const [tag] of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = tag.match(/\bId="([^"]*)"/)?.[1];
    const alvo = tag.match(/\bTarget="([^"]*)"/)?.[1];
    if (id !== undefined && alvo !== undefined) alvos.set(id, alvo);
  }
  // Só dentro de <p:sldIdLst>: as apresentações personalizadas (<p:custShowLst>) reusam o elemento <p:sldId>.
  const lista = apresentacao.match(/<p:sldIdLst\b[^>]*>([\s\S]*?)<\/p:sldIdLst>/)?.[1];
  if (lista === undefined) return null;
  const arquivos = [...lista.matchAll(/<p:sldId\b[^>]*\br:id="([^"]*)"/g)].map(
    (m) => alvos.get(m[1])?.match(/(?:^|\/)slides\/([^/]+)$/)?.[1],
  );
  const completo = arquivos.length > 0 && arquivos.every((a) => a !== undefined && zip.file(`ppt/slides/${a}`));
  return completo ? (arquivos as string[]) : null;
}

/** Slides na ordem da apresentação; se ela não puder ser lida, na ordem numérica de slideN.xml. */
async function slidesEmOrdem(zip: JSZip): Promise<string[]> {
  const daApresentacao = await slidesDaApresentacao(zip);
  if (daApresentacao) return daApresentacao;
  return Object.keys(zip.files)
    .flatMap((nome) => {
      const m = nome.match(/^ppt\/slides\/(slide(\d+)\.xml)$/);
      return m ? [{ arquivo: m[1], numero: Number(m[2]) }] : [];
    })
    .sort((a, b) => a.numero - b.numero)
    .map(({ arquivo }) => arquivo);
}

/**
 * Cada slide com texto vira uma parte "slide N", em que N é a posição na apresentação (a que a usuária vê no
 * PowerPoint; slides vazios ocupam posição, mas são omitidos). As notas são anexadas em "Notas: …".
 */
export async function lerPptx(buf: Uint8Array): Promise<ParteDoc[]> {
  const zip = await JSZip.loadAsync(buf);
  const partes: ParteDoc[] = [];
  const slides = await slidesEmOrdem(zip);
  for (const [posicao, arquivo] of slides.entries()) {
    const xml = await zip.file(`ppt/slides/${arquivo}`)?.async('string');
    let texto = xml ? textoDoXml(xml) : '';
    const notas = await lerNotas(zip, arquivo);
    if (notas) texto += `${texto ? '\n' : ''}Notas: ${notas}`;
    if (texto) partes.push({ rotulo: `slide ${posicao + 1}`, texto });
  }
  return partes;
}
