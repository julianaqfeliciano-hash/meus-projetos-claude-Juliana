import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { lerDocumento } from './ler-documento';
import { gerarDocx, gerarPdf, gerarPptx, gerarXlsx } from './gerar-exemplos';

// PDF de 2 páginas com texto, criptografado (AES-128) com a senha "segredo".
const PDF_COM_SENHA = 'JVBERi0xLjcKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPDViN2VjNDUxMjUzNTJjNmFjY2Q3ZTY2Njg3YmUyNWM5OGI4ZjhiODI0ZjMxM2FhNzQ5MTY4YjMzMWE2ZTdkZDk+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMgovS2lkcyBbIDQgMCBSIDcgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0hlbHZldGljYS03MDk4NDgwNzg5IDUgMCBSCj4+Ci9YT2JqZWN0IDw8Cj4+Ci9FeHRHU3RhdGUgPDwKPj4KPj4KL01lZGlhQm94IFsgMCAwIDU5NS4yOCA4NDEuODkgXQovQW5ub3RzIFsgXQovQ29udGVudHMgWyA2IDAgUiBdCi9QYXJlbnQgMiAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCi9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9MZW5ndGggMTQ0Cj4+CnN0cmVhbQo2h3PMH6hMeU3PixcthcvT2bn0rcbrkM1AIfyaVGB5fg/4DPAUV24KDZruUy7g/ncUVXL4TgVjl+8/VKFdNYtXrg+St7HaCC0z3zlD+RWpph5/6Z5KUvhpVNcDyR2dN1mt9ZFEdwmIhuaSoZEPQ6mDF0J7qqs9kAf5ksn531fLSd/w887QOi90NK8tttzrauEKZW5kc3RyZWFtCmVuZG9iago3IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0hlbHZldGljYS05NzQyNjgyNTY4IDUgMCBSCj4+Ci9YT2JqZWN0IDw8Cj4+Ci9FeHRHU3RhdGUgPDwKPj4KPj4KL01lZGlhQm94IFsgMCAwIDU5NS4yOCA4NDEuODkgXQovQW5ub3RzIFsgXQovQ29udGVudHMgWyA4IDAgUiBdCi9QYXJlbnQgMiAwIFIKPj4KZW5kb2JqCjggMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAxNDQKPj4Kc3RyZWFtCnNlbrdokmTt/qYfrrVyuF0znk1/rdzofuyRZlkCUopOwxRzDW52JArcmR0JtO53UHrwk9ciMroEwHyrVQ+XbBsN//7eaS1PnFORAp1I5jlPXPJF9Asw1qor96THYI5gicGfCaeUQh+alMzGNu406ixSzfflK/G1oSmYEqJtpFyYy4XZPgxkgFgowGtpJbVkegplbmRzdHJlYW0KZW5kb2JqCjkgMCBvYmoKPDwKL1YgNAovUiA0Ci9MZW5ndGggMTI4Ci9QIDQyOTQ5NjcyOTIKL0ZpbHRlciAvU3RhbmRhcmQKL08gPDBhZmJhNWM3M2IxYjU3M2ZkNzIwYmYzMTU5ZWZmYThlODI0OTE3ODkyZTI3ZDZhNDM1ZmMwNjQ2MWM2M2I4MGQ+Ci9VIDxiM2M3ZDRjOTZiODMzZTVlYmY2YTQ1NmFhZmQ3ZTA2NjI4YmY0ZTVlNGU3NThhNDE2NDAwNGU1NmZmZmEwMTA4PgovQ0YgPDwKL1N0ZENGIDw8Ci9BdXRoRXZlbnQgL0RvY09wZW4KL0NGTSAvQUVTVjIKL0xlbmd0aCAxNgo+Pgo+PgovU3RtRiAvU3RkQ0YKL1N0ckYgL1N0ZENGCj4+CmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMTMgMDAwMDAgbiAKMDAwMDAwMDE3OCAwMDAwMCBuIAowMDAwMDAwMjI3IDAwMDAwIG4gCjAwMDAwMDA0MjcgMDAwMDAgbiAKMDAwMDAwMDUyNCAwMDAwMCBuIAowMDAwMDAwNzQwIDAwMDAwIG4gCjAwMDAwMDA5NDAgMDAwMDAgbiAKMDAwMDAwMTE1NiAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDEwCi9Sb290IDMgMCBSCi9JbmZvIDEgMCBSCi9JRCBbIDwzNjYyNjY2NDM0MzIzMzMwNjMzMjM5MzYzNTM3NjEzODM5NjUzNzMyNjY2NTM2MzU2MzM0MzAzNDYxMzMzNzY2PiA8MzY2MjY2NjQzNDMyMzMzMDYzMzIzOTM2MzUzNzYxMzgzOTY1MzczMjY2NjUzNjM1NjMzNDMwMzQ2MTMzMzc2Nj4gXQovRW5jcnlwdCA5IDAgUgo+PgpzdGFydHhyZWYKMTQ2MwolJUVPRgo=';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copiloto-docs-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('lerDocumento', () => {
  it('PDF: uma parte por página com rótulo', async () => {
    const doc = await lerDocumento(
      await gerarPdf(dir, ['Modulo Faturamento emite NF-e', 'Regra de rateio por centro de custo']),
    );
    expect(doc.aviso).toBeNull();
    expect(doc.tipo).toBe('pdf');
    expect(doc.nome).toBe('exemplo.pdf');
    expect(doc.partes.map((p) => p.rotulo)).toEqual(['p. 1', 'p. 2']);
    expect(doc.partes[1].texto).toContain('rateio');
  });

  it('PDF: páginas em branco são omitidas, mas a numeração é preservada', async () => {
    const texto = 'Pagina com bastante texto util para a reuniao de hoje';
    const doc = await lerDocumento(await gerarPdf(dir, [texto, '', texto]));
    expect(doc.aviso).toBeNull();
    expect(doc.partes.map((p) => p.rotulo)).toEqual(['p. 1', 'p. 3']);
  });

  it('PDF sem texto é marcado como digitalizado', async () => {
    const doc = await lerDocumento(await gerarPdf(dir, ['', '']));
    expect(doc.aviso).toBe('digitalizado');
    expect(doc.partes).toEqual([]);
  });

  it('PDF protegido por senha não lança', async () => {
    const caminho = path.join(dir, 'protegido.pdf');
    await fs.writeFile(caminho, Buffer.from(PDF_COM_SENHA, 'base64'));
    const doc = await lerDocumento(caminho);
    expect(doc.aviso).toBe('erro-leitura');
    expect(doc.tipo).toBe('pdf');
    expect(doc.partes).toEqual([]);
  });

  it('DOCX: divide por títulos', async () => {
    const doc = await lerDocumento(
      await gerarDocx(dir, [
        { titulo: 'Cadastro', texto: 'Cadastro de clientes' },
        { titulo: 'Faturamento', texto: 'Emissão de notas' },
      ]),
    );
    expect(doc.tipo).toBe('docx');
    expect(doc.partes.map((p) => p.rotulo)).toEqual(['Cadastro', 'Faturamento']);
    expect(doc.partes[0].texto).toContain('Cadastro de clientes');
    expect(doc.partes[1].texto).toContain('Emissão de notas');
  });

  it('DOCX: texto antes do primeiro título vira "seção 1" e entidades são decodificadas', async () => {
    const doc = await lerDocumento(
      await gerarDocx(dir, [
        { texto: 'Introdução: P&D <ok> "aspas"' },
        { titulo: 'Regras', texto: 'Regra 1' },
      ]),
    );
    expect(doc.partes.map((p) => p.rotulo)).toEqual(['seção 1', 'Regras']);
    expect(doc.partes[0].texto).toBe('Introdução: P&D <ok> "aspas"');
  });

  it('DOCX: sem títulos, divide em "seção N" e uma seção grande continua como "(cont.)"', async () => {
    const semTitulos = await lerDocumento(
      await gerarDocx(dir, [{ texto: 'Primeiro parágrafo' }, { texto: 'Segundo parágrafo' }]),
    );
    expect(semTitulos.partes.map((p) => p.rotulo)).toEqual(['seção 1']);

    const paragrafo = 'x'.repeat(2000);
    const grande = await lerDocumento(
      await gerarDocx(dir, [{ titulo: 'Longa', texto: paragrafo }, { texto: paragrafo }, { texto: paragrafo }]),
    );
    expect(grande.partes.map((p) => p.rotulo)).toEqual(['Longa', 'Longa (cont.)', 'Longa (cont.)']);
    expect(grande.partes.every((p) => p.texto.length <= 3000)).toBe(true);
  });

  it('DOCX: rótulo de título tem no máximo 60 caracteres', async () => {
    const doc = await lerDocumento(await gerarDocx(dir, [{ titulo: 'T'.repeat(100), texto: 'corpo' }]));
    expect(doc.partes[0].rotulo).toBe('T'.repeat(60));
  });

  it('PPTX: slides e notas', async () => {
    const doc = await lerDocumento(
      await gerarPptx(dir, [{ texto: 'Visão geral', notas: 'Falar do SLA' }, { texto: 'Integrações' }]),
    );
    expect(doc.tipo).toBe('pptx');
    expect(doc.partes.map((p) => p.rotulo)).toEqual(['slide 1', 'slide 2']);
    expect(doc.partes[0].texto).toContain('Visão geral');
    expect(doc.partes[0].texto).toContain('Notas: Falar do SLA');
    expect(doc.partes[1].texto).not.toContain('Notas');
  });

  it('PPTX: decodifica entidades XML e ignora o número do slide nas notas', async () => {
    const doc = await lerDocumento(await gerarPptx(dir, [{ texto: 'P&D <ok> "aspas"', notas: 'Custo & prazo' }]));
    expect(doc.partes).toEqual([{ rotulo: 'slide 1', texto: 'P&D <ok> "aspas"\nNotas: Custo & prazo' }]);
  });

  it('PPTX: slide sem relação de notas é lido sem notas', async () => {
    const caminho = await gerarPptx(dir, [{ texto: 'Visão geral', notas: 'Falar do SLA' }, { texto: 'Integrações' }]);
    const zip = await JSZip.loadAsync(await fs.readFile(caminho));
    zip.remove('ppt/slides/_rels/slide1.xml.rels');
    zip.remove('ppt/notesSlides/notesSlide2.xml');
    await fs.writeFile(caminho, await zip.generateAsync({ type: 'nodebuffer' }));

    const doc = await lerDocumento(caminho);
    expect(doc.aviso).toBeNull();
    expect(doc.partes).toEqual([
      { rotulo: 'slide 1', texto: 'Visão geral' },
      { rotulo: 'slide 2', texto: 'Integrações' },
    ]);
  });

  describe('PPTX: ordem da apresentação', () => {
    /** Reescreve o pptx gerado, trocando a ordem dos `<p:sldId>` de presentation.xml (índices da nova ordem). */
    async function reordenar(caminho: string, ordem: number[]): Promise<void> {
      const zip = await JSZip.loadAsync(await fs.readFile(caminho));
      const xml = await zip.file('ppt/presentation.xml')!.async('string');
      const entradas = xml.match(/<p:sldId\b[^>]*\/>/g)!;
      const lista = ordem.map((i) => entradas[i]).join('');
      zip.file('ppt/presentation.xml', xml.replace(/(<p:sldIdLst>)[\s\S]*?(<\/p:sldIdLst>)/, `$1${lista}$2`));
      await fs.writeFile(caminho, await zip.generateAsync({ type: 'nodebuffer' }));
    }

    it('rotula pela posição na apresentação, não pelo número do arquivo, e as notas acompanham o slide', async () => {
      const caminho = await gerarPptx(dir, [{ texto: 'Alfa', notas: 'Nota do alfa' }, { texto: 'Beta' }, { texto: 'Gama' }]);
      await reordenar(caminho, [1, 0, 2]);
      const doc = await lerDocumento(caminho);
      expect(doc.partes).toEqual([
        { rotulo: 'slide 1', texto: 'Beta' },
        { rotulo: 'slide 2', texto: 'Alfa\nNotas: Nota do alfa' },
        { rotulo: 'slide 3', texto: 'Gama' },
      ]);
    });

    it('slides vazios ocupam posição mesmo omitidos', async () => {
      const caminho = await gerarPptx(dir, [{ texto: 'Um' }, { texto: '' }, { texto: 'Três' }]);
      await reordenar(caminho, [2, 1, 0]);
      const doc = await lerDocumento(caminho);
      expect(doc.partes).toEqual([
        { rotulo: 'slide 1', texto: 'Três' },
        { rotulo: 'slide 3', texto: 'Um' },
      ]);
    });

    it('slide que não está na lista da apresentação é ignorado', async () => {
      const caminho = await gerarPptx(dir, [{ texto: 'Um' }, { texto: 'Dois' }, { texto: 'Três' }]);
      await reordenar(caminho, [0, 2]);
      const doc = await lerDocumento(caminho);
      expect(doc.partes).toEqual([
        { rotulo: 'slide 1', texto: 'Um' },
        { rotulo: 'slide 2', texto: 'Três' },
      ]);
    });

    describe('apresentação personalizada (custShow)', () => {
      const CUSTSHOW =
        '<p:custShowLst><p:custShow name="Resumo" id="0"><p:sldLst><p:sldId r:id="rId4"/><p:sldId r:id="rId2"/></p:sldLst></p:custShow></p:custShowLst>';

      async function comCustShow(caminho: string, semListaDeSlides: boolean): Promise<void> {
        const zip = await JSZip.loadAsync(await fs.readFile(caminho));
        let xml = await zip.file('ppt/presentation.xml')!.async('string');
        if (semListaDeSlides) xml = xml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, '');
        zip.file('ppt/presentation.xml', xml.replace('</p:presentation>', `${CUSTSHOW}</p:presentation>`));
        await fs.writeFile(caminho, await zip.generateAsync({ type: 'nodebuffer' }));
      }

      it('as entradas da apresentação personalizada não viram slides extras', async () => {
        const caminho = await gerarPptx(dir, [{ texto: 'Alfa' }, { texto: 'Beta' }, { texto: 'Gama' }]);
        await comCustShow(caminho, false);
        const doc = await lerDocumento(caminho);
        expect(doc.partes).toEqual([
          { rotulo: 'slide 1', texto: 'Alfa' },
          { rotulo: 'slide 2', texto: 'Beta' },
          { rotulo: 'slide 3', texto: 'Gama' },
        ]);
      });

      it('sem a lista de slides, só com a personalizada, volta para a ordem numérica', async () => {
        const caminho = await gerarPptx(dir, [{ texto: 'Alfa' }, { texto: 'Beta' }, { texto: 'Gama' }]);
        await comCustShow(caminho, true);
        const doc = await lerDocumento(caminho);
        expect(doc.partes.map((p) => p.texto)).toEqual(['Alfa', 'Beta', 'Gama']);
      });
    });

    it.each([
      ['sem presentation.xml', (zip: JSZip) => zip.remove('ppt/presentation.xml')],
      ['sem presentation.xml.rels', (zip: JSZip) => zip.remove('ppt/_rels/presentation.xml.rels')],
      [
        'com r:id que não existe no .rels',
        (zip: JSZip) => {
          zip.file('ppt/_rels/presentation.xml.rels', '<Relationships></Relationships>');
        },
      ],
      [
        'com presentation.xml malformado',
        (zip: JSZip) => {
          zip.file('ppt/presentation.xml', '<p:presentation><p:sldIdLst');
        },
      ],
    ])('volta para a ordem numérica dos arquivos %s', async (_nome, quebrar) => {
      const caminho = await gerarPptx(dir, [{ texto: 'Um' }, { texto: 'Dois' }, { texto: 'Três' }]);
      const zip = await JSZip.loadAsync(await fs.readFile(caminho));
      quebrar(zip);
      await fs.writeFile(caminho, await zip.generateAsync({ type: 'nodebuffer' }));
      const doc = await lerDocumento(caminho);
      expect(doc.aviso).toBeNull();
      expect(doc.partes).toEqual([
        { rotulo: 'slide 1', texto: 'Um' },
        { rotulo: 'slide 2', texto: 'Dois' },
        { rotulo: 'slide 3', texto: 'Três' },
      ]);
    });
  });

  it('PPTX: slides vazios são omitidos', async () => {
    const doc = await lerDocumento(await gerarPptx(dir, [{ texto: 'Um' }, { texto: '' }, { texto: 'Três' }]));
    expect(doc.partes.map((p) => p.rotulo)).toEqual(['slide 1', 'slide 3']);
  });

  it('XLSX: uma parte por aba', async () => {
    const doc = await lerDocumento(
      await gerarXlsx(dir, [{ nome: 'Impostos', linhas: [['ICMS', 18], ['ISS', 5]] }]),
    );
    expect(doc.tipo).toBe('xlsx');
    expect(doc.partes).toEqual([{ rotulo: 'aba Impostos', texto: 'ICMS; 18\nISS; 5' }]);
  });

  it('XLSX: abas e linhas vazias são omitidas', async () => {
    const doc = await lerDocumento(
      await gerarXlsx(dir, [
        { nome: 'Vazia', linhas: [] },
        { nome: 'Dados', linhas: [['a', 'b'], ['', ''], ['c', 'd']] },
      ]),
    );
    expect(doc.partes).toEqual([{ rotulo: 'aba Dados', texto: 'a; b\nc; d' }]);
  });

  it('formato antigo', async () => {
    for (const [nome, tipo] of [['velho.doc', 'outro'], ['velha.xls', 'outro'], ['velho.ppt', 'outro']] as const) {
      const doc = await lerDocumento(path.join(dir, nome));
      expect(doc.aviso).toBe('formato-antigo');
      expect(doc.tipo).toBe(tipo);
      expect(doc.partes).toEqual([]);
      expect(doc.nome).toBe(nome);
    }
  });

  it('extensão desconhecida não é suportada', async () => {
    const doc = await lerDocumento(path.join(dir, 'imagem.PNG'));
    expect(doc.aviso).toBe('nao-suportado');
    expect(doc.tipo).toBe('outro');
    expect(doc.nome).toBe('imagem.PNG');
  });

  it('escolhe o leitor pela extensão em minúsculas', async () => {
    const caminho = path.join(dir, 'NOTAS.TXT');
    await fs.writeFile(caminho, 'olá');
    const doc = await lerDocumento(caminho);
    expect(doc.tipo).toBe('texto');
    expect(doc.partes).toEqual([{ rotulo: 'parte 1', texto: 'olá' }]);
  });

  it('arquivo inexistente não lança', async () => {
    const doc = await lerDocumento(path.join(dir, 'nao.pdf'));
    expect(doc.aviso).toBe('erro-leitura');
    expect(doc.tipo).toBe('pdf');
    expect(doc.partes).toEqual([]);
  });

  it('arquivo corrompido não lança', async () => {
    for (const nome of ['ruim.pdf', 'ruim.docx', 'ruim.pptx', 'ruim.xlsx']) {
      const caminho = path.join(dir, nome);
      await fs.writeFile(caminho, 'isto não é um documento de verdade');
      const doc = await lerDocumento(caminho);
      expect(doc.aviso, nome).toBe('erro-leitura');
      expect(doc.partes, nome).toEqual([]);
    }
  });

  it('TXT com BOM', async () => {
    await fs.writeFile(path.join(dir, 'a.txt'), '\uFEFFolá');
    expect((await lerDocumento(path.join(dir, 'a.txt'))).partes).toEqual([{ rotulo: 'parte 1', texto: 'olá' }]);
  });

  it('MD longo é dividido em partes numeradas', async () => {
    const paragrafo = 'y'.repeat(2000);
    await fs.writeFile(path.join(dir, 'b.md'), `${paragrafo}\n\n${paragrafo}`);
    const doc = await lerDocumento(path.join(dir, 'b.md'));
    expect(doc.partes.map((p) => p.rotulo)).toEqual(['parte 1', 'parte 2']);
  });
});
