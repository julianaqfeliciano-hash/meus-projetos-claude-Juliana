// Só para testes: gera arquivos de exemplo de cada formato. Não entra no código de produção.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/** PDF com uma página por item (Helvetica, só ASCII). Texto `''` deixa a página em branco. */
export async function gerarPdf(dir: string, paginas: string[]): Promise<string> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  for (const texto of paginas) {
    const pagina = pdf.addPage();
    if (texto) pagina.drawText(texto, { x: 50, y: 700, size: 14, font: fonte });
  }
  const caminho = path.join(dir, 'exemplo.pdf');
  await fs.writeFile(caminho, await pdf.save());
  return caminho;
}

/** DOCX com uma seção por item: o título (se houver) vira Título 1, seguido do parágrafo de texto. */
export async function gerarDocx(dir: string, secoes: { titulo?: string; texto: string }[]): Promise<string> {
  const filhos = secoes.flatMap(({ titulo, texto }) => [
    ...(titulo ? [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(titulo)] })] : []),
    new Paragraph({ children: [new TextRun(texto)] }),
  ]);
  const caminho = path.join(dir, 'exemplo.docx');
  await fs.writeFile(caminho, await Packer.toBuffer(new Document({ sections: [{ children: filhos }] })));
  return caminho;
}

/** PPTX com um slide por item, com as notas do apresentador quando houver. */
export async function gerarPptx(dir: string, slides: { texto: string; notas?: string }[]): Promise<string> {
  const pptx = new PptxGenJS();
  for (const { texto, notas } of slides) {
    const slide = pptx.addSlide();
    if (texto) slide.addText(texto, { x: 1, y: 1, w: 8, h: 1 });
    if (notas) slide.addNotes(notas);
  }
  const caminho = path.join(dir, 'exemplo.pptx');
  await fs.writeFile(caminho, (await pptx.write({ outputType: 'nodebuffer' })) as Buffer);
  return caminho;
}

/** XLSX com uma aba por item. */
export async function gerarXlsx(dir: string, abas: { nome: string; linhas: (string | number)[][] }[]): Promise<string> {
  const pasta = new ExcelJS.Workbook();
  for (const { nome, linhas } of abas) pasta.addWorksheet(nome).addRows(linhas);
  const caminho = path.join(dir, 'exemplo.xlsx');
  await pasta.xlsx.writeFile(caminho);
  return caminho;
}
