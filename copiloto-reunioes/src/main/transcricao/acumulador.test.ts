import { describe, it, expect } from 'vitest';
import { AcumuladorFalas } from './acumulador';

const t = (text: string, is_final = true, language = 'pt') => ({ text, is_final, language });

describe('AcumuladorFalas', () => {
  it('fim de fala entrega a fala final', () => {
    const a = new AcumuladorFalas('outros');
    a.adicionar([t('Qual '), t('o prazo?')], 1000);
    expect(a.fimDeFala(2000)).toEqual({ quem: 'outros', texto: 'Qual o prazo?', idioma: 'pt', em: 2000 });
  });

  it('não final aparece só no parcial', () => {
    const a = new AcumuladorFalas('voce');
    expect(a.adicionar([t('Olá '), t('mun', false)], 0).parcial).toBe('Olá mun');
    expect(a.fimDeFala(10)?.texto).toBe('Olá');
  });

  it('idioma da maioria', () => {
    const a = new AcumuladorFalas('outros');
    a.adicionar([t('What ', true, 'en'), t('is ', true, 'en'), t('the ', true, 'en'), t('SLA', true, 'pt')], 0);
    expect(a.fimDeFala(1)?.idioma).toBe('en');
  });

  it('empate de idioma dá pt', () => {
    const a = new AcumuladorFalas('outros');
    a.adicionar([t('What ', true, 'en'), t('prazo', true, 'pt')], 0);
    expect(a.fimDeFala(1)?.idioma).toBe('pt');
  });

  it('tokens sem idioma contam como não inglês', () => {
    const a = new AcumuladorFalas('outros');
    a.adicionar([{ text: 'What ', is_final: true, language: 'en' }, { text: 'is ', is_final: true }], 0);
    expect(a.fimDeFala(1)?.idioma).toBe('pt');
  });

  it('idioma diferente de en conta como pt', () => {
    const a = new AcumuladorFalas('outros');
    a.adicionar([t('Hola ', true, 'es'), t('what ', true, 'en')], 0);
    expect(a.fimDeFala(1)?.idioma).toBe('pt');
  });

  it('tokens não finais não entram na contagem de idioma', () => {
    const a = new AcumuladorFalas('outros');
    a.adicionar([t('prazo ', true, 'pt'), t('what ', false, 'en'), t('is', false, 'en')], 0);
    expect(a.fimDeFala(1)?.idioma).toBe('pt');
  });

  it('fim de fala sem texto devolve null', () => {
    expect(new AcumuladorFalas('voce').fimDeFala(0)).toBeNull();
  });

  it('buffer só com espaços devolve null', () => {
    const a = new AcumuladorFalas('voce');
    a.adicionar([t('  '), t(' ')], 0);
    expect(a.fimDeFala(1)).toBeNull();
  });

  it('o buffer zera depois de entregar a fala', () => {
    const a = new AcumuladorFalas('voce');
    a.adicionar([t('Oi')], 0);
    expect(a.fimDeFala(1)?.texto).toBe('Oi');
    expect(a.fimDeFala(2)).toBeNull();
    a.adicionar([t('Tchau')], 3);
    expect(a.fimDeFala(4)).toEqual({ quem: 'voce', texto: 'Tchau', idioma: 'pt', em: 4 });
  });

  it('o idioma da fala seguinte não herda a contagem da anterior', () => {
    const a = new AcumuladorFalas('outros');
    a.adicionar([t('What ', true, 'en'), t('is', true, 'en')], 0);
    expect(a.fimDeFala(1)?.idioma).toBe('en');
    a.adicionar([t('Qual o prazo', true, 'pt')], 2);
    expect(a.fimDeFala(3)?.idioma).toBe('pt');
  });

  it('o parcial acumula o texto final entre chamadas e troca a cauda não final', () => {
    const a = new AcumuladorFalas('outros');
    expect(a.adicionar([t('Qual '), t('o pr', false)], 0).parcial).toBe('Qual o pr');
    expect(a.adicionar([t('o ')], 10).parcial).toBe('Qual o ');
    expect(a.adicionar([t('prazo', false)], 20).parcial).toBe('Qual o prazo');
  });

  it('o parcial não começa com espaço quando o buffer está vazio', () => {
    const a = new AcumuladorFalas('outros');
    expect(a.adicionar([t(' mun', false)], 0).parcial).toBe('mun');
  });

  it('o parcial é vazio sem tokens', () => {
    expect(new AcumuladorFalas('outros').adicionar([], 0)).toEqual({ parcial: '', fala: null });
  });

  it('o texto da fala vem com trim', () => {
    const a = new AcumuladorFalas('voce');
    a.adicionar([t('  Olá '), t('mundo  ')], 0);
    expect(a.fimDeFala(1)?.texto).toBe('Olá mundo');
  });

  describe('limite de tempo sem fim de fala', () => {
    it('emite fala após 30 s sem fim de fala', () => {
      const a = new AcumuladorFalas('outros');
      expect(a.adicionar([t('Primeiro trecho ')], 0).fala).toBeNull();
      const r = a.adicionar([t('continua')], 30_000);
      expect(r.fala?.texto).toBe('Primeiro trecho continua');
      expect(a.fimDeFala(30_001)).toBeNull();
    });

    it('a fala antecipada tem em igual ao agora da chamada, quem e idioma', () => {
      const a = new AcumuladorFalas('voce');
      a.adicionar([t('What ', true, 'en')], 0);
      expect(a.adicionar([t('is', true, 'en')], 30_000).fala).toEqual({
        quem: 'voce', texto: 'What is', idioma: 'en', em: 30_000,
      });
    });

    it('não emite antes dos 30 s', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('Primeiro ')], 0);
      expect(a.adicionar([t('trecho')], 29_999).fala).toBeNull();
      expect(a.fimDeFala(30_000)?.texto).toBe('Primeiro trecho');
    });

    it('conta desde o primeiro token final do buffer, não desde a última chamada', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('um ')], 1000);
      a.adicionar([t('dois ')], 20_000);
      expect(a.adicionar([t('três')], 31_000).fala?.texto).toBe('um dois três');
    });

    it('tokens não finais não iniciam a contagem', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('ru', false)], 0);
      expect(a.adicionar([t('Olá')], 40_000).fala).toBeNull();
    });

    it('a contagem recomeça no primeiro token final depois da emissão', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('um ')], 0);
      expect(a.adicionar([t('dois')], 30_000).fala?.texto).toBe('um dois');
      expect(a.adicionar([t('três ')], 40_000).fala).toBeNull();
      expect(a.adicionar([t('quatro ')], 69_999).fala).toBeNull();
      expect(a.adicionar([t('cinco')], 70_000).fala?.texto).toBe('três quatro cinco');
    });

    it('a contagem recomeça depois de um fim de fala normal', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('um')], 0);
      a.fimDeFala(10);
      expect(a.adicionar([t('dois')], 30_000).fala).toBeNull();
    });

    it('a fala antecipada inclui os finais da chamada e deixa o não final só no parcial', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('Primeiro ')], 0);
      const r = a.adicionar([t('trecho '), t('segu', false)], 30_000);
      expect(r.fala?.texto).toBe('Primeiro trecho');
      expect(r.parcial).toBe('segu');
      expect(a.fimDeFala(30_001)).toBeNull();
    });

    it('respeita um maxMsSemFim personalizado', () => {
      const a = new AcumuladorFalas('outros', 1000);
      a.adicionar([t('um ')], 0);
      expect(a.adicionar([t('dois ')], 999).fala).toBeNull();
      expect(a.adicionar([t('três')], 1000).fala?.texto).toBe('um dois três');
    });

    it('verifica o limite mesmo numa chamada sem tokens', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('um')], 0);
      expect(a.adicionar([], 30_000).fala?.texto).toBe('um');
    });

    it('buffer só com espaços no limite zera sem emitir fala', () => {
      const a = new AcumuladorFalas('outros');
      a.adicionar([t('  ')], 0);
      expect(a.adicionar([t(' ')], 30_000).fala).toBeNull();
      expect(a.adicionar([t('Oi ')], 40_000).fala).toBeNull();
      expect(a.adicionar([t('de novo')], 69_999).fala).toBeNull();
    });
  });
});
