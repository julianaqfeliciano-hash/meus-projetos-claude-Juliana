import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ItemHistoricoReuniao, ItemHistoricoTreino } from '../../shared/tipos';
import { criarHistorico, type Historico } from './historico';

let dir: string;
let h: Historico;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copiloto-historico-'));
  h = criarHistorico(dir);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function reuniao(id: string, data: string): ItemHistoricoReuniao {
  return {
    id,
    tipo: 'reuniao',
    data,
    duracaoMin: 30,
    contexto: '',
    documentos: [],
    resumo: null,
    conceitos: [],
  };
}

function treino(id: string, data: string): ItemHistoricoTreino {
  return {
    id,
    tipo: 'treino',
    data,
    idioma: 'en',
    tipoEntrevista: 'mista',
    vagaResumo: 'Analista',
    perguntas: ['Fale sobre você'],
    relatorio: { pontosFortes: ['clareza'], aTreinar: ['exemplos'], perguntasMaisFracas: [] },
  };
}

const pastaHistorico = (): string => path.join(dir, 'historico');
const escrever = (nome: string, conteudo: string): void => {
  fs.mkdirSync(pastaHistorico(), { recursive: true });
  fs.writeFileSync(path.join(pastaHistorico(), nome), conteudo);
};

describe('histórico', () => {
  it('salva, lista em ordem e obtém', async () => {
    await h.salvar(reuniao('a', '2026-10-01T10:00:00Z'));
    await h.salvar(reuniao('b', '2026-10-02T10:00:00Z'));
    expect((await h.listar()).map((i) => i.id)).toEqual(['b', 'a']);
    expect((await h.obter('a'))?.id).toBe('a');
  });

  it('apagar remove o arquivo', async () => {
    await h.salvar(reuniao('a', '2026-10-01T10:00:00Z'));
    await h.apagar('a');
    expect(await h.obter('a')).toBeNull();
    expect(fs.existsSync(path.join(dir, 'historico', 'a.json'))).toBe(false);
  });

  it('recusa id com caminho', async () => {
    await expect(h.apagar('../config')).rejects.toThrow('id inválido');
    expect(await h.obter('../x')).toBeNull();
  });

  it('título vem do contexto', async () => {
    await h.salvar({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto: 'Hospital X\nfaturamento' });
    expect((await h.listar())[0].titulo).toBe('Hospital X');
  });

  describe('títulos', () => {
    const tituloDe = async (item: ItemHistoricoReuniao | ItemHistoricoTreino): Promise<string> => {
      await h.salvar(item);
      return (await h.listar())[0].titulo;
    };

    it('reunião sem contexto se chama "Reunião"', async () => {
      expect(await tituloDe(reuniao('a', '2026-10-01T10:00:00Z'))).toBe('Reunião');
    });

    it('reunião com contexto só de espaços e quebras de linha se chama "Reunião"', async () => {
      expect(await tituloDe({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto: ' \n\t\r\n  ' })).toBe('Reunião');
    });

    it('usa a primeira linha não vazia, sem espaços nas pontas', async () => {
      const contexto = '\r\n   \r\n  Clínica Y  \r\nsegunda linha';
      expect(await tituloDe({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto })).toBe('Clínica Y');
    });

    it('corta em 60 caracteres', async () => {
      const contexto = 'x'.repeat(100);
      expect(await tituloDe({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto })).toBe('x'.repeat(60));
    });

    it('mantém uma linha de exatamente 60 caracteres', async () => {
      const contexto = 'y'.repeat(60);
      expect(await tituloDe({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto })).toBe(contexto);
    });

    it('não parte um caractere de dois códigos ao cortar', async () => {
      const contexto = `${'z'.repeat(59)}😀😀`;
      expect(await tituloDe({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto })).toBe(`${'z'.repeat(59)}😀`);
    });

    it('treino se chama "Treino de entrevista"', async () => {
      expect(await tituloDe(treino('t', '2026-10-01T10:00:00Z'))).toBe('Treino de entrevista');
    });
  });

  describe('listar', () => {
    it('sem a pasta histórico devolve lista vazia', async () => {
      expect(await h.listar()).toEqual([]);
    });

    it('devolve só o resumo de cada item, misturando reuniões e treinos', async () => {
      await h.salvar(reuniao('a', '2026-10-01T10:00:00Z'));
      await h.salvar(treino('t', '2026-10-03T10:00:00Z'));
      expect(await h.listar()).toEqual([
        { id: 't', tipo: 'treino', data: '2026-10-03T10:00:00Z', titulo: 'Treino de entrevista' },
        { id: 'a', tipo: 'reuniao', data: '2026-10-01T10:00:00Z', titulo: 'Reunião' },
      ]);
    });

    it('ordena da mais recente para a mais antiga, qualquer que seja a ordem de gravação', async () => {
      await h.salvar(reuniao('meio', '2026-10-02T10:00:00Z'));
      await h.salvar(reuniao('novo', '2026-10-03T10:00:00.000Z'));
      await h.salvar(reuniao('velho', '2026-10-01T10:00:00Z'));
      expect((await h.listar()).map((i) => i.id)).toEqual(['novo', 'meio', 'velho']);
    });

    it('ignora o que não é item válido, sem lançar erro', async () => {
      await h.salvar(reuniao('ok', '2026-10-01T10:00:00Z'));
      escrever('leia-me.txt', 'não sou json');
      escrever('quebrado.json', '{oops');
      escrever('nulo.json', 'null');
      escrever('lista.json', '[]');
      escrever('sem-id.json', JSON.stringify({ tipo: 'reuniao', data: '2026-10-05T10:00:00Z' }));
      escrever('sem-tipo.json', JSON.stringify({ id: 'sem-tipo', data: '2026-10-05T10:00:00Z' }));
      escrever('sem-data.json', JSON.stringify({ id: 'sem-data', tipo: 'reuniao' }));
      escrever('sem-contexto.json', JSON.stringify({ id: 'sem-contexto', tipo: 'reuniao', data: '2026-10-05T10:00:00Z' }));
      escrever('tipo-estranho.json', JSON.stringify({ id: 'tipo-estranho', tipo: 'outro', data: '2026-10-05T10:00:00Z' }));
      escrever('id-trocado.json', JSON.stringify(reuniao('outro-id', '2026-10-05T10:00:00Z')));
      fs.mkdirSync(path.join(pastaHistorico(), 'pasta.json'));
      expect((await h.listar()).map((i) => i.id)).toEqual(['ok']);
    });

    it('não mostra arquivos temporários da gravação atômica', async () => {
      await h.salvar(reuniao('ok', '2026-10-01T10:00:00Z'));
      escrever(
        'novo.json.123.0b6f9f1e-0000-4000-8000-000000000000.tmp',
        JSON.stringify(reuniao('novo', '2026-10-09T10:00:00Z')),
      );
      expect((await h.listar()).map((i) => i.id)).toEqual(['ok']);
    });
  });

  describe('obter', () => {
    it('devolve o item inteiro como foi salvo', async () => {
      const item: ItemHistoricoReuniao = {
        ...reuniao('abc-123', '2026-10-01T10:00:00Z'),
        contexto: 'Contexto\ncom linhas',
        documentos: ['proposta.pdf'],
        resumo: { assuntos: ['a'], duvidasCliente: ['b'], decisoes: ['c'], pendencias: ['d'], proximosPassos: ['e'] },
        conceitos: [{ termo: 'SLA', explicacao: 'Acordo de nível de serviço', fontes: [{ arquivo: 'proposta.pdf', local: 'p. 2' }] }],
      };
      const t = treino('treino-1', '2026-10-02T10:00:00Z');
      await h.salvar(item);
      await h.salvar(t);
      expect(await h.obter('abc-123')).toEqual(item);
      expect(await h.obter('treino-1')).toEqual(t);
    });

    it('id que não existe devolve null', async () => {
      expect(await h.obter('nao-existe')).toBeNull();
    });

    it('arquivo corrompido devolve null', async () => {
      escrever('ruim.json', '{oops');
      expect(await h.obter('ruim')).toBeNull();
    });

    it('arquivo sem os campos de item devolve null', async () => {
      escrever('vazio.json', '{}');
      expect(await h.obter('vazio')).toBeNull();
    });

    it('arquivo cujo id interno é outro devolve null', async () => {
      escrever('a.json', JSON.stringify(reuniao('b', '2026-10-01T10:00:00Z')));
      expect(await h.obter('a')).toBeNull();
    });
  });

  describe('salvar', () => {
    it('sobrescreve o item de mesmo id', async () => {
      await h.salvar(reuniao('a', '2026-10-01T10:00:00Z'));
      await h.salvar({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto: 'Novo' });
      expect(await h.listar()).toHaveLength(1);
      expect((await h.obter('a') as ItemHistoricoReuniao).contexto).toBe('Novo');
    });

    it('grava em <dir>/historico/<id>.json, sem deixar arquivo temporário', async () => {
      await h.salvar(reuniao('a', '2026-10-01T10:00:00Z'));
      await h.salvar(reuniao('a', '2026-10-02T10:00:00Z'));
      expect(fs.readdirSync(path.join(dir, 'historico'))).toEqual(['a.json']);
    });

    it('aceita um UUID como id', async () => {
      const id = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
      await h.salvar(reuniao(id, '2026-10-01T10:00:00Z'));
      expect((await h.obter(id))?.id).toBe(id);
    });
  });

  describe('apagar', () => {
    it('id válido que não existe termina sem erro', async () => {
      await expect(h.apagar('nao-existe')).resolves.toBeUndefined();
    });

    it('só apaga o item pedido', async () => {
      await h.salvar(reuniao('a', '2026-10-01T10:00:00Z'));
      await h.salvar(reuniao('b', '2026-10-02T10:00:00Z'));
      await h.apagar('a');
      expect((await h.listar()).map((i) => i.id)).toEqual(['b']);
    });
  });

  describe('validação do id', () => {
    const invalidos = ['', '../config', '..', 'a/b', 'a\\b', 'A', 'a.b', 'a b', 'a.json', 'a'.repeat(65)];

    it.each(invalidos)('salvar lança "id inválido" para %j e não cria nada', async (id) => {
      await expect(h.salvar(reuniao(id, '2026-10-01T10:00:00Z'))).rejects.toThrow('id inválido');
      expect(fs.existsSync(path.join(dir, 'historico'))).toBe(false);
    });

    it.each(invalidos)('apagar lança "id inválido" para %j', async (id) => {
      await expect(h.apagar(id)).rejects.toThrow('id inválido');
    });

    it.each(invalidos)('obter devolve null para %j', async (id) => {
      expect(await h.obter(id)).toBeNull();
    });

    it('aceita id de 64 caracteres', async () => {
      const id = 'a'.repeat(64);
      await h.salvar(reuniao(id, '2026-10-01T10:00:00Z'));
      expect((await h.obter(id))?.id).toBe(id);
    });

    it('apagar com id inválido não remove arquivos fora da pasta do histórico', async () => {
      fs.writeFileSync(path.join(dir, 'config.json'), '{}');
      await expect(h.apagar('../config')).rejects.toThrow('id inválido');
      expect(fs.existsSync(path.join(dir, 'config.json'))).toBe(true);
    });
  });
});
