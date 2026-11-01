import type { Fala, Idioma, Quem } from '../../shared/tipos';

export type TokenStt = { text: string; is_final: boolean; language?: string };

/**
 * Junta os tokens de fala-para-texto de um canal em falas (utterances).
 * Tokens finais vão para o buffer; os não finais só aparecem na cauda do `parcial`.
 */
export class AcumuladorFalas {
  private texto = '';
  private finaisEmIngles = 0;
  private finaisTotal = 0;
  /** `agora` do primeiro token final do buffer atual; null com o buffer vazio. */
  private inicioDoBuffer: number | null = null;

  constructor(
    private readonly quem: Quem,
    private readonly maxMsSemFim = 30_000,
  ) {}

  adicionar(tokens: TokenStt[], agora: number): { parcial: string; fala: Fala | null } {
    let naoFinal = '';
    for (const token of tokens) {
      if (token.is_final) {
        this.inicioDoBuffer ??= agora;
        this.texto += token.text;
        this.finaisTotal += 1;
        if (token.language === 'en') this.finaisEmIngles += 1;
      } else {
        naoFinal += token.text;
      }
    }

    let fala: Fala | null = null;
    if (this.inicioDoBuffer !== null && agora - this.inicioDoBuffer >= this.maxMsSemFim) {
      fala = this.fimDeFala(agora);
    }

    const parcial = this.texto + naoFinal;
    return { parcial: this.texto.trim() === '' ? parcial.trimStart() : parcial, fala };
  }

  /** Fecha a fala em andamento e zera o buffer. Devolve null se não há texto. */
  fimDeFala(agora: number): Fala | null {
    const texto = this.texto.trim();
    const idioma: Idioma = this.finaisEmIngles * 2 > this.finaisTotal ? 'en' : 'pt';
    this.texto = '';
    this.finaisEmIngles = 0;
    this.finaisTotal = 0;
    this.inicioDoBuffer = null;
    return texto === '' ? null : { quem: this.quem, texto, idioma, em: agora };
  }
}
