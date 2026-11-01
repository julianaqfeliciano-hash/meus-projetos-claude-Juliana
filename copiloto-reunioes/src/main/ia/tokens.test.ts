import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentoLido } from '../../shared/tipos';
import { MODELO_DETECTOR } from './modelos';
import { contarTokensDocumentos } from './tokens';
import { criarClienteFalso, docManual } from './apoio-testes';

const docCom = (nome: string, textos: string[], aviso: DocumentoLido['aviso'] = null): DocumentoLido => ({
  caminho: nome,
  nome,
  tipo: 'texto',
  aviso,
  partes: textos.map((texto, i) => ({ rotulo: `parte ${i + 1}`, texto })),
});

let falso: ReturnType<typeof criarClienteFalso>;
beforeEach(() => {
  falso = criarClienteFalso();
});

describe('contarTokensDocumentos', () => {
  it('contagem usa a API', async () => {
    falso.countTokens.mockResolvedValue({ input_tokens: 1234 });
    expect(await contarTokensDocumentos(falso.cliente, [docManual])).toEqual({ tokens: 1234, estimado: false });
  });

  it('manda os documentos como o detector os enviaria, mais um texto mínimo', async () => {
    falso.countTokens.mockResolvedValue({ input_tokens: 10 });
    await contarTokensDocumentos(falso.cliente, [docManual]);
    const args = falso.countTokens.mock.calls[0][0];
    expect(args.model).toBe(MODELO_DETECTOR);
    expect(args.messages).toHaveLength(1);
    const conteudo = args.messages[0].content;
    expect(args.messages[0].role).toBe('user');
    expect(conteudo).toHaveLength(2);
    expect(conteudo[0]).toMatchObject({ type: 'document', title: 'Manual.pdf', source: { type: 'content' } });
    expect(conteudo[1]).toEqual({ type: 'text', text: '.' });
    expect(args.system).toBeUndefined();
  });

  it('contagem cai para estimativa quando a API falha', async () => {
    falso.countTokens.mockRejectedValue(new Error('offline'));
    expect(await contarTokensDocumentos(falso.cliente, [docCom('a.txt', ['x'.repeat(3000)])])).toEqual({
      tokens: 1000,
      estimado: true,
    });
  });

  it('a estimativa arredonda para cima e soma só os documentos sem aviso', async () => {
    falso.countTokens.mockRejectedValue(new Error('offline'));
    const docs = [
      docCom('a.txt', ['x'.repeat(1000), 'y'.repeat(1002)]),
      docCom('b.pdf', ['z'.repeat(5000)], 'digitalizado'),
    ];
    expect(await contarTokensDocumentos(falso.cliente, docs)).toEqual({ tokens: 668, estimado: true });
  });

  it('lista vazia devolve zero sem chamar a API', async () => {
    expect(await contarTokensDocumentos(falso.cliente, [])).toEqual({ tokens: 0, estimado: false });
    expect(falso.countTokens).not.toHaveBeenCalled();
  });

  it('sem nenhum documento válido devolve zero sem chamar a API', async () => {
    const docs = [docCom('scan.pdf', ['texto'], 'digitalizado'), docCom('vazio.txt', [])];
    expect(await contarTokensDocumentos(falso.cliente, docs)).toEqual({ tokens: 0, estimado: false });
    expect(falso.countTokens).not.toHaveBeenCalled();
  });
});
