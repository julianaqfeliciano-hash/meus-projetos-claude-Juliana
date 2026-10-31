// src/shared/textos.test.ts
import { describe, it, expect } from 'vitest';
import { mensagemAviso, TEXTO_AVISO } from './textos';
describe('textos', () => {
  it('mensagem de PDF digitalizado', () => {
    expect(mensagemAviso('digitalizado')).toBe('Não foi possível ler o texto (PDF digitalizado?)');
  });
  it('todo tipo de aviso tem texto', () => {
    for (const t of ['sem-som-outros', 'pausa-automatica', 'chave', 'cota', 'windows-antigo', 'resumo-falhou', 'erro-ia', 'atalho-recusado'] as const)
      expect(TEXTO_AVISO[t].length).toBeGreaterThan(10);
  });
});
