import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ItemHistorico, ResumoItemHistorico } from '../../shared/tipos';
import { gravarAtomico } from '../config/gravar-atomico';

export interface Historico {
  listar(): Promise<ResumoItemHistorico[]>;
  obter(id: string): Promise<ItemHistorico | null>;
  salvar(item: ItemHistorico): Promise<void>;
  apagar(id: string): Promise<void>;
}

const PASTA = 'historico';
const EXTENSAO = '.json';
const ID_VALIDO = /^[a-z0-9-]{1,64}$/;
const TAMANHO_MAXIMO_TITULO = 60;
const TITULO_REUNIAO = 'Reunião';
const TITULO_TREINO = 'Treino de entrevista';

const idValido = (id: string): boolean => ID_VALIDO.test(id);

function validarId(id: string): void {
  if (!idValido(id)) throw new Error('id inválido');
}

function ehItem(valor: unknown, idEsperado: string): valor is ItemHistorico {
  if (typeof valor !== 'object' || valor === null) return false;
  const { id, tipo, data, contexto } = valor as Record<string, unknown>;
  if (id !== idEsperado || typeof data !== 'string') return false;
  // O título da reunião sai do contexto, então ele precisa ser texto.
  return tipo === 'treino' || (tipo === 'reuniao' && typeof contexto === 'string');
}

function titulo(item: ItemHistorico): string {
  if (item.tipo === 'treino') return TITULO_TREINO;
  const linha = item.contexto.split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '');
  // Array.from corta por caractere inteiro, sem partir um emoji ao meio.
  return linha === undefined ? TITULO_REUNIAO : Array.from(linha).slice(0, TAMANHO_MAXIMO_TITULO).join('');
}

export function criarHistorico(dir: string): Historico {
  const pasta = path.join(dir, PASTA);
  const arquivoDe = (id: string): string => path.join(pasta, `${id}${EXTENSAO}`);

  // Arquivo ausente, ilegível, com JSON inválido ou sem a forma de um item vale como "não existe".
  async function ler(id: string): Promise<ItemHistorico | null> {
    try {
      const lido: unknown = JSON.parse(await fs.readFile(arquivoDe(id), 'utf8'));
      return ehItem(lido, id) ? lido : null;
    } catch {
      return null;
    }
  }

  return {
    async listar() {
      let nomes: string[];
      try {
        nomes = await fs.readdir(pasta);
      } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw erro;
      }
      const ids = nomes.filter((n) => n.endsWith(EXTENSAO)).map((n) => n.slice(0, -EXTENSAO.length)).filter(idValido);
      const itens = await Promise.all(ids.map(ler));
      return itens
        .filter((item): item is ItemHistorico => item !== null)
        .map((item) => ({ id: item.id, tipo: item.tipo, data: item.data, titulo: titulo(item) }))
        .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
    },

    async obter(id) {
      return idValido(id) ? ler(id) : null;
    },

    async salvar(item) {
      validarId(item.id);
      await gravarAtomico(arquivoDe(item.id), JSON.stringify(item, null, 2));
    },

    async apagar(id) {
      validarId(id);
      await fs.rm(arquivoDe(id), { force: true });
    },
  };
}
