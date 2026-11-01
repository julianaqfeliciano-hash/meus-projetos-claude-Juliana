import type { ParteDoc } from '../../shared/tipos';

const MIN_MEDIA_CHARS_POR_PAGINA = 20;

async function carregarPdfjs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> {
  // O pdf.js só existe como ESM e o main sai em CommonJS: por isso o `import()` dinâmico. O worker é
  // entregue pronto em `globalThis.pdfjsWorker`, para rodar no mesmo processo sem import dinâmico de arquivo.
  const escopo = globalThis as { pdfjsWorker?: unknown };
  escopo.pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

/**
 * Uma parte "p. N" por página com texto. Se a média ficar abaixo de 20 caracteres por página (PDF
 * digitalizado, só imagens), devolve [].
 */
export async function lerPdf(buf: Uint8Array): Promise<ParteDoc[]> {
  const pdfjs = await carregarPdfjs();
  // Cópia: o pdf.js assume a posse do buffer que recebe.
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(buf), verbosity: 0 });
  const pdf = await tarefa.promise;
  try {
    const partes: ParteDoc[] = [];
    let totalChars = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const conteudo = await pagina.getTextContent();
      let texto = '';
      for (const item of conteudo.items) {
        if ('str' in item) texto += item.hasEOL ? `${item.str}\n` : item.str;
      }
      texto = texto.trim();
      totalChars += texto.length;
      if (texto) partes.push({ rotulo: `p. ${n}`, texto });
    }
    return totalChars / pdf.numPages < MIN_MEDIA_CHARS_POR_PAGINA ? [] : partes;
  } finally {
    await tarefa.destroy();
  }
}
