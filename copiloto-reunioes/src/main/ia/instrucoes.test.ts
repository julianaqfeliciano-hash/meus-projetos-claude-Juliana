import { describe, it, expect } from 'vitest';
import type { IdiomaSugestao } from '../../shared/tipos';
import { instrucoes } from './instrucoes';
import { MARCADORES } from './interpretar-cartao';
import type { Papel } from './prefixo';

const PAPEIS: Papel[] = ['detector', 'explicador', 'resumo'];
const IDIOMAS: IdiomaSugestao[] = ['auto', 'pt', 'en'];
const palavras = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe('instrucoes', () => {
  it('explicador cita todos os marcadores', () => {
    const t = instrucoes('explicador', 'auto');
    for (const m of Object.values(MARCADORES)) expect(t).toContain(m);
  });

  it('idioma fixo em inglês aparece na instrução', () => {
    expect(instrucoes('explicador', 'en')).toMatch(/inglês/i);
  });

  it('em inglês, "Diga isso" e "Como explicar ao cliente" saem em inglês; explicação e resposta em português', () => {
    const t = instrucoes('explicador', 'en');
    expect(t).toMatch(/DIGA ISSO:[^.]*e[^.]*COMO EXPLICAR AO CLIENTE:[^.]*em inglês/);
    expect(t).toMatch(/EXPLICAÇÃO:[^.]*RESPOSTA:[^.]*português|RESPOSTA:[^.]*EXPLICAÇÃO:[^.]*português/);
  });

  it('em português fixo, os campos saem em português e o inglês nem é citado', () => {
    const t = instrucoes('explicador', 'pt');
    expect(t).toMatch(/português/i);
    expect(t).not.toMatch(/inglês/i);
  });

  it('automático usa o idioma da conversa e não fixa idioma', () => {
    const t = instrucoes('explicador', 'auto');
    expect(t).toMatch(/idioma da conversa/i);
    expect(t).not.toMatch(/inglês/i);
  });

  it('as três regras de idioma são diferentes entre si', () => {
    const textos = IDIOMAS.map((i) => instrucoes('explicador', i));
    expect(new Set(textos).size).toBe(3);
  });

  it('explicador descreve a forma dos campos', () => {
    const t = instrucoes('explicador', 'auto');
    expect(t).toMatch(/primeira pessoa/i);
    expect(t).toMatch(/2 a 4 frases/);
    expect(t).toMatch(/2 ou 3 frases/);
    expect(t).toMatch(/1 ou 2 frases/);
    expect(t).toMatch(/conhecimento geral/i);
    expect(t).toMatch(/documentos/i);
  });

  it('TÍTULO: é o primeiro marcador em cada formato de cartão', () => {
    const t = instrucoes('explicador', 'auto');
    expect(t.indexOf(MARCADORES.titulo)).toBeGreaterThanOrEqual(0);
    expect(t.indexOf(MARCADORES.titulo)).toBeLessThan(t.indexOf(MARCADORES.digaIsso));
    expect(t.indexOf(MARCADORES.titulo)).toBeLessThan(t.indexOf(MARCADORES.explicacao));
    expect(t.indexOf(MARCADORES.titulo)).toBeLessThan(t.indexOf(MARCADORES.resposta));
  });

  it('detector define pergunta e conceito e limita a 2 itens', () => {
    const t = instrucoes('detector', 'auto');
    expect(t).toMatch(/pergunta/i);
    expect(t).toMatch(/conceito/i);
    expect(t).toContain('[Outros]');
    expect(t).toMatch(/diretamente/i);
    expect(t).toMatch(/no máximo 2/i);
    expect(t).toMatch(/já cobertos/i);
    expect(t).toMatch(/melhor não devolver nada/i);
  });

  it('detector e resumo não dependem do idioma escolhido', () => {
    for (const papel of ['detector', 'resumo'] as const) {
      expect(instrucoes(papel, 'en')).toBe(instrucoes(papel, 'auto'));
      expect(instrucoes(papel, 'pt')).toBe(instrucoes(papel, 'auto'));
    }
  });

  it('resumo é em português e cobre os cinco grupos', () => {
    const t = instrucoes('resumo', 'auto');
    expect(t).toMatch(/português/i);
    for (const termo of [/assuntos/i, /dúvidas do cliente/i, /decisões/i, /pendências/i, /próximos passos/i]) expect(t).toMatch(termo);
  });

  it.each(PAPEIS)('%s: texto focado, sem data, hora nem identificador, e estável', (papel) => {
    for (const idioma of IDIOMAS) {
      const t = instrucoes(papel, idioma);
      expect(t).toBe(instrucoes(papel, idioma));
      expect(palavras(t)).toBeGreaterThanOrEqual(150);
      expect(palavras(t)).toBeLessThanOrEqual(400);
      expect(t).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(t).not.toMatch(/\d{1,2}:\d{2}/);
      expect(t).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
  });

  it('só o explicador usa os marcadores de cartão', () => {
    for (const papel of ['detector', 'resumo'] as const) {
      for (const m of Object.values(MARCADORES)) expect(instrucoes(papel, 'auto')).not.toContain(m);
    }
  });
});
