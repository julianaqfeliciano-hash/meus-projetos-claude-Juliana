import ExcelJS from 'exceljs';
import type { ParteDoc } from '../../shared/tipos';

/** Cada aba com conteúdo vira uma parte "aba <nome>": uma linha por linha não vazia, valores separados por "; ". */
export async function lerXlsx(buf: Uint8Array): Promise<ParteDoc[]> {
  const pasta = new ExcelJS.Workbook();
  // O tipo `Buffer` do exceljs é mais antigo que o do @types/node; em tempo de execução é o mesmo Buffer.
  await pasta.xlsx.load(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength) as unknown as ExcelJS.Buffer);

  const partes: ParteDoc[] = [];
  pasta.eachSheet((aba) => {
    const linhas: string[] = [];
    aba.eachRow({ includeEmpty: false }, (linha) => {
      const valores: string[] = [];
      linha.eachCell({ includeEmpty: false }, (celula) => {
        if (celula.text !== '') valores.push(celula.text);
      });
      if (valores.length > 0) linhas.push(valores.join('; '));
    });
    if (linhas.length > 0) partes.push({ rotulo: `aba ${aba.name}`, texto: linhas.join('\n') });
  });
  return partes;
}
