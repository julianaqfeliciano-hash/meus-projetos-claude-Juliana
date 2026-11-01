import type Anthropic from '@anthropic-ai/sdk';
import type { ResultadoChave } from '../../shared/tipos';
import { classificarErro } from './erros';
import { MODELO_DETECTOR } from './modelos';

/** Consulta barata: se a chave serve, o modelo do detector é encontrado. Só 401/403 invalidam a chave. */
export async function verificarChaveAnthropic(cliente: Pick<Anthropic, 'models'>): Promise<ResultadoChave> {
  try {
    await cliente.models.retrieve(MODELO_DETECTOR);
    return 'ok';
  } catch (e) {
    const classe = classificarErro(e);
    return classe === 'chave' || classe === 'permissao' ? 'invalida' : 'erro-rede';
  }
}

/** O erro HTTP do Soniox (`SonioxHttpError`) traz `statusCode`; 401/403 significam chave recusada. */
export async function verificarChaveSoniox(cliente: { models: { list(): Promise<unknown> } }): Promise<ResultadoChave> {
  try {
    await cliente.models.list();
    return 'ok';
  } catch (e) {
    const status = typeof e === 'object' && e !== null ? (e as { statusCode?: unknown }).statusCode : undefined;
    return status === 401 || status === 403 ? 'invalida' : 'erro-rede';
  }
}
