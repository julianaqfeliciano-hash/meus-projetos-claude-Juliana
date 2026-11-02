import type { Preferencias } from '../../shared/tipos';

export interface LojaPreferencias {
  /** As preferências como foram gravadas por último. */
  obter(): Preferencias;
  /** Aplica `mudar` sobre as preferências atuais e grava. Devolve o que foi gravado. */
  atualizar(mudar: (p: Preferencias) => Preferencias): Promise<Preferencias>;
}

/**
 * `salvarPreferencias` grava o arquivo inteiro, e a última gravação a terminar vence. Por isso toda mudança passa
 * por esta fila: uma gravação de cada vez, na ordem pedida, cada uma partindo do que a anterior gravou. A memória
 * só muda depois de gravar; uma gravação que falha rejeita só o seu pedido, e a fila segue.
 */
export function criarLojaPreferencias(
  iniciais: Preferencias,
  gravar: (p: Preferencias) => Promise<void>,
): LojaPreferencias {
  let atuais = iniciais;
  let fila: Promise<unknown> = Promise.resolve();
  return {
    obter: () => atuais,
    atualizar(mudar) {
      const execucao = fila.then(async () => {
        const novas = mudar(atuais);
        await gravar(novas);
        atuais = novas;
        return novas;
      });
      fila = execucao.catch(() => undefined);
      return execucao;
    },
  };
}
