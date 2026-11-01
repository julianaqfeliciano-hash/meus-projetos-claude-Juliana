const INTERVALO_PADRAO_MS = 10_000;
const ATRASO_FIM_DE_FALA_PADRAO_MS = 1500;

/**
 * Decide quando o detector roda (§5.2): 1,5 s depois de um fim de fala dos "Outros", ou a cada 10 s se houve
 * fala nova. Só uma execução por vez; os disparos que chegam durante uma execução viram uma única execução
 * logo depois. Parado, ignora os disparos.
 */
export class AgendadorDetector {
  private readonly intervaloMs: number;
  private readonly atrasoFimDeFalaMs: number;
  private ativo = false;
  /** Houve fala desde o início da última execução. */
  private falaNova = false;
  private executando = false;
  /** Um disparo chegou durante a execução atual. */
  private pendente = false;
  /** Até quando o intervalo fica dobrado. */
  private lentoAte = 0;
  private tique: ReturnType<typeof setTimeout> | null = null;
  private esperaFimDeFala: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly executar: () => Promise<void>,
    opcoes: { intervaloMs?: number; atrasoFimDeFalaMs?: number } = {},
  ) {
    this.intervaloMs = opcoes.intervaloMs ?? INTERVALO_PADRAO_MS;
    this.atrasoFimDeFalaMs = opcoes.atrasoFimDeFalaMs ?? ATRASO_FIM_DE_FALA_PADRAO_MS;
  }

  iniciar(): void {
    if (this.ativo) return;
    this.ativo = true;
    this.agendarTique();
  }

  parar(): void {
    this.ativo = false;
    this.pendente = false;
    if (this.tique !== null) clearTimeout(this.tique);
    if (this.esperaFimDeFala !== null) clearTimeout(this.esperaFimDeFala);
    this.tique = null;
    this.esperaFimDeFala = null;
  }

  novaFala(): void {
    this.falaNova = true;
  }

  fimDeFalaOutros(): void {
    if (!this.ativo) return;
    if (this.esperaFimDeFala !== null) clearTimeout(this.esperaFimDeFala);
    this.esperaFimDeFala = setTimeout(() => {
      this.esperaFimDeFala = null;
      this.disparar();
    }, this.atrasoFimDeFalaMs);
  }

  /** Dobra o intervalo até `Date.now() + porMs`. A espera em curso recomeça já com o intervalo dobrado. */
  desacelerar(porMs: number): void {
    this.lentoAte = Date.now() + porMs;
    if (this.ativo) this.agendarTique();
  }

  private agendarTique(): void {
    if (this.tique !== null) clearTimeout(this.tique);
    const intervalo = Date.now() < this.lentoAte ? this.intervaloMs * 2 : this.intervaloMs;
    this.tique = setTimeout(() => {
      this.agendarTique();
      if (this.falaNova) this.disparar();
    }, intervalo);
  }

  private disparar(): void {
    if (!this.ativo) return;
    if (this.executando) {
      this.pendente = true;
      return;
    }
    void this.rodar();
  }

  private async rodar(): Promise<void> {
    this.executando = true;
    do {
      this.pendente = false;
      this.falaNova = false;
      try {
        await this.executar();
      } catch (e) {
        console.warn('O ciclo do detector falhou:', e);
      }
    } while (this.pendente);
    this.executando = false;
  }
}
