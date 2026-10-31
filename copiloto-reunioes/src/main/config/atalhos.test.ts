import { describe, it, expect } from 'vitest';
import { ATALHOS_PADRAO, normalizarAtalho, validarAtalhos } from './atalhos';

describe('normalizarAtalho', () => {
  it('normaliza Ctrl e ordem', () => {
    expect(normalizarAtalho('alt+ctrl+x')).toBe('Control+Alt+X');
  });
  it('trata CommandOrControl e CmdOrCtrl como Control', () => {
    expect(normalizarAtalho('CommandOrControl+Shift+k')).toBe('Control+Shift+K');
    expect(normalizarAtalho('CmdOrCtrl+d')).toBe('Control+D');
  });
  it('coloca os modificadores na ordem Control, Alt, Shift', () => {
    expect(normalizarAtalho('Shift+Alt+Ctrl+m')).toBe('Control+Alt+Shift+M');
  });
  it('converte Espaço e space em Space', () => {
    expect(normalizarAtalho('ctrl+alt+Espaço')).toBe('Control+Alt+Space');
    expect(normalizarAtalho('Ctrl+Alt+space')).toBe('Control+Alt+Space');
  });
  it('mantém a pontuação como está', () => {
    expect(normalizarAtalho('Ctrl+Alt+,')).toBe('Control+Alt+,');
    expect(normalizarAtalho('ctrl+alt+.')).toBe('Control+Alt+.');
  });
  it('não altera um atalho já normalizado', () => {
    for (const a of Object.values(ATALHOS_PADRAO)) expect(normalizarAtalho(a)).toBe(a);
  });
});

describe('validarAtalhos', () => {
  it('padrões são todos válidos', () => {
    expect(Object.values(validarAtalhos(ATALHOS_PADRAO)).every((e) => e === null)).toBe(true);
  });
  it('recusa conflito com o Meet', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, pausar: 'Ctrl+Alt+P' }).pausar).toBe('Usado pelo Google Meet');
  });
  it('recusa conflito com o Teams', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, pausar: 'Control+Shift+M' }).pausar).toBe('Usado pelo Microsoft Teams');
  });
  it('reconhece o conflito mesmo escrito de outra forma', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, pausar: 'shift+ctrl+m' }).pausar).toBe('Usado pelo Microsoft Teams');
  });
  it('recusa AltGr do ABNT2', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+Q' }).explicar).toBe('Gera um símbolo no teclado brasileiro (AltGr)');
    expect(validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+3' }).explicar).toBe('Gera um símbolo no teclado brasileiro (AltGr)');
    expect(validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+[' }).explicar).toBe('Gera um símbolo no teclado brasileiro (AltGr)');
  });
  it('conflito com o Teams vem antes do AltGr', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+E' }).explicar).toBe('Usado pelo Microsoft Teams');
  });
  it('recusa repetido e deixa a primeira ação sem erro', () => {
    const r = validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+Space' });
    expect(r.explicar).toBe('Atalho repetido');
    expect(r.ajudarResponder).toBeNull();
  });
  it('compara repetidos depois de normalizar', () => {
    const r = validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'alt+ctrl+space' });
    expect(r.explicar).toBe('Atalho repetido');
  });
  it('marca todas as repetições depois da primeira', () => {
    const r = validarAtalhos({ ...ATALHOS_PADRAO, digitar: 'Control+Alt+X', ocultar: 'Control+Alt+X' });
    expect(r.explicar).toBeNull();
    expect(r.digitar).toBe('Atalho repetido');
    expect(r.ocultar).toBe('Atalho repetido');
  });
  it('recusa sem modificador', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, ocultar: 'O' }).ocultar).toBe('Use Ctrl, Alt ou Shift com uma tecla');
  });
  it('recusa só modificadores, sem tecla', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, ocultar: 'Ctrl+Alt' }).ocultar).toBe('Use Ctrl, Alt ou Shift com uma tecla');
  });
  it('recusa mais de uma tecla', () => {
    expect(validarAtalhos({ ...ATALHOS_PADRAO, ocultar: 'Ctrl+A+B' }).ocultar).toBe('Use Ctrl, Alt ou Shift com uma tecla');
  });
  it('a regra de modificador vem antes da de repetido', () => {
    const r = validarAtalhos({ ...ATALHOS_PADRAO, digitar: 'O', ocultar: 'O' });
    expect(r.digitar).toBe('Use Ctrl, Alt ou Shift com uma tecla');
    expect(r.ocultar).toBe('Use Ctrl, Alt ou Shift com uma tecla');
  });
});
