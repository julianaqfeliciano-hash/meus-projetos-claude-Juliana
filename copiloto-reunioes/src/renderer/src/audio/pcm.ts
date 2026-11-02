/** Um bloco de PCM de 16 bits com buffer próprio, pronto para seguir pelo IPC (`bloco.buffer`). */
export type BlocoPcm = Int16Array<ArrayBuffer>;

/** Converte amostras em ponto flutuante (-1 a 1) para PCM de 16 bits, limitando os valores fora desse intervalo. */
export function paraPcm16(f: Float32Array): BlocoPcm {
  const saida = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    // A atribuição trunca para zero, o que mantém a conversão simétrica (-x e x dão o mesmo módulo).
    saida[i] = Math.max(-1, Math.min(1, f[i])) * 32767;
  }
  return saida;
}

/** Nível (valor eficaz) das amostras, de 0 (silêncio) a 1. */
export function nivelRms(f: Float32Array): number {
  if (f.length === 0) return 0;
  let soma = 0;
  for (let i = 0; i < f.length; i++) soma += f[i] * f[i];
  return Math.min(1, Math.sqrt(soma / f.length));
}

/**
 * Junta os quadros pequenos do AudioWorklet (128 amostras) em blocos de tamanho fixo. 1600 amostras a 16 kHz são
 * 100 ms, um tamanho bom para a transcrição em tempo real.
 */
export class AgrupadorPcm {
  private atual: BlocoPcm;
  private usadas = 0;

  constructor(
    private readonly amostrasPorBloco = 1600,
    private readonly aoBloco: (b: BlocoPcm) => void,
  ) {
    if (!Number.isInteger(amostrasPorBloco) || amostrasPorBloco < 1) {
      throw new RangeError('O bloco precisa ter ao menos uma amostra.');
    }
    this.atual = new Int16Array(amostrasPorBloco);
  }

  adicionar(f: Float32Array): void {
    const pcm = paraPcm16(f);
    let lidas = 0;
    while (lidas < pcm.length) {
      const quantas = Math.min(pcm.length - lidas, this.amostrasPorBloco - this.usadas);
      this.atual.set(pcm.subarray(lidas, lidas + quantas), this.usadas);
      lidas += quantas;
      this.usadas += quantas;
      if (this.usadas === this.amostrasPorBloco) {
        const pronto = this.atual;
        // Um buffer novo a cada bloco: o anterior segue para o IPC e não pode ser reaproveitado.
        this.atual = new Int16Array(this.amostrasPorBloco);
        this.usadas = 0;
        this.aoBloco(pronto);
      }
    }
  }
}
