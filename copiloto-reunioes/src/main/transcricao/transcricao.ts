import type { Fala, Quem } from '../../shared/tipos';

/** Transcrição da reunião, só em memória: nunca vai para o disco. */
export class Transcricao {
  private falas: Fala[] = [];

  adicionar(f: Fala): void {
    this.falas.push(f);
  }

  /** Falas dos últimos `ms` ms (`em >= agora - ms`), na ordem em que entraram. */
  janela(ms: number, agora: number): Fala[] {
    return this.falas.filter((f) => f.em >= agora - ms);
  }

  todas(): Fala[] {
    return [...this.falas];
  }

  ultimaDe(quem: Quem): number | null {
    return this.falas.findLast((f) => f.quem === quem)?.em ?? null;
  }

  ultimaQualquer(): number | null {
    return this.falas.at(-1)?.em ?? null;
  }

  limpar(): void {
    this.falas = [];
  }
}

const ROTULOS: Record<Quem, string> = { outros: 'Outros', voce: 'Você' };

export function formatarFalas(falas: Fala[]): string {
  return falas.map((f) => `[${ROTULOS[f.quem]}] ${f.texto}`).join('\n');
}
