/**
 * Ensaio de ponta a ponta com a IA real (não roda no CI): `npm run ensaio:real`.
 * Faz uma reunião no modo 'ensaio' (falas digitadas, sem áudio) com um manual fictício e imprime cartões,
 * fontes, latências, o resumo e o uso de cache. Custa alguns centavos.
 */
import type { Cartao, ContextoReuniao, InstantaneoReuniao, Quem } from '../src/shared/tipos';

const ESPERA_ENTRE_FALAS_MS = 3000;
const ESPERA_MAX_CARTOES_MS = 90_000;
const SILENCIO_CARTOES_MS = 20_000;

interface Uso {
  chamadas: number;
  input: number;
  output: number;
  cacheCriado: number;
  cacheLido: number;
}

interface ChamadaUso {
  modelo: string;
  cacheLido: number;
  cacheCriado: number;
}

async function main(): Promise<void> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    console.log('Defina ANTHROPIC_API_KEY para rodar o ensaio (custa alguns centavos).');
    return;
  }

  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const { randomUUID } = await import('node:crypto');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { lerDocumento } = await import('../src/main/documentos/ler-documento');
  const { montarPrefixo } = await import('../src/main/ia/prefixo');
  const { criarDetector } = await import('../src/main/ia/detector');
  const { criarExplicador } = await import('../src/main/ia/explicador');
  const { criarResumidor } = await import('../src/main/ia/resumo');
  const { criarSessaoReuniao } = await import('../src/main/reuniao/sessao-reuniao');

  const pasta = path.join(__dirname, 'ensaio');
  const falas = JSON.parse(await fs.readFile(path.join(pasta, 'falas.json'), 'utf8')) as {
    quem: Quem;
    texto: string;
  }[];
  const documento = await lerDocumento(path.join(pasta, 'SisFat-manual.md'));
  if (documento.aviso) throw new Error(`Não consegui ler o manual: ${documento.aviso}`);

  // O cliente é embrulhado só para somar o `usage`; os corpos dos pedidos seguem intactos.
  const uso: Uso = { chamadas: 0, input: 0, output: 0, cacheCriado: 0, cacheLido: 0 };
  const porChamada: ChamadaUso[] = [];
  const somar = (u: unknown, modelo: unknown): void => {
    const x = (u ?? {}) as Record<string, number | null | undefined>;
    porChamada.push({
      modelo: String(modelo ?? '?'),
      cacheLido: x.cache_read_input_tokens ?? 0,
      cacheCriado: x.cache_creation_input_tokens ?? 0,
    });
    uso.chamadas += 1;
    uso.input += x.input_tokens ?? 0;
    uso.output += x.output_tokens ?? 0;
    uso.cacheCriado += x.cache_creation_input_tokens ?? 0;
    uso.cacheLido += x.cache_read_input_tokens ?? 0;
  };
  const cliente = new Anthropic({ apiKey: chave });
  const mensagens = cliente.beta.messages;
  const criarOriginal = mensagens.create.bind(mensagens) as (...a: unknown[]) => Promise<{ usage?: unknown; model?: unknown }>;
  const streamOriginal = mensagens.stream.bind(mensagens) as (...a: unknown[]) => {
    finalMessage(): Promise<{ usage?: unknown; model?: unknown }>;
  };
  Object.assign(mensagens, {
    create: async (...a: unknown[]) => {
      const r = await criarOriginal(...a);
      somar(r.usage, r.model);
      return r;
    },
    stream: (...a: unknown[]) => {
      const s = streamOriginal(...a);
      const final = s.finalMessage.bind(s);
      let registrado = false;
      s.finalMessage = async () => {
        const m = await final();
        if (!registrado) {
          registrado = true;
          somar(m.usage, m.model);
        }
        return m;
      };
      return s;
    },
  });

  const contexto: ContextoReuniao = {
    documentos: [documento],
    contexto: 'Reunião com o cliente sobre a implantação do SisFat.',
    sobreVoce: 'Analista de implantação que está aprendendo o SisFat.',
    idioma: 'auto',
  };

  // Latência = do surgimento do cartão até o primeiro campo não vazio.
  const latencias = new Map<string, number>();
  const vistos = new Map<string, Cartao>();
  const publicar = (i: InstantaneoReuniao): void => {
    for (const c of i.cartoes) {
      vistos.set(c.id, c);
      if (!latencias.has(c.id) && Object.values(c.campos).some((v) => typeof v === 'string' && v.trim() !== '')) {
        latencias.set(c.id, Date.now() - c.criadoEm);
      }
    }
  };

  const sessao = criarSessaoReuniao(
    {
      criarStt: () => {
        throw new Error('O modo ensaio não usa transcrição.');
      },
      detector: criarDetector(cliente, montarPrefixo(contexto, 'detector')),
      explicador: criarExplicador(cliente, montarPrefixo(contexto, 'explicador')),
      resumidor: criarResumidor(cliente, montarPrefixo(contexto, 'resumo')),
      publicar,
      salvar: async () => undefined,
      gerarId: randomUUID,
    },
    { modo: 'ensaio', contexto },
  );

  const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  await sessao.iniciar();
  for (const fala of falas) {
    console.log(`[${fala.quem}] ${fala.texto}`);
    sessao.falaEnsaio(fala.quem, fala.texto);
    await dormir(ESPERA_ENTRE_FALAS_MS);
  }

  // Espera o fim do pipeline: cartões escrevendo ou novos cartões nos últimos 20 s (o detector e a fila de
  // automáticos ainda podem estar trabalhando). No máximo 90 s depois da última fala.
  const limite = Date.now() + ESPERA_MAX_CARTOES_MS;
  let total = -1;
  let mudouEm = Date.now();
  while (Date.now() < limite) {
    const atual = sessao.instantaneo();
    if (atual.cartoes.length !== total) {
      total = atual.cartoes.length;
      mudouEm = Date.now();
    }
    publicar(atual);
    const escrevendo = atual.cartoes.some((c) => c.estado === 'escrevendo');
    if (!escrevendo && Date.now() - mudouEm >= SILENCIO_CARTOES_MS) break;
    await dormir(500);
  }
  publicar(sessao.instantaneo());

  const item = await sessao.encerrar();
  publicar(sessao.instantaneo());

  console.log('\n===== CARTÕES =====');
  for (const c of vistos.values()) {
    console.log(`\n[${c.tipo}] ${c.titulo} (${c.origem}, ${c.estado})`);
    for (const [campo, valor] of Object.entries(c.campos)) if (valor) console.log(`  ${campo}: ${valor}`);
    if (c.fontes.length > 0) console.log(`  fontes: ${c.fontes.map((f) => `${f.arquivo}, ${f.local}`).join(' | ')}`);
    if (c.erro) console.log(`  erro: ${c.erro}`);
    const ms = latencias.get(c.id);
    console.log(`  tempo até o primeiro texto: ${ms === undefined ? 'sem texto' : `${(ms / 1000).toFixed(1)} s`}`);
  }

  console.log('\n===== RESUMO =====');
  console.log(item?.resumo ? JSON.stringify(item.resumo, null, 2) : '(sem resumo)');

  console.log('\n===== USO =====');
  console.log(`chamadas: ${uso.chamadas}`);
  console.log(`input_tokens: ${uso.input}, output_tokens: ${uso.output}`);
  console.log(`cache_creation_input_tokens: ${uso.cacheCriado}`);
  console.log(`cache_read_input_tokens: ${uso.cacheLido}`);
  console.log('\nPor chamada (em ordem):');
  porChamada.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.modelo}  cache_read=${c.cacheLido}  cache_creation=${c.cacheCriado}`);
  });
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);

