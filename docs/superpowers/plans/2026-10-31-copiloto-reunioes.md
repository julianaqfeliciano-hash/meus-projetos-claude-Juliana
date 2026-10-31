# Copiloto de Reuniões — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Programa Windows (Electron) que ouve reuniões do Teams/Meet e o microfone, transcreve em português e inglês e mostra, num painel invisível no compartilhamento de tela e controlado por atalhos globais, sugestões de resposta e explicações de conceitos baseadas nos documentos anexados, mais um modo de treino de entrevista.

**Architecture:** O processo principal concentra toda a lógica e todas as chaves. É composto de módulos puros e testáveis (documentos, transcrição, montagem de pedidos, orquestração da reunião, histórico) ligados por interfaces injetáveis à Soniox (transcrição) e à Anthropic (Claude). Os dois renderers React (janela principal e painel) apenas exibem um "instantâneo" do estado e enviam ações e áudio por uma API IPC tipada exposta pelo preload. O áudio é capturado no renderer da janela principal: microfone via `getUserMedia` e som do computador via `getDisplayMedia`, que o processo principal atende com `audio: 'loopback'`. Ele é convertido para PCM 16 kHz e enviado ao processo principal.

**Tech Stack:** Electron 45.2.1, electron-vite 6.0.0 (Vite 8), React 19.3, Tailwind CSS 4.3, TypeScript ~6.0.3, Vitest 5.0.5, `@anthropic-ai/sdk` 1.3.0, `@soniox/node` 2.4.0, `zod` 4, `pdfjs-dist` 6.4, `mammoth` 1.13, `jszip` 3.10, `exceljs` 4.4, electron-builder 26.18 (NSIS), GitHub Actions `windows-latest`.

**Spec:** `docs/superpowers/specs/2026-10-27-copiloto-reunioes-design.md`. Leia a spec junto com este plano; os números de seção (§) abaixo se referem a ela.

## Global Constraints

- Todo o código fica em `copiloto-reunioes/` (raiz do repositório), independente de `mentorias-naap/`. Os caminhos abaixo são relativos a `copiloto-reunioes/`, exceto `.github/` e `docs/`.
- Alvo: Windows 10 versão 2004 (build 19041) ou mais novo, ou Windows 11. Uma usuária, sem login, sem servidor próprio. Tudo é salvo em `app.getPath('userData')`.
- Toda a interface, mensagens e avisos ficam em português do Brasil.
- Os modelos e configurações são fixos:
  - Detector: `claude-haiku-5-5`, `output_config.effort: 'low'`, cache TTL padrão (5 min).
  - Explicador: `claude-opus-5-5`, effort `'low'`, streaming, citações ligadas, cache TTL `'1h'`.
  - Resumo e treino: `claude-opus-5-5`, effort `'medium'`.
  - Todo pedido ao Opus usa `betas: ['server-side-fallback-2026-07-01']` e `fallbacks: 'default'`.
  - Nunca enviar `thinking` (o padrão adaptativo vale para os dois modelos), `temperature`, `top_p` ou `top_k`.
  - Todas as chamadas usam o namespace `cliente.beta.messages`.
- Transcrição: Soniox `model: 'stt-rt-v5'`, `audio_format: 'pcm_s16le'`, `sample_rate: 16000`, `num_channels: 1`, `language_hints: ['pt', 'en']`, `enable_language_identification: true`, `enable_endpoint_detection: true`.
- Limite de documentos: `LIMITE_TOKENS_DOCUMENTOS = 80_000` tokens por reunião. Formatos aceitos: `.pdf` (com texto), `.docx`, `.pptx`, `.xlsx`, `.txt`, `.md`. Formatos antigos são `.doc`, `.xls` e `.ppt`.
- Atalhos padrão:
  - `ajudarResponder: 'Control+Alt+Space'`
  - `explicar: 'Control+Alt+X'`
  - `digitar: 'Control+Alt+D'`
  - `ocultar: 'Control+Alt+O'`
  - `pausar: 'Control+Alt+B'`
  - `anterior: 'Control+Alt+,'`
  - `proximo: 'Control+Alt+.'`
- Nunca gravar em disco o áudio, a transcrição completa ou os cartões "Diga isso".
- As chaves de API nunca chegam aos renderers. Renderers com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Sem recursos para esconder o programa da barra de tarefas ou da lista de processos, nem para burlar detecção de plataformas de entrevista (§2).
- `package.json` **sem** `"type": "module"`: o main e o preload saem em CommonJS, e pacotes só-ESM (pdfjs-dist) são carregados com `await import()` dentro das funções.
- Testes unitários nunca importam `electron`. Módulos que dependem do Electron são finos e recebem as dependências por parâmetro.
- Instalação local sem o binário do Electron: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`. Todos os comandos rodam em `copiloto-reunioes/`.
- Toda mensagem de commit termina com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01W5WCatqwFWqPuvKgFsjbdv
  ```
  Os commits vão para a branch `claude/client-meeting-support-system-s8avxc`.

## Review Focus

Estes são os casos que a spec implica mas não detalha, e que têm mais chance de afetar a usuária:

1. **Reunião sem nenhum documento anexado.** O cache precisa cair no último bloco do `system` e os cartões saem sem fonte, sem erro. Teste em Task 6: `montarPrefixo sem documentos põe o cache no system`.
2. **Cliente falando por muito tempo sem pausa** (sem fim de fala da Soniox). A fala precisa ser entregue mesmo assim, a cada 30 s de texto final, para o detector enxergá-la. Teste em Task 4: `emite fala após 30 s sem fim de fala`.
3. **Modelo responde sem os marcadores** (`DIGA ISSO:` etc.). O texto inteiro deve ir para o campo principal do cartão em vez de sumir. Teste em Task 6: `texto sem marcadores vai para o campo principal`.
4. **Sem internet ao anexar documentos** (a contagem de tokens falha). Deve usar uma estimativa conservadora marcada como estimada, e o limite continua valendo. Teste em Task 7: `contagem cai para estimativa quando a API falha`.
5. **Atalho pressionado sem reunião ativa** (antes de iniciar ou depois de encerrar). Não deve acontecer nada, sem exceção e sem chamada à IA. Teste em Task 8: `atalhos fora de reunião ativa não fazem nada`.

---

## Mapa de arquivos

```
copiloto-reunioes/
  package.json, package-lock.json, tsconfig.json, electron.vite.config.ts,
  vitest.config.ts, eslint.config.mjs, electron-builder.yml, .gitignore, README.md
  src/shared/tipos.ts            tipos compartilhados (todas as tasks)
  src/shared/textos.ts           mensagens de aviso em pt-BR
  src/shared/ipc.ts              contrato da API exposta pelo preload (Task 11)
  src/main/config/atalhos.ts     padrões, normalização e validação de atalhos
  src/main/config/preferencias.ts  leitura/gravação de config.json
  src/main/config/chaves.ts      cofre de chaves (cripto injetada)
  src/main/documentos/{ler-documento,pdf,docx,pptx,xlsx,texto,dividir}.ts
  src/main/transcricao/{acumulador,transcricao,reconexao,sessao-soniox}.ts
  src/main/ia/{modelos,instrucoes,prefixo,fontes,interpretar-cartao,estruturado,erros,tokens,detector,explicador,resumo,treinador,chaves-verificacao}.ts
  src/main/reuniao/{normalizar,agendador,sessao-reuniao}.ts
  src/main/historico/historico.ts
  src/main/janelas/{versao-windows,janela-principal,painel}.ts
  src/main/{atalhos-globais,captura,ipc,index}.ts
  src/preload/index.ts
  src/renderer/{index.html,painel.html}, src/renderer/public/captura-pcm.js
  src/renderer/src/{main.tsx,painel.tsx,estilos.css,api.ts}
  src/renderer/src/audio/{pcm,captura-audio}.ts
  src/renderer/src/telas/{Configuracoes,NovaReuniao,Reuniao,Historico,Treino}.tsx
  src/renderer/src/painel/{Painel,CartaoView}.tsx
  scripts/ensaio-real.ts, scripts/ensaio/{SisFat-manual.md,falas.json}
.github/workflows/copiloto-reunioes.yml
```

Cada teste fica ao lado do arquivo testado (`*.test.ts`). As ferramentas que geram arquivos de exemplo para os testes ficam em `src/main/documentos/gerar-exemplos.ts` (só para testes).

---

### Task 1: Esqueleto do projeto e tipos compartilhados

**Arquivos:**
- Criar: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `.gitignore`
- Criar: `src/main/index.ts` (mínimo: abre uma `BrowserWindow` com `src/renderer/index.html`), `src/preload/index.ts` (expõe `window.copiloto = {}` via `contextBridge`)
- Criar: `src/renderer/index.html`, `src/renderer/painel.html`, `src/renderer/src/main.tsx`, `src/renderer/src/painel.tsx`, `src/renderer/src/estilos.css`
- Criar: `src/shared/tipos.ts`, `src/shared/textos.ts`
- Testar: `src/shared/textos.test.ts`

**Interfaces:**
- Produz `src/shared/tipos.ts`, que é usado por todas as tasks (copiar exatamente):

```ts
export type Quem = 'voce' | 'outros';
export type Idioma = 'pt' | 'en';
export type IdiomaSugestao = 'auto' | Idioma;
export interface Fala { quem: Quem; texto: string; idioma: Idioma; em: number }
export interface ParteDoc { rotulo: string; texto: string }
export type AvisoDoc = 'digitalizado' | 'formato-antigo' | 'nao-suportado' | 'erro-leitura';
export interface DocumentoLido {
  caminho: string; nome: string; tipo: 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'texto' | 'outro';
  partes: ParteDoc[]; aviso: AvisoDoc | null;
}
export interface ContextoReuniao {
  documentos: DocumentoLido[]; contexto: string; sobreVoce: string; idioma: IdiomaSugestao;
}
export type TipoCartao = 'diga-isso' | 'conceito' | 'resposta';
export type OrigemCartao = 'automatico' | 'atalho' | 'digitado';
export interface Fonte { arquivo: string; local: string }
export interface CamposCartao { digaIsso?: string; explicacao?: string; comoExplicar?: string; resposta?: string }
export interface ConteudoCartao { titulo?: string; campos: CamposCartao; fontes: Fonte[] }
export interface Cartao extends ConteudoCartao {
  id: string; tipo: TipoCartao; titulo: string; origem: OrigemCartao;
  estado: 'escrevendo' | 'pronto' | 'erro'; criadoEm: number; erro?: string;
}
export interface ItemDetectado { tipo: 'pergunta' | 'conceito'; texto: string; idioma: Idioma }
export type EstadoReuniao = 'preparando' | 'ouvindo' | 'pausado' | 'encerrando' | 'concluida';
export type StatusConexao = 'ok' | 'reconectando' | 'erro';
export type TipoAviso = 'sem-som-outros' | 'pausa-automatica' | 'chave' | 'cota'
  | 'windows-antigo' | 'resumo-falhou' | 'erro-ia' | 'atalho-recusado';
export interface Aviso { id: string; tipo: TipoAviso; texto: string }
export interface InstantaneoReuniao {
  estado: EstadoReuniao; modo: 'audio' | 'ensaio'; conexao: Record<Quem, StatusConexao>;
  cartoes: Cartao[]; indiceAtual: number; avisos: Aviso[];
  parciais: Record<Quem, string>; transcricao: Fala[];
}
export interface ResumoReuniao {
  assuntos: string[]; duvidasCliente: string[]; decisoes: string[]; pendencias: string[]; proximosPassos: string[];
}
export interface ConceitoSalvo { termo: string; explicacao: string; fontes: Fonte[] }
export interface ItemHistoricoReuniao {
  id: string; tipo: 'reuniao'; data: string; duracaoMin: number; contexto: string;
  documentos: string[]; resumo: ResumoReuniao | null; conceitos: ConceitoSalvo[];
}
export interface ConfigTreino {
  vaga: string; curriculo: string; idioma: Idioma; tipo: 'comportamental' | 'tecnica' | 'mista'; quantidade: 5 | 8 | 10;
}
export interface PerguntaTreino { id: string; texto: string }
export interface AvaliacaoResposta { foiBem: string[]; faltou: string[]; respostaMelhorada: string; dicasIngles: string[] }
export interface RelatorioTreino { pontosFortes: string[]; aTreinar: string[]; perguntasMaisFracas: string[] }
export interface ItemHistoricoTreino {
  id: string; tipo: 'treino'; data: string; idioma: Idioma; tipoEntrevista: ConfigTreino['tipo'];
  vagaResumo: string; perguntas: string[]; relatorio: RelatorioTreino;
}
export type ItemHistorico = ItemHistoricoReuniao | ItemHistoricoTreino;
export interface ResumoItemHistorico { id: string; tipo: ItemHistorico['tipo']; data: string; titulo: string }
export type AcaoAtalho = 'ajudarResponder' | 'explicar' | 'digitar' | 'ocultar' | 'pausar' | 'anterior' | 'proximo';
export interface Preferencias {
  sobreVoce: string; microfoneId: string | null; atalhos: Record<AcaoAtalho, string>;
  tamanhoLetra: 'normal' | 'grande'; opacidadePainel: number; invisivelNoCompartilhamento: boolean;
  painel: { x: number; y: number; largura: number; altura: number } | null; ultimosArquivos: string[];
}
export type ResultadoChave = 'ok' | 'invalida' | 'erro-rede';
export const LIMITE_TOKENS_DOCUMENTOS = 80_000;
```

- Produz `mensagemAviso(aviso: AvisoDoc): string` e `TEXTO_AVISO: Record<TipoAviso, string>` em `src/shared/textos.ts`.
  - `mensagemAviso`:
    - `'digitalizado'` → "Não foi possível ler o texto (PDF digitalizado?)"
    - `'formato-antigo'` → "Salve como .docx, .xlsx ou .pptx"
    - `'nao-suportado'` → "Formato não suportado"
    - `'erro-leitura'` → "Não foi possível abrir o arquivo"
  - `TEXTO_AVISO`:
    - `'sem-som-outros'` → "Não estou ouvindo os outros participantes — confira a saída de som do Teams."
    - `'pausa-automatica'` → "Escuta pausada após 15 minutos de silêncio."
    - `'windows-antigo'` → "Neste Windows o painel aparece como um retângulo preto no compartilhamento de tela."
    - `'resumo-falhou'` → "Não consegui gerar o resumo; os conceitos foram salvos."
    - `'chave'` → "Chave inválida ou sem permissão — confira nas Configurações."
    - `'cota'` → "Limite ou crédito esgotado no provedor."
    - `'erro-ia'` → "A IA não respondeu agora."
    - `'atalho-recusado'` → "Um atalho já é usado por outro programa — escolha outro nas Configurações."

- [ ] **Passo 1: Criar o `package.json`**

  Use `"name": "copiloto-reunioes"`, `"productName": "Copiloto de Reuniões"`, `"main": "./out/main/index.js"`, `"private": true` e `"version": "0.1.0"`.

  Scripts:
  - `dev: electron-vite dev`
  - `build: electron-vite build`
  - `typecheck: tsc --noEmit`
  - `lint: eslint .`
  - `test: vitest run`
  - `dist:win: electron-vite build && electron-builder --win nsis --publish never`
  - `ensaio:real: tsx scripts/ensaio-real.ts`

  Dependências:
  - `dependencies`: `@anthropic-ai/sdk@1.3.0`, `@soniox/node@2.4.0`, `zod@^4.6.7`, `pdfjs-dist@6.4.299`, `mammoth@1.13.0`, `jszip@3.10.2`, `exceljs@4.4.0`, `react@19.3.1`, `react-dom@19.3.1`
  - `devDependencies`: `electron@45.2.1`, `electron-vite@6.0.0`, `vite@^8.3.5`, `@vitejs/plugin-react@^6.1.2`, `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `typescript@~6.0.3`, `vitest@5.0.5`, `@types/node@^24`, `@types/react@^19.3.0`, `@types/react-dom@^19.3.0`, `eslint@^10.14.0`, `@eslint/js@^10.0.1`, `typescript-eslint@^8.72.1`, `eslint-plugin-react-hooks@^7.1.1`, `globals@^17.13.0`, `electron-builder@26.18.0`, `tsx@latest`, `pdf-lib@1.17.1`, `docx@9.15.0`, `pptxgenjs@4.0.1`

- [ ] **Passo 2: Criar as configurações**
  - `tsconfig.json`: `strict`, `noEmit`, `jsx: react-jsx`, `module: ESNext`, `moduleResolution: Bundler`, `lib: ["ES2023", "DOM", "DOM.Iterable"]`, `types: ["node"]`. Inclui `src`, `scripts` e os arquivos de config.
  - `electron.vite.config.ts`:
    - `main: {}` e `preload: {}`;
    - `renderer: { plugins: [react(), tailwindcss()] }`, com duas entradas HTML: `index` (`src/renderer/index.html`) e `painel` (`src/renderer/painel.html`). Use a opção de entradas múltiplas que o Vite 8 instalado aceitar sem aviso de obsoleto.
  - `vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']`.
  - `eslint.config.mjs`: `@eslint/js` recommended + `typescript-eslint` recommended + `react-hooks`. Ignora `out/`, `dist/` e `node_modules/`.
  - `.gitignore`: `node_modules/`, `out/`, `dist/`.

- [ ] **Passo 3: Escrever o teste que falha**

```ts
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
```

- [ ] **Passo 4: Rodar e ver falhar**

  Rode `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install && npx vitest run src/shared/textos.test.ts`. O esperado é FALHA ("Cannot find module './textos'").

- [ ] **Passo 5: Criar `src/shared/tipos.ts` e `src/shared/textos.ts`**

  Use os textos definidos no bloco Interfaces. Crie também o main, o preload e o renderer mínimos: o `main.tsx` mostra "Copiloto de Reuniões", o `painel.tsx` mostra "Painel" e o `estilos.css` tem `@import "tailwindcss";`.

- [ ] **Passo 6: Verificar tudo**

  Rode `npm test && npm run typecheck && npm run lint && npm run build`. O esperado é passar em todos. `out/main/index.js`, `out/preload/index.js`, `out/renderer/index.html` e `out/renderer/painel.html` devem existir.

- [ ] **Passo 7: Commit**

  `git add copiloto-reunioes && git commit -m "Scaffold Copiloto de Reuniões Electron app"`, com as linhas de atribuição.

---

### Task 2: Configuração (atalhos, preferências e chaves)

**Arquivos:**
- Criar: `src/main/config/atalhos.ts`, `src/main/config/preferencias.ts`, `src/main/config/chaves.ts`
- Testar: `src/main/config/atalhos.test.ts`, `src/main/config/preferencias.test.ts`, `src/main/config/chaves.test.ts`

**Interfaces:**
- Consome: `AcaoAtalho` e `Preferencias` (Task 1).
- Produz:
  - `ATALHOS_PADRAO: Record<AcaoAtalho, string>`, com os valores das Global Constraints.
  - `normalizarAtalho(a: string): string`: `Ctrl`/`CommandOrControl`/`CmdOrCtrl` viram `Control`, modificadores na ordem `Control+Alt+Shift`, tecla final em maiúscula e `Espaço`/`space` vira `Space`.
  - `validarAtalhos(atalhos: Record<AcaoAtalho, string>): Record<AcaoAtalho, string | null>`: devolve a mensagem de erro ou `null`.
  - `PREFERENCIAS_PADRAO: Preferencias` (`sobreVoce: ''`, `microfoneId: null`, `tamanhoLetra: 'normal'`, `opacidadePainel: 0.95`, `invisivelNoCompartilhamento: true`, `painel: null`, `ultimosArquivos: []`).
  - `lerPreferencias(dir: string): Promise<Preferencias>` e `salvarPreferencias(dir: string, p: Preferencias): Promise<void>`, sobre o arquivo `config.json`.
  - `interface Cripto { disponivel(): boolean; criptografar(t: string): Buffer; descriptografar(b: Buffer): string }`.
  - `interface Chaves { anthropic: string | null; soniox: string | null }`.
  - `criarCofreChaves(dir: string, cripto: Cripto): { obter(): Promise<Chaves>; salvar(p: Partial<Chaves>): Promise<void> }`, sobre o arquivo `chaves.bin`.

Regras do `validarAtalhos`, nesta ordem (§3.5):
1. Precisa ter ao menos um modificador e uma tecla. Senão: "Use Ctrl, Alt ou Shift com uma tecla".
2. Repetido em duas ações dá "Atalho repetido".
3. Conflitos conhecidos dão `"Usado pelo <app>"`:
   - Teams: `Control+Shift+M`, `Control+Shift+O`, `Control+Shift+K`, `Control+Shift+A`, `Control+Shift+S`, `Control+Shift+D`, `Control+Shift+H`, `Control+Shift+Space`, `Control+Space`, `Control+Alt+E`.
   - Meet: `Control+D`, `Control+E`, `Control+Alt+C`, `Control+Alt+P`, `Control+Alt+H`, `Control+Alt+S`, `Control+Alt+L`.
4. `Control+Alt` + `Q`, `W`, `E`, `C`, `1` a `6`, `=`, `[` ou `]` dá "Gera um símbolo no teclado brasileiro (AltGr)".

- [ ] **Passo 1: Escrever os testes que falham**

```ts
// atalhos.test.ts
it('padrões são todos válidos', () => {
  expect(Object.values(validarAtalhos(ATALHOS_PADRAO)).every((e) => e === null)).toBe(true);
});
it('normaliza Ctrl e ordem', () => { expect(normalizarAtalho('alt+ctrl+x')).toBe('Control+Alt+X'); });
it('recusa conflito com o Meet', () => {
  expect(validarAtalhos({ ...ATALHOS_PADRAO, pausar: 'Ctrl+Alt+P' }).pausar).toBe('Usado pelo Google Meet');
});
it('recusa conflito com o Teams', () => {
  expect(validarAtalhos({ ...ATALHOS_PADRAO, pausar: 'Control+Shift+M' }).pausar).toBe('Usado pelo Microsoft Teams');
});
it('recusa AltGr do ABNT2', () => {
  expect(validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+Q' }).explicar).toBe('Gera um símbolo no teclado brasileiro (AltGr)');
});
it('recusa repetido', () => {
  const r = validarAtalhos({ ...ATALHOS_PADRAO, explicar: 'Control+Alt+Space' });
  expect(r.explicar).toBe('Atalho repetido');
});
it('recusa sem modificador', () => {
  expect(validarAtalhos({ ...ATALHOS_PADRAO, ocultar: 'O' }).ocultar).toBe('Use Ctrl, Alt ou Shift com uma tecla');
});
// preferencias.test.ts (diretório temporário via fs.mkdtemp)
it('sem arquivo devolve padrões', async () => { expect(await lerPreferencias(dir)).toEqual(PREFERENCIAS_PADRAO); });
it('salva e lê', async () => {
  await salvarPreferencias(dir, { ...PREFERENCIAS_PADRAO, sobreVoce: 'Consultora' });
  expect((await lerPreferencias(dir)).sobreVoce).toBe('Consultora');
});
it('arquivo corrompido devolve padrões', async () => {
  await fs.writeFile(path.join(dir, 'config.json'), '{oops');
  expect(await lerPreferencias(dir)).toEqual(PREFERENCIAS_PADRAO);
});
it('completa campos faltando com padrões', async () => {
  await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify({ sobreVoce: 'X' }));
  const p = await lerPreferencias(dir);
  expect(p.sobreVoce).toBe('X'); expect(p.atalhos).toEqual(ATALHOS_PADRAO);
});
// chaves.test.ts (cripto falsa: base64 reversível)
it('salva parcial e preserva a outra chave', async () => {
  const cofre = criarCofreChaves(dir, criptoFalsa);
  await cofre.salvar({ anthropic: 'sk-a' }); await cofre.salvar({ soniox: 'so-b' });
  expect(await cofre.obter()).toEqual({ anthropic: 'sk-a', soniox: 'so-b' });
});
it('o arquivo não contém a chave em texto puro', async () => {
  // criptoFalsa inverte os bytes antes do base64; o arquivo não pode conter 'sk-a'
});
it('sem arquivo devolve nulos', async () => {
  expect(await criarCofreChaves(dir, criptoFalsa).obter()).toEqual({ anthropic: null, soniox: null });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/config`. O esperado é FALHA por módulos inexistentes.

- [ ] **Passo 3: Implementar os três módulos**

  - Leitura: arquivo ausente ou JSON inválido devolvem os padrões. Faça um merge raso com `PREFERENCIAS_PADRAO`, e com `ATALHOS_PADRAO` dentro de `atalhos`.
  - Gravação atômica: escreva num `.tmp` e depois `rename`.
  - `criarCofreChaves.salvar` lança `Error('Criptografia do Windows indisponível')` se `cripto.disponivel()` for falso.

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/config`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Add preferences, hotkey validation and encrypted key store".

---

### Task 3: Leitura de documentos

**Arquivos:**
- Criar: `src/main/documentos/dividir.ts`, `pdf.ts`, `docx.ts`, `pptx.ts`, `xlsx.ts`, `texto.ts`, `ler-documento.ts`, `gerar-exemplos.ts` (só para testes)
- Testar: `src/main/documentos/dividir.test.ts`, `src/main/documentos/ler-documento.test.ts`

**Interfaces:**
- Consome: `DocumentoLido`, `ParteDoc` e `AvisoDoc` (Task 1).
- Produz:
  - `dividirTexto(texto: string, maxChars = 3000): string[]`: corta em parágrafos (`\n\n`); se um parágrafo passar do limite, corta em fim de frase (`. `); em último caso, corta seco. Descarta pedaços vazios.
  - `lerDocumento(caminho: string): Promise<DocumentoLido>`: escolhe o leitor pela extensão, em minúsculas. Nunca lança erro: qualquer exceção vira `aviso: 'erro-leitura'` com `partes: []`.
  - Leitores internos: `lerPdf(buf: Uint8Array): Promise<ParteDoc[]>`, `lerDocx(caminho)`, `lerPptx(buf)`, `lerXlsx(buf)`, `lerTexto(caminho)`.

Rótulos e regras (§7):

- **PDF:** rótulo `p. N`, um por página com texto.
  - Carregue `pdfjs-dist/legacy/build/pdf.mjs` com `await import()`. Antes, defina `globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs')`, para o pdf.js usar o worker no mesmo processo, sem import dinâmico de arquivo.
  - Chame `getDocument({ data, isEvalSupported: false })`. O texto de cada página é a junção dos `item.str`, com quebra de linha quando `hasEOL`.
  - Média abaixo de 20 caracteres por página resulta em `aviso: 'digitalizado'`, `partes: []`.
- **DOCX:** `mammoth.convertToHtml({ path })`.
  - Divida nos `<h1>`, `<h2>` e `<h3>`. O rótulo é o texto do título (máximo de 60 caracteres).
  - O texto antes do primeiro título recebe o rótulo `seção 1`. Sem nenhum título, os rótulos são `seção N`, sobre `dividirTexto`.
  - Uma seção maior que 3.000 caracteres é dividida, e as partes seguintes recebem `"<rótulo> (cont.)"`.
  - O texto vem sem tags HTML, com as entidades decodificadas.
- **PPTX:** JSZip. Leia `ppt/slides/slideN.xml` em ordem numérica.
  - O texto vem das tags `<a:t>`, com quebra de linha a cada `</a:p>`.
  - As notas são achadas pelo `ppt/slides/_rels/slideN.xml.rels` (Target `../notesSlides/notesSlideM.xml`) e anexadas como `"\nNotas: …"`.
  - Rótulo `slide N`. Slides vazios são omitidos.
- **XLSX:** `exceljs` (`workbook.xlsx.load(buf)`). Cada aba vira uma parte com rótulo `aba <nome>`.
  - O texto tem uma linha por linha não vazia da planilha, com os valores de `cell.text` separados por `; `.
  - Abas vazias são omitidas.
- **TXT/MD:** UTF-8 sem BOM, sobre `dividirTexto`. Rótulo `parte N`.
- **Extensões:** `.doc`, `.xls` e `.ppt` resultam em `aviso: 'formato-antigo'`. Qualquer outra extensão resulta em `'nao-suportado'`. `nome` é o nome do arquivo com extensão.

`gerar-exemplos.ts` exporta funções que gravam arquivos de exemplo num diretório:
- `gerarPdf(dir, paginas: string[])`, com pdf-lib e Helvetica (texto ASCII). Página `''` fica em branco.
- `gerarDocx(dir, secoes: { titulo?: string; texto: string }[])`, com `docx`, `HeadingLevel.HEADING_1`.
- `gerarPptx(dir, slides: { texto: string; notas?: string }[])`, com pptxgenjs, `write({ outputType: 'nodebuffer' })`.
- `gerarXlsx(dir, abas: { nome: string; linhas: (string | number)[][] }[])`, com exceljs.

Cada uma devolve o caminho do arquivo.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
// dividir.test.ts
it('mantém texto curto inteiro', () => { expect(dividirTexto('abc')).toEqual(['abc']); });
it('corta em parágrafos sem passar do limite', () => {
  const p = 'a'.repeat(2000); const partes = dividirTexto(`${p}\n\n${p}`);
  expect(partes).toHaveLength(2); expect(partes.every((x) => x.length <= 3000)).toBe(true);
});
it('corta parágrafo gigante', () => { expect(dividirTexto('x'.repeat(7000)).every((x) => x.length <= 3000)).toBe(true); });
// ler-documento.test.ts (diretório temporário)
it('PDF: uma parte por página com rótulo', async () => {
  const doc = await lerDocumento(await gerarPdf(dir, ['Modulo Faturamento emite NF-e', 'Regra de rateio por centro de custo']));
  expect(doc.aviso).toBeNull();
  expect(doc.partes.map((p) => p.rotulo)).toEqual(['p. 1', 'p. 2']);
  expect(doc.partes[1].texto).toContain('rateio');
});
it('PDF sem texto é marcado como digitalizado', async () => {
  const doc = await lerDocumento(await gerarPdf(dir, ['', '']));
  expect(doc.aviso).toBe('digitalizado'); expect(doc.partes).toEqual([]);
});
it('DOCX: divide por títulos', async () => {
  const doc = await lerDocumento(await gerarDocx(dir, [{ titulo: 'Cadastro', texto: 'Cadastro de clientes' }, { titulo: 'Faturamento', texto: 'Emissão de notas' }]));
  expect(doc.partes.map((p) => p.rotulo)).toEqual(['Cadastro', 'Faturamento']);
});
it('PPTX: slides e notas', async () => {
  const doc = await lerDocumento(await gerarPptx(dir, [{ texto: 'Visão geral', notas: 'Falar do SLA' }, { texto: 'Integrações' }]));
  expect(doc.partes.map((p) => p.rotulo)).toEqual(['slide 1', 'slide 2']);
  expect(doc.partes[0].texto).toContain('Notas: Falar do SLA');
});
it('XLSX: uma parte por aba', async () => {
  const doc = await lerDocumento(await gerarXlsx(dir, [{ nome: 'Impostos', linhas: [['ICMS', 18], ['ISS', 5]] }]));
  expect(doc.partes).toEqual([{ rotulo: 'aba Impostos', texto: 'ICMS; 18\nISS; 5' }]);
});
it('formato antigo', async () => { expect((await lerDocumento(path.join(dir, 'velho.doc'))).aviso).toBe('formato-antigo'); });
it('arquivo inexistente não lança', async () => { expect((await lerDocumento(path.join(dir, 'nao.pdf'))).aviso).toBe('erro-leitura'); });
it('TXT com BOM', async () => {
  await fs.writeFile(path.join(dir, 'a.txt'), '﻿olá');
  expect((await lerDocumento(path.join(dir, 'a.txt'))).partes).toEqual([{ rotulo: 'parte 1', texto: 'olá' }]);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/documentos`. O esperado é FALHA.

- [ ] **Passo 3: Implementar `dividir.ts`, os cinco leitores, `ler-documento.ts` e `gerar-exemplos.ts`**

  Siga as regras acima. Se o pdf.js reclamar de `DOMMatrix` ou de canvas ausente ao carregar no Node, defina um polyfill mínimo de `DOMMatrix` antes do `import` (só a extração de texto é usada). Registre essa decisão num comentário de uma linha.

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/documentos`. O esperado é passar.

- [ ] **Passo 5: Conferir o import dinâmico no build**

  Rode `npm run build && grep -c 'import("pdfjs-dist' out/main/index.js`. O esperado é um número maior que 0: o pdf.js continua como `import()` nativo e não virou `require`. Se virou `require`, ajuste a config do `main` para manter `pdfjs-dist` externo e preservar o `import()`.

- [ ] **Passo 6: Commit**

  "Read PDF, DOCX, PPTX, XLSX and text documents into labeled parts".

---

### Task 4: Transcrição — acumulador, transcrição em memória e reconexão

**Arquivos:**
- Criar: `src/main/transcricao/acumulador.ts`, `src/main/transcricao/transcricao.ts`, `src/main/transcricao/reconexao.ts`
- Testar: `src/main/transcricao/acumulador.test.ts`, `src/main/transcricao/transcricao.test.ts`, `src/main/transcricao/reconexao.test.ts`

**Interfaces:**
- Consome: `Fala`, `Quem` e `Idioma` (Task 1).
- Produz:
  - `type TokenStt = { text: string; is_final: boolean; language?: string }`.
  - `class AcumuladorFalas`:
    - `constructor(quem: Quem, maxMsSemFim = 30_000)`;
    - `adicionar(tokens: TokenStt[], agora: number): { parcial: string; fala: Fala | null }`;
    - `fimDeFala(agora: number): Fala | null`.
  - `class Transcricao`:
    - `adicionar(f: Fala): void`;
    - `janela(ms: number, agora: number): Fala[]`, com as falas de `em >= agora - ms`;
    - `todas(): Fala[]`;
    - `ultimaDe(quem: Quem): number | null`;
    - `ultimaQualquer(): number | null`;
    - `limpar(): void`.
  - `formatarFalas(falas: Fala[]): string`: linhas `"[Outros] texto"` e `"[Você] texto"`, separadas por `\n`.
  - `atrasoReconexao(tentativa: number): number`: tentativas 0 a 3 dão 1000, 2000, 4000 e 8000; tentativas a partir de 4 dão 15000.

Regras do acumulador:
- Tokens finais vão para o buffer. Os não finais formam só a cauda do `parcial`, que é o texto final mais o não final.
- O idioma da fala é o mais frequente entre os tokens finais: `'en'` quando for `en`, `'pt'` em qualquer outro caso, inclusive empate ou ausência.
- O texto da fala vem com `trim()`. Buffer vazio ou só com espaços dá `null`.
- Quando o buffer tem texto final há `maxMsSemFim` ms, contados desde o primeiro token final do buffer, `adicionar` devolve a `fala` e zera o buffer.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
const t = (text: string, is_final = true, language = 'pt') => ({ text, is_final, language });
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
it('fim de fala sem texto devolve null', () => { expect(new AcumuladorFalas('voce').fimDeFala(0)).toBeNull(); });
it('emite fala após 30 s sem fim de fala', () => {          // Review Focus 2
  const a = new AcumuladorFalas('outros');
  expect(a.adicionar([t('Primeiro trecho ')], 0).fala).toBeNull();
  const r = a.adicionar([t('continua')], 30_000);
  expect(r.fala?.texto).toBe('Primeiro trecho continua');
  expect(a.fimDeFala(30_001)).toBeNull();
});
// transcricao.test.ts
it('janela pega só os últimos ms', () => {
  const tr = new Transcricao();
  tr.adicionar({ quem: 'outros', texto: 'velha', idioma: 'pt', em: 0 });
  tr.adicionar({ quem: 'voce', texto: 'nova', idioma: 'pt', em: 200_000 });
  expect(tr.janela(180_000, 200_000).map((f) => f.texto)).toEqual(['nova']);
  expect(tr.ultimaDe('outros')).toBe(0); expect(tr.ultimaQualquer()).toBe(200_000);
});
it('formata com rótulos', () => {
  expect(formatarFalas([{ quem: 'outros', texto: 'Oi', idioma: 'pt', em: 0 }, { quem: 'voce', texto: 'Olá', idioma: 'pt', em: 1 }]))
    .toBe('[Outros] Oi\n[Você] Olá');
});
// reconexao.test.ts
it('sequência de espera', () => {
  expect([0, 1, 2, 3, 4, 9].map(atrasoReconexao)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/transcricao`. O esperado é FALHA.

- [ ] **Passo 3: Implementar os três módulos, seguindo as regras acima**

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/transcricao`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Add utterance accumulator, in-memory transcript and reconnect backoff".

---

### Task 5: Sessão de transcrição Soniox

**Arquivos:**
- Criar: `src/main/transcricao/sessao-soniox.ts`
- Testar: `src/main/transcricao/sessao-soniox.test.ts`

**Interfaces:**
- Consome: `AcumuladorFalas` e `atrasoReconexao` (Task 4); `Fala`, `Quem` e `StatusConexao` (Task 1); `@soniox/node`, que exporta `SonioxNodeClient`, `RealtimeSttSession`, `SttSessionConfig`, `AuthError` e `QuotaError`.
- Produz:

```ts
export interface CallbacksStt {
  aoFalar(f: Fala): void; aoParcial(texto: string): void; aoFimDeFala(): void;
  aoStatus(s: StatusConexao, motivo?: 'chave' | 'cota'): void;
}
export interface SttSession { iniciar(): Promise<void>; enviarAudio(pcm: Uint8Array): void; pausar(): void; retomar(): void; encerrar(): Promise<void> }
export type SessaoSdk = Pick<RealtimeSttSession, 'connect' | 'sendAudio' | 'pause' | 'resume' | 'finish' | 'close' | 'on'>;
export const CONFIG_SONIOX: SttSessionConfig; // valores das Global Constraints
export function criarSessaoSoniox(quem: Quem, cb: CallbacksStt, fabrica: (c: SttSessionConfig) => SessaoSdk): SttSession;
export function fabricaSoniox(apiKey: string): (c: SttSessionConfig) => SessaoSdk; // new SonioxNodeClient({ api_key }).realtime.stt(c)
```

Comportamento:
- **Início:** `iniciar` cria a sessão do SDK, registra os eventos `result`, `endpoint`, `error` e `disconnected`, faz `await connect()` e chama `aoStatus('ok')`.
- **Resultados:**
  - `result` passa pelo `acumulador.adicionar(result.tokens, Date.now())`, chama `aoParcial` e, se houver fala, `aoFalar`.
  - `endpoint` passa pelo `fimDeFala`, chama `aoFalar` (se houver fala) e depois `aoFimDeFala()`.
- **Erros:**
  - `AuthError` (de `connect` ou do evento `error`) chama `aoStatus('erro', 'chave')`, sem reconectar.
  - `QuotaError` chama `aoStatus('erro', 'cota')`, sem reconectar.
  - Qualquer outro erro, ou `disconnected` fora de `encerrar`, chama `aoStatus('reconectando')`, chama `close()` na sessão antiga e agenda `setTimeout(atrasoReconexao(n))` para criar uma sessão nova. Quando conectar, zera `n` e chama `aoStatus('ok')`.
- **Envio de áudio:** `enviarAudio` é descartado em silêncio enquanto a sessão não está conectada ou está pausada.
- **Pausa:** `pausar` e `retomar` repassam ao SDK.
- **Encerramento:** `encerrar` marca o encerramento, faz `await finish()` (ignorando erro), entrega a fala pendente (`fimDeFala`) e cancela reconexões agendadas.

- [ ] **Passo 1: Escrever os testes que falham**

  Use uma sessão falsa: um objeto com `on(evt, fn)` que guarda os handlers, `connect` que resolve ou rejeita, e espiões `vi.fn()` para o resto. Use `vi.useFakeTimers()`.

```ts
it('usa a configuração exigida', async () => {
  const fabrica = vi.fn(() => falsa()); await criarSessaoSoniox('outros', cb, fabrica).iniciar();
  expect(fabrica).toHaveBeenCalledWith(expect.objectContaining({ model: 'stt-rt-v5', audio_format: 'pcm_s16le',
    sample_rate: 16000, num_channels: 1, language_hints: ['pt', 'en'], enable_language_identification: true, enable_endpoint_detection: true }));
  expect(cb.aoStatus).toHaveBeenCalledWith('ok');
});
it('resultado + endpoint viram fala e fim de fala', async () => {
  // emitir result {tokens:[{text:'Qual o SLA?',is_final:true,language:'pt',confidence:1}]} e depois endpoint
  expect(cb.aoFalar).toHaveBeenCalledWith(expect.objectContaining({ quem: 'outros', texto: 'Qual o SLA?' }));
  expect(cb.aoFimDeFala).toHaveBeenCalledTimes(1);
});
it('queda reconecta com espera e volta ao ok', async () => {
  // emitir disconnected → aoStatus('reconectando'); avançar 1000 ms → fabrica chamada 2x; aoStatus('ok') de novo
});
it('chave inválida não reconecta', async () => {
  // connect rejeita com Object.create(AuthError.prototype) → aoStatus('erro','chave'); avançar 60 s → fabrica chamada 1x
});
it('áudio pausado é descartado', async () => {
  const s = criarSessaoSoniox('voce', cb, () => sdk); await s.iniciar(); s.pausar(); s.enviarAudio(new Uint8Array(2));
  expect(sdk.sendAudio).not.toHaveBeenCalled();
});
it('encerrar entrega a fala pendente e não reconecta', async () => {
  // result final sem endpoint; encerrar(); depois disconnected → aoFalar chamado 1x, sem novo fabrica
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/transcricao/sessao-soniox.test.ts`. O esperado é FALHA.

- [ ] **Passo 3: Implementar `sessao-soniox.ts`, seguindo o comportamento acima**

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/transcricao`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Add Soniox realtime session with reconnect and status reporting".

---

### Task 6: Montagem dos pedidos à IA (partes puras)

**Arquivos:**
- Criar: `src/main/ia/modelos.ts`, `src/main/ia/instrucoes.ts`, `src/main/ia/prefixo.ts`, `src/main/ia/fontes.ts`, `src/main/ia/interpretar-cartao.ts`
- Testar: `src/main/ia/prefixo.test.ts`, `src/main/ia/fontes.test.ts`, `src/main/ia/interpretar-cartao.test.ts`, `src/main/ia/instrucoes.test.ts`

**Interfaces:**
- Consome: `ContextoReuniao`, `DocumentoLido`, `Fonte`, `CamposCartao`, `TipoCartao` e `IdiomaSugestao` (Task 1).
- Produz:

```ts
// modelos.ts
export const MODELO_DETECTOR = 'claude-haiku-5-5';
export const MODELO_PRINCIPAL = 'claude-opus-5-5';
export const BETAS_OPUS = ['server-side-fallback-2026-07-01'];
// prefixo.ts
import type Anthropic from '@anthropic-ai/sdk';
type B = Anthropic.Beta.Messages;
export type Papel = 'detector' | 'explicador' | 'resumo';
export interface PrefixoPedido {
  system: B.BetaTextBlockParam[]; documentos: B.BetaRequestDocumentBlock[];
  mapaFontes: { arquivo: string; rotulos: string[] }[];
}
export function montarPrefixo(ctx: ContextoReuniao, papel: Papel): PrefixoPedido;
export function montarMensagens(p: PrefixoPedido, tarefa: string): B.BetaMessageParam[];
// fontes.ts
export function fontesDeCitacoes(citacoes: unknown[], mapa: PrefixoPedido['mapaFontes']): Fonte[];
// interpretar-cartao.ts
export const MARCADORES = { titulo: 'TÍTULO:', digaIsso: 'DIGA ISSO:', explicacao: 'EXPLICAÇÃO:', comoExplicar: 'COMO EXPLICAR AO CLIENTE:', resposta: 'RESPOSTA:' } as const;
export function interpretarCartao(tipo: TipoCartao, texto: string): { titulo?: string; campos: CamposCartao };
// instrucoes.ts
export function instrucoes(papel: Papel, idioma: IdiomaSugestao): string;
```

Regras do `montarPrefixo` (§6.2):
- **`system`:** blocos de texto nesta ordem:
  1. `instrucoes(papel, ctx.idioma)`;
  2. `"Sobre a usuária: …"`, só se `sobreVoce` não for vazio;
  3. `"Contexto da reunião: …"`, só se `contexto` não for vazio.

  A saída é pura: nada de data, hora ou id.
- **`documentos`:** só os documentos com `aviso === null`, na ordem recebida. Cada um vira:

  ```
  { type: 'document', title: nome,
    source: { type: 'content', content: partes.map(p => ({ type: 'text', text: `[${p.rotulo}]\n${p.texto}` })) },
    citations: { enabled: papel === 'explicador' } }
  ```

- **`cache_control`:** vai em **um único lugar**, o último documento ou, sem documentos, o último bloco do `system`. O valor é `{ type: 'ephemeral', ttl: '1h' }` para `explicador` e `resumo`, e `{ type: 'ephemeral' }` para `detector`.
- **`mapaFontes`:** fica alinhado com `documentos` (`rotulos` = os rótulos das partes).
- **`montarMensagens`:** devolve `[{ role: 'user', content: [...documentos, { type: 'text', text: tarefa }] }]`.

Regras do `interpretarCartao`:
- Os marcadores ficam no início de uma linha.
- O valor de cada campo é o texto até o próximo marcador, com `trim()`.
- Um prefixo de marcador incompleto no fim do texto, como `"\nDIGA IS"` durante o streaming, é removido do campo anterior.
- Se não houver nenhum marcador e o texto não estiver vazio, tudo vai para o campo principal do tipo: `diga-isso` → `digaIsso`, `conceito` → `explicacao`, `resposta` → `resposta`.

Regras do `fontesDeCitacoes`:
- Considera só citações `type === 'content_block_location'`.
- `arquivo = mapa[document_index].arquivo` e `local = mapa[document_index].rotulos[start_block_index]`.
- Remove duplicatas e ignora índices fora do mapa.

Regras do `instrucoes` (§6.1 a 6.3). O texto, em português, precisa conter:
- **Detector:** as definições de "pergunta" (feita diretamente à usuária pelos [Outros], sem conversa casual) e de "conceito" (termo técnico ou de negócio que alguém que não conhece o sistema pode não saber; termos comuns ficam de fora). Também: no máximo 2 itens, nunca repetir itens já cobertos, e que é melhor não devolver nada do que devolver itens fracos.
- **Explicador:** os marcadores exatos para cada tipo de cartão (`TÍTULO:` sempre primeiro). O "Diga isso" vem na primeira pessoa, com 2 a 4 frases faladas e naturais. A explicação vem em português, com 2 ou 3 frases. "Como explicar ao cliente" tem 1 ou 2 frases. Use os documentos quando forem relevantes e, quando não forem, o conhecimento geral, sem avisos.
- **Regra de idioma:**
  - `auto`: "Diga isso" e "Como explicar ao cliente" no idioma da conversa;
  - `pt` ou `en`: esses campos no idioma fixado;
  - em qualquer caso, a explicação e a resposta em português.
- **Resumo:** em português, com assuntos, dúvidas do cliente, decisões, pendências e próximos passos.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
const doc = (nome: string, rotulos: string[], aviso: DocumentoLido['aviso'] = null): DocumentoLido =>
  ({ caminho: nome, nome, tipo: 'pdf', aviso, partes: rotulos.map((r) => ({ rotulo: r, texto: `texto ${r}` })) });
const ctx: ContextoReuniao = { documentos: [doc('Manual.pdf', ['p. 1', 'p. 2']), doc('Scan.pdf', [], 'digitalizado')], contexto: 'Cliente hospital', sobreVoce: 'Consultora', idioma: 'auto' };
it('prefixo é idêntico byte a byte entre chamadas', () => {
  expect(JSON.stringify(montarPrefixo(ctx, 'explicador'))).toBe(JSON.stringify(montarPrefixo(ctx, 'explicador')));
});
it('cache de 1 h só no último documento do explicador', () => {
  const p = montarPrefixo(ctx, 'explicador');
  expect(p.documentos).toHaveLength(1);
  expect(p.documentos[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
  expect(p.system.every((b) => !b.cache_control)).toBe(true);
  expect(p.documentos[0].citations).toEqual({ enabled: true });
});
it('detector: cache 5 min e sem citações', () => {
  const p = montarPrefixo(ctx, 'detector');
  expect(p.documentos[0].cache_control).toEqual({ type: 'ephemeral' }); expect(p.documentos[0].citations).toEqual({ enabled: false });
});
it('montarPrefixo sem documentos põe o cache no system', () => {   // Review Focus 1
  const p = montarPrefixo({ ...ctx, documentos: [] }, 'explicador');
  expect(p.documentos).toEqual([]); expect(p.system.at(-1)?.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
});
it('mensagens: documentos e depois a tarefa', () => {
  const m = montarMensagens(montarPrefixo(ctx, 'explicador'), 'TAREFA');
  expect(m[0].content.at(-1)).toEqual({ type: 'text', text: 'TAREFA' });
});
it('rótulo vai no texto de cada parte', () => {
  const src = montarPrefixo(ctx, 'explicador').documentos[0].source as { content: { text: string }[] };
  expect(src.content[1].text).toBe('[p. 2]\ntexto p. 2');
});
// fontes.test.ts
it('converte content_block_location em arquivo e página', () => {
  const mapa = [{ arquivo: 'Manual.pdf', rotulos: ['p. 1', 'p. 2'] }];
  expect(fontesDeCitacoes([{ type: 'content_block_location', document_index: 0, start_block_index: 1, end_block_index: 2 },
    { type: 'content_block_location', document_index: 0, start_block_index: 1, end_block_index: 2 }, { type: 'char_location' }], mapa))
    .toEqual([{ arquivo: 'Manual.pdf', local: 'p. 2' }]);
});
// interpretar-cartao.test.ts
it('conceito com marcadores', () => {
  expect(interpretarCartao('conceito', 'TÍTULO: Rateio\nEXPLICAÇÃO: Divide custos.\nCOMO EXPLICAR AO CLIENTE: É a divisão.'))
    .toEqual({ titulo: 'Rateio', campos: { explicacao: 'Divide custos.', comoExplicar: 'É a divisão.' } });
});
it('marcador incompleto no fim não vaza', () => {
  expect(interpretarCartao('diga-isso', 'TÍTULO: Prazo\nDIGA ISSO: Em duas semanas.\nCOMO EX').campos.digaIsso).toBe('Em duas semanas.');
});
it('texto sem marcadores vai para o campo principal', () => {   // Review Focus 3
  expect(interpretarCartao('conceito', 'Rateio é dividir custos.').campos).toEqual({ explicacao: 'Rateio é dividir custos.' });
});
// instrucoes.test.ts
it('explicador cita todos os marcadores', () => {
  const t = instrucoes('explicador', 'auto'); for (const m of Object.values(MARCADORES)) expect(t).toContain(m);
});
it('idioma fixo em inglês aparece na instrução', () => { expect(instrucoes('explicador', 'en')).toMatch(/inglês/i); });
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/ia`. O esperado é FALHA.

- [ ] **Passo 3: Implementar os cinco módulos, seguindo as regras acima**

  Se algum nome de tipo do SDK for diferente dos usados aqui (`BetaRequestDocumentBlock`, `BetaTextBlockParam`), use o nome que o `@anthropic-ai/sdk` 1.3.0 instalado exporta e mantenha o formato dos objetos.

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/ia && npm run typecheck`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Build deterministic cached prompts, card parser and citation mapping".

---

### Task 7: Chamadas à IA — detector, explicador, resumo, tokens e verificação de chaves

**Arquivos:**
- Criar: `src/main/ia/erros.ts`, `src/main/ia/estruturado.ts`, `src/main/ia/tokens.ts`, `src/main/ia/detector.ts`, `src/main/ia/explicador.ts`, `src/main/ia/resumo.ts`, `src/main/ia/chaves-verificacao.ts`
- Testar: `src/main/ia/erros.test.ts`, `src/main/ia/tokens.test.ts`, `src/main/ia/detector.test.ts`, `src/main/ia/explicador.test.ts`, `src/main/ia/resumo.test.ts`

**Interfaces:**
- Consome: tudo da Task 6; `Fala`, `ItemDetectado`, `ConteudoCartao`, `TipoCartao`, `ResumoReuniao` e `DocumentoLido` (Task 1); `formatarFalas` (Task 4).
- Produz:

```ts
// erros.ts
export type ClasseErro = 'chave' | 'permissao' | 'limite' | 'rede' | 'recusa' | 'tempo' | 'outro';
export class RecusaIa extends Error {}
export class TempoEsgotado extends Error {}
export function classificarErro(e: unknown): ClasseErro;
// estruturado.ts
export async function pedirEstruturado<T>(cliente: Anthropic, args: {
  modelo: string; esforco: 'low' | 'medium'; system: B.BetaTextBlockParam[]; mensagens: B.BetaMessageParam[];
  esquema: z.ZodType<T>; maxTokens: number;
}): Promise<T>;
// tokens.ts
export async function contarTokensDocumentos(cliente: Anthropic, docs: DocumentoLido[]): Promise<{ tokens: number; estimado: boolean }>;
// detector.ts
export interface Detector { detectar(janela: Fala[], cobertos: string[]): Promise<ItemDetectado[]> }
export function criarDetector(cliente: Anthropic, prefixo: PrefixoPedido): Detector;
// explicador.ts
export interface PedidoCartao { tipo: TipoCartao; alvo?: string; janela: Fala[] }
export interface Explicador {
  preaquecer(): Promise<void>;
  explicar(pedido: PedidoCartao, aoAtualizar: (c: ConteudoCartao) => void): Promise<ConteudoCartao>;
}
export function criarExplicador(cliente: Anthropic, prefixo: PrefixoPedido, opcoes?: { tempoMaxMs?: number }): Explicador;
// resumo.ts
export interface Resumidor { resumir(transcricao: Fala[], conceitos: string[]): Promise<ResumoReuniao> }
export function criarResumidor(cliente: Anthropic, prefixo: PrefixoPedido): Resumidor;
// chaves-verificacao.ts (ResultadoChave vem de src/shared/tipos.ts)
export async function verificarChaveAnthropic(cliente: Pick<Anthropic, 'models'>): Promise<ResultadoChave>; // models.retrieve(MODELO_DETECTOR)
export async function verificarChaveSoniox(cliente: { models: { list(): Promise<unknown> } }): Promise<ResultadoChave>;
```

Regras:
- **`classificarErro`:**
  - `Anthropic.AuthenticationError` → `chave`;
  - `PermissionDeniedError` → `permissao`;
  - `RateLimitError` → `limite`;
  - `APIConnectionError` → `rede`;
  - `RecusaIa` → `recusa`;
  - `TempoEsgotado` → `tempo`;
  - qualquer outra coisa → `outro`.

  Use `instanceof` sem comparar mensagens. Nos testes, crie as instâncias com `Object.create(Classe.prototype)`.
- **`pedirEstruturado`:**
  - Chama `cliente.beta.messages.create` com `model`, `max_tokens`, `system`, `messages` e `output_config: { effort, format: { type: 'json_schema', schema: z.toJSONSchema(esquema) } }`.
  - Para o Opus, acrescenta `betas: BETAS_OPUS` e `fallbacks: 'default'`.
  - `stop_reason === 'refusal'` lança `RecusaIa`.
  - O JSON vem da junção dos blocos `text` e é validado com `esquema.parse`.
  - Os esquemas usam `z.strictObject` (`additionalProperties: false`).
- **`contarTokensDocumentos`:**
  - Usa `cliente.beta.messages.countTokens({ model: MODELO_DETECTOR, messages: [{ role: 'user', content: [...docBlocks, { type: 'text', text: '.' }] }] })`, onde os blocos de documento vêm de `montarPrefixo(..., 'detector')` com `contexto` e `sobreVoce` vazios.
  - Em qualquer erro, devolve `{ tokens: Math.ceil(totalCaracteres / 3), estimado: true }`.
  - Lista vazia devolve `{ tokens: 0, estimado: false }`, sem chamar a API.
- **Detector:**
  - `pedirEstruturado` com `MODELO_DETECTOR`, `esforco: 'low'`, `maxTokens: 2000`.
  - Esquema: `{ itens: { tipo: 'pergunta' | 'conceito'; texto: string; idioma: 'pt' | 'en' }[] }`.
  - Tarefa: `formatarFalas(janela)` mais a lista `cobertos`.
  - Devolve no máximo os 2 primeiros itens.
  - Janela sem nenhuma fala dos `outros` devolve `[]` sem chamar a API.
- **Explicador:**
  - `cliente.beta.messages.stream` com `MODELO_PRINCIPAL`, `max_tokens: 4000`, `output_config: { effort: 'low' }`, `betas: BETAS_OPUS`, `fallbacks: 'default'` e as mensagens de `montarMensagens(prefixo, tarefa)`.
  - A tarefa contém o tipo de cartão, o `alvo` (ou "identifique a pergunta/termo mais recente") e `formatarFalas(janela)`.
  - A cada `content_block_delta`:
    - `text_delta` acumula o texto;
    - `citations_delta` acumula `delta.citation`.

    Depois de cada um, chama `aoAtualizar({ ...interpretarCartao(tipo, texto), fontes: fontesDeCitacoes(...) })`.
  - Ao final, `stop_reason === 'refusal'` lança `RecusaIa`.
  - Tempo máximo de 20 s (`tempoMaxMs`, padrão 20 000): um `AbortController` passado como `{ signal }` nas opções da requisição. Se estourar, lança `TempoEsgotado`.
  - Uma única nova tentativa automática para qualquer classe, exceto `chave` e `permissao`. Ao tentar de novo, o texto e as citações são zerados.
  - `preaquecer()` chama `cliente.beta.messages.create` com os mesmos `model`, `output_config`, `betas`, `fallbacks` e o mesmo prefixo, tarefa `'.'`, `max_tokens: 0`, sem stream. Qualquer erro é ignorado (só registrado no console).
  - **Desvio consciente da spec §5.1:** só o explicador é pré-aquecido. O detector usa saída estruturada, e a API recusa `max_tokens: 0` com saída estruturada. O primeiro ciclo do detector grava o cache dele, o que é barato no Haiku. Registre isso num comentário de uma linha em `detector.ts`.
- **Resumidor:** `pedirEstruturado` com `MODELO_PRINCIPAL`, `esforco: 'medium'`, `maxTokens: 8000`, esquema `ResumoReuniao`. Tarefa: a transcrição completa formatada mais a lista de conceitos.

- [ ] **Passo 1: Escrever os testes que falham**

  Use um cliente falso, `const cliente = { beta: { messages: { create: vi.fn(), stream: vi.fn(), countTokens: vi.fn() } }, models: { retrieve: vi.fn() } } as unknown as Anthropic`. O `stream` falso devolve um objeto async-iterável com os eventos e com `finalMessage()`.

```ts
it('classifica erros do SDK', () => {
  expect(classificarErro(Object.create(Anthropic.AuthenticationError.prototype))).toBe('chave');
  expect(classificarErro(Object.create(Anthropic.RateLimitError.prototype))).toBe('limite');
  expect(classificarErro(new TempoEsgotado())).toBe('tempo'); expect(classificarErro(new Error('x'))).toBe('outro');
});
it('contagem usa a API', async () => {
  cliente.beta.messages.countTokens.mockResolvedValue({ input_tokens: 1234 });
  expect(await contarTokensDocumentos(cliente, [docExemplo])).toEqual({ tokens: 1234, estimado: false });
});
it('contagem cai para estimativa quando a API falha', async () => {   // Review Focus 4
  cliente.beta.messages.countTokens.mockRejectedValue(new Error('offline'));
  expect(await contarTokensDocumentos(cliente, [docCom3000Caracteres])).toEqual({ tokens: 1000, estimado: true });
});
it('detector: Haiku, esforço baixo, sem fallback, no máximo 2 itens', async () => {
  cliente.beta.messages.create.mockResolvedValue(respostaTexto(JSON.stringify({ itens: [i1, i2, i3] })));
  const itens = await criarDetector(cliente, prefixo).detectar([falaOutros], []);
  expect(itens).toHaveLength(2);
  const args = cliente.beta.messages.create.mock.calls[0][0];
  expect(args.model).toBe('claude-haiku-5-5'); expect(args.output_config.effort).toBe('low');
  expect(args.fallbacks).toBeUndefined(); expect(args.thinking).toBeUndefined();
});
it('detector sem fala dos outros não chama a API', async () => {
  expect(await criarDetector(cliente, prefixo).detectar([falaVoce], [])).toEqual([]);
  expect(cliente.beta.messages.create).not.toHaveBeenCalled();
});
it('explicador: Opus com fallback e streaming com citações', async () => {
  cliente.beta.messages.stream.mockReturnValue(streamFalso([
    delta('TÍTULO: Rateio\nEXPLICAÇÃO: Divide'), citacao(0, 1), delta(' custos.')], 'end_turn'));
  const atualizacoes: ConteudoCartao[] = [];
  const final = await criarExplicador(cliente, prefixo).explicar({ tipo: 'conceito', alvo: 'rateio', janela: [falaOutros] }, (c) => atualizacoes.push(c));
  expect(final).toEqual({ titulo: 'Rateio', campos: { explicacao: 'Divide custos.' }, fontes: [{ arquivo: 'Manual.pdf', local: 'p. 2' }] });
  expect(atualizacoes.length).toBeGreaterThan(1);
  const args = cliente.beta.messages.stream.mock.calls[0][0];
  expect(args).toMatchObject({ model: 'claude-opus-5-5', betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low' } });
});
it('explicador tenta de novo uma vez após erro', async () => { /* 1ª chamada lança erro de rede, 2ª ok → stream chamado 2x, resolve */ });
it('explicador não tenta de novo com chave inválida', async () => { /* lança AuthenticationError → rejeita, stream chamado 1x */ });
it('explicador estoura o tempo', async () => { /* stream que nunca termina, tempoMaxMs 50 → rejeita com TempoEsgotado após 2 tentativas */ });
it('recusa vira RecusaIa', async () => { /* stop_reason 'refusal' nas duas tentativas → rejeita RecusaIa */ });
it('preaquecer usa max_tokens 0 e engole erro', async () => {
  cliente.beta.messages.create.mockRejectedValue(new Error('400'));
  await expect(criarExplicador(cliente, prefixo).preaquecer()).resolves.toBeUndefined();
  expect(cliente.beta.messages.create.mock.calls[0][0].max_tokens).toBe(0);
});
it('resumo valida o esquema', async () => {
  cliente.beta.messages.create.mockResolvedValue(respostaTexto(JSON.stringify(resumoValido)));
  expect(await criarResumidor(cliente, prefixo).resumir([falaOutros], ['Rateio'])).toEqual(resumoValido);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/ia`. O esperado é FALHA nos testes novos.

- [ ] **Passo 3: Implementar os sete módulos, seguindo as regras acima**

  Se `cliente.beta.messages.countTokens` não existir no SDK instalado, use `cliente.messages.countTokens` com os mesmos blocos e ajuste o teste.

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/ia && npm run typecheck`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Add Haiku detector, streaming Opus explainer, summary and token counting".

---

### Task 8: Orquestração da reunião

**Arquivos:**
- Criar: `src/main/reuniao/normalizar.ts`, `src/main/reuniao/agendador.ts`, `src/main/reuniao/sessao-reuniao.ts`
- Testar: `src/main/reuniao/normalizar.test.ts`, `src/main/reuniao/agendador.test.ts`, `src/main/reuniao/sessao-reuniao.test.ts`

**Interfaces:**
- Consome: `SttSession` e `CallbacksStt` (Task 5); `Transcricao` (Task 4); `Detector`, `Explicador`, `PedidoCartao`, `Resumidor` e `classificarErro` (Task 7); tipos da Task 1; `TEXTO_AVISO` (Task 1).
- Produz:

```ts
// normalizar.ts
export function normalizarChave(texto: string): string;
// agendador.ts
export class AgendadorDetector {
  constructor(executar: () => Promise<void>, opcoes?: { intervaloMs?: number; atrasoFimDeFalaMs?: number });
  iniciar(): void; parar(): void; novaFala(): void; fimDeFalaOutros(): void; desacelerar(porMs: number): void;
}
// sessao-reuniao.ts
export interface DepsReuniao {
  criarStt(quem: Quem, cb: CallbacksStt): SttSession;
  detector: Detector; explicador: Explicador; resumidor: Resumidor;
  publicar(i: InstantaneoReuniao): void; salvar(item: ItemHistoricoReuniao): Promise<void>; gerarId(): string;
}
export interface OpcoesReuniao { modo: 'audio' | 'ensaio'; contexto: ContextoReuniao }
export interface SessaoReuniao {
  iniciar(): Promise<void>; receberAudio(quem: Quem, pcm: Uint8Array): void; falaEnsaio(quem: Quem, texto: string): void;
  ajudarResponder(): void; explicar(): void; perguntar(texto: string): void;
  alternarPausa(): void; navegar(delta: 1 | -1): void;
  encerrar(): Promise<ItemHistoricoReuniao | null>; descartar(): void; instantaneo(): InstantaneoReuniao;
}
export function criarSessaoReuniao(deps: DepsReuniao, opcoes: OpcoesReuniao): SessaoReuniao;
```

Regras:
- **`normalizarChave`:** minúsculas, sem acentos (NFD), sem pontuação, espaços colapsados, e cada palavra com mais de 3 letras perde o `s` final.
- **`AgendadorDetector`:**
  - `iniciar` cria um intervalo de `intervaloMs` (padrão 10 000) que dispara se houve `novaFala` desde a última execução.
  - `fimDeFalaOutros` dispara depois de `atrasoFimDeFalaMs` (padrão 1 500), reiniciando a espera se chamado de novo.
  - Só uma execução por vez. Disparos durante uma execução viram **uma** execução logo depois.
  - `desacelerar(ms)` dobra o intervalo até `Date.now() + ms`.
  - `parar` cancela tudo.
- **Estados:**
  - `iniciar`: `preparando` → `ouvindo`. No modo `audio`, cria as duas sessões de transcrição (`voce` e `outros`) e chama `iniciar` em cada uma. Também inicia o agendador e chama `explicador.preaquecer()` sem esperar.
  - `alternarPausa`: `ouvindo` ⇄ `pausado`. Repassa `pausar`/`retomar` às sessões e `parar`/`iniciar` ao agendador.
  - `encerrar`: `encerrando` → `concluida`.
- **Falas:** `aoFalar` e `falaEnsaio` adicionam à `Transcricao` e chamam `agendador.novaFala()`. `aoFimDeFala` da sessão `outros` (e `falaEnsaio('outros', …)`) chama `fimDeFalaOutros()`. `aoParcial` atualiza `parciais[quem]`.
- **Ciclo do detector:**
  - Chama `detector.detectar(transcricao.janela(180_000, agora), cobertos)`.
  - Para cada item cuja `normalizarChave(texto)` ainda não está em `cobertos`, adiciona a chave e põe o item na fila automática.
  - A fila cria no máximo **1 cartão automático a cada 8 s** e mantém no máximo **2 explicações automáticas simultâneas**.
  - O erro de classe `limite` chama `agendador.desacelerar(60_000)`. Outros erros só são registrados (o ciclo é pulado).
- **Cartões:**
  - Um cartão nasce `escrevendo`, com `titulo` = alvo, ou `'…'` nos atalhos. A cada `aoAtualizar`, os campos, as fontes e o título (quando vier) são mesclados. No fim, o estado vira `pronto`.
  - Em erro, o estado vira `erro`, com `erro = "não consegui agora — aperte Ctrl+Alt+Espaço para tentar de novo"`. Na classe `recusa`, o texto é `"não foi possível gerar esta sugestão"`. Na classe `chave`, também entra o aviso `chave`.
  - Cartões novos entram no **início** da lista, e `indiceAtual` volta para 0.
  - `item.tipo` `'pergunta'` vira cartão `'diga-isso'`; `'conceito'` vira `'conceito'`.
- **Atalhos e pergunta digitada:**
  - Funcionam só em `ouvindo` ou `pausado`. Fora disso, não fazem nada.
  - Ignoram o limite de 8 s e o limite de concorrência.
  - `ajudarResponder` gera `{ tipo: 'diga-isso', janela: últimos 60 s }`; `explicar` gera `{ tipo: 'conceito', janela: últimos 60 s }`; `perguntar(t)` gera `{ tipo: 'resposta', alvo: t, janela: últimos 180 s }`, com origem `'digitado'`.
  - O título do `perguntar` é o próprio texto. Um texto vazio é ignorado.
- **`navegar`:** limita `indiceAtual` entre 0 e o último cartão.
- **Verificação a cada 30 s**, só no modo `audio` e em `ouvindo`:
  - Se a última fala de qualquer um tem mais de 15 min (ou não há fala e o início foi há mais de 15 min), pausa e adiciona o aviso `pausa-automatica`.
  - Se a reunião começou há mais de 2 min, "Você" falou nos últimos 2 min e "Outros" não falou nos últimos 2 min, adiciona o aviso `sem-som-outros` (uma vez só). O aviso sai quando "Outros" volta a falar.
- **Status da transcrição:** `aoStatus` atualiza `conexao[quem]`. Status `erro` com motivo `chave` ou `cota` adiciona o aviso correspondente.
- **`encerrar`:**
  1. Para o agendador e a verificação e faz `await encerrar()` nas sessões de transcrição.
  2. Chama `resumidor.resumir(transcricao.todas(), títulos dos conceitos prontos)`, com uma nova tentativa. Se falhar de novo, usa `resumo = null` e adiciona o aviso `resumo-falhou`.
  3. Monta o `ItemHistoricoReuniao`:
     - `data`: ISO do início;
     - `duracaoMin`: arredondada;
     - `contexto` e `documentos` (nomes);
     - `conceitos`: os cartões `conceito` prontos, como `{ termo: titulo, explicacao, fontes }`.
  4. Chama `await deps.salvar(item)`, limpa a transcrição e os parciais e vai para `concluida`.
  5. Devolve o item. Fora de `ouvindo`/`pausado`, devolve `null`.
- **`descartar`:** para tudo, limpa a transcrição e não salva nada.
- **`publicar`:** chamado a cada mudança, com no máximo 1 publicação a cada 100 ms (a última sempre sai).
- **Áudio:** `receberAudio` repassa para a sessão `quem` só em `ouvindo`.

- [ ] **Passo 1: Escrever os testes que falham**

  Use `vi.useFakeTimers()` e fakes de transcrição, detector, explicador e resumidor feitos com `vi.fn()`.

```ts
// normalizar.test.ts
it('acentos, caixa e plural', () => {
  expect(normalizarChave('APIs REST')).toBe(normalizarChave('api rest'));
  expect(normalizarChave('Faturação!')).toBe('faturacao');
});
// agendador.test.ts
it('fim de fala dos outros dispara após 1,5 s', async () => { /* fimDeFalaOutros(); avançar 1499 → 0 chamadas; avançar 1 → 1 */ });
it('intervalo só dispara com fala nova', async () => { /* iniciar(); avançar 10 s → 0; novaFala(); avançar 10 s → 1 */ });
it('junta disparos durante execução em um só', async () => { /* executar demora; 3 disparos durante → total 2 execuções */ });
it('desacelerar dobra o intervalo', async () => { /* desacelerar(60s); novaFala(); avançar 10 s → 0; avançar 10 s → 1 */ });
// sessao-reuniao.test.ts
it('modo áudio cria as duas sessões e preaquece', async () => {
  await s.iniciar(); expect(deps.criarStt).toHaveBeenCalledTimes(2); expect(explicador.preaquecer).toHaveBeenCalled();
  expect(s.instantaneo().estado).toBe('ouvindo');
});
it('pergunta detectada vira cartão diga-isso pronto', async () => {
  detector.detectar.mockResolvedValue([{ tipo: 'pergunta', texto: 'Qual o prazo?', idioma: 'pt' }]);
  explicador.explicar.mockImplementation(async (_p, cb) => { cb({ campos: { digaIsso: 'Em duas' }, fontes: [] }); return { titulo: 'Prazo', campos: { digaIsso: 'Em duas semanas.' }, fontes: [] }; });
  s.falaEnsaio('outros', 'Qual o prazo?'); await vi.advanceTimersByTimeAsync(1500);
  expect(s.instantaneo().cartoes[0]).toMatchObject({ tipo: 'diga-isso', estado: 'pronto', titulo: 'Prazo', origem: 'automatico' });
});
it('não repete conceito já coberto', async () => { /* detector devolve 'APIs REST' e depois 'api rest' → explicar chamado 1x */ });
it('no máximo 1 cartão automático a cada 8 s', async () => { /* detector devolve 2 conceitos → 1 cartão já; o 2º só após 8 s */ });
it('atalho ignora o limite de 8 s', async () => { /* logo após um automático, ajudarResponder() → explicar chamado imediatamente com tipo 'diga-isso' e janela dos últimos 60 s */ });
it('atalhos fora de reunião ativa não fazem nada', async () => {   // Review Focus 5
  const nova = criarSessaoReuniao(deps, { modo: 'ensaio', contexto: ctx });
  expect(() => { nova.ajudarResponder(); nova.explicar(); nova.perguntar('x'); nova.navegar(1); }).not.toThrow();
  expect(explicador.explicar).not.toHaveBeenCalled();
  await nova.iniciar(); await nova.encerrar(); nova.ajudarResponder();
  expect(explicador.explicar).not.toHaveBeenCalled();
});
it('erro do explicador marca o cartão', async () => { /* explicar rejeita → estado 'erro' com a mensagem do Ctrl+Alt+Espaço */ });
it('pausa automática após 15 min de silêncio', async () => { /* modo audio; avançar 15 min + 30 s → estado 'pausado' e aviso 'pausa-automatica' */ });
it('avisa quando não ouve os outros', async () => { /* modo audio; aos 2 min 30 s só 'voce' falou → aviso 'sem-som-outros' */ });
it('encerrar salva resumo e conceitos, sem transcrição nem diga-isso', async () => {
  const item = await s.encerrar();
  expect(deps.salvar).toHaveBeenCalledWith(item);
  expect(JSON.stringify(item)).not.toContain('Qual o prazo?');           // nem fala nem diga-isso
  expect(item!.conceitos).toEqual([{ termo: 'Rateio', explicacao: 'Divide custos.', fontes: [] }]);
  expect(s.instantaneo().transcricao).toEqual([]); expect(s.instantaneo().estado).toBe('concluida');
});
it('resumo que falha 2x salva só os conceitos', async () => { /* resumir rejeita 2x → item.resumo null, aviso 'resumo-falhou' */ });
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/reuniao`. O esperado é FALHA.

- [ ] **Passo 3: Implementar os três módulos, seguindo as regras acima**

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/reuniao && npm run typecheck`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Orchestrate meeting: detection schedule, card queue, hotkey actions and summary".

---

### Task 9: Histórico

**Arquivos:**
- Criar: `src/main/historico/historico.ts`
- Testar: `src/main/historico/historico.test.ts`

**Interfaces:**
- Consome: `ItemHistorico` e `ResumoItemHistorico` (Task 1).
- Produz:

```ts
export interface Historico {
  listar(): Promise<ResumoItemHistorico[]>; obter(id: string): Promise<ItemHistorico | null>;
  salvar(item: ItemHistorico): Promise<void>; apagar(id: string): Promise<void>;
}
export function criarHistorico(dir: string): Historico; // arquivos em <dir>/historico/<id>.json
```

Regras:
- **`listar`:** ordena por `data`, da mais recente para a mais antiga. `titulo` é a primeira linha do `contexto` (até 60 caracteres) ou `'Reunião'` para reuniões; `'Treino de entrevista'` para treinos. Arquivos ilegíveis são ignorados.
- **Validação do `id`:** `id` precisa casar com `/^[a-z0-9-]{1,64}$/`. Senão, `obter` devolve `null`, e `salvar` e `apagar` lançam `Error('id inválido')`.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it('salva, lista em ordem e obtém', async () => {
  await h.salvar(reuniao('a', '2026-10-01T10:00:00Z')); await h.salvar(reuniao('b', '2026-10-02T10:00:00Z'));
  expect((await h.listar()).map((i) => i.id)).toEqual(['b', 'a']); expect((await h.obter('a'))?.id).toBe('a');
});
it('apagar remove o arquivo', async () => {
  await h.salvar(reuniao('a', '2026-10-01T10:00:00Z')); await h.apagar('a');
  expect(await h.obter('a')).toBeNull(); expect(fs.existsSync(path.join(dir, 'historico', 'a.json'))).toBe(false);
});
it('recusa id com caminho', async () => {
  await expect(h.apagar('../config')).rejects.toThrow('id inválido'); expect(await h.obter('../x')).toBeNull();
});
it('título vem do contexto', async () => {
  await h.salvar({ ...reuniao('a', '2026-10-01T10:00:00Z'), contexto: 'Hospital X\nfaturamento' });
  expect((await h.listar())[0].titulo).toBe('Hospital X');
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/historico`. O esperado é FALHA.

- [ ] **Passo 3: Implementar `historico.ts`, com gravação atômica (`.tmp` e depois `rename`)**

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/historico`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Add local meeting and practice history store".

---

### Task 10: Treino de entrevista (IA)

**Arquivos:**
- Criar: `src/main/ia/treinador.ts`
- Testar: `src/main/ia/treinador.test.ts`

**Interfaces:**
- Consome: `pedirEstruturado` e `MODELO_PRINCIPAL` (Tasks 6 e 7); `ConfigTreino`, `PerguntaTreino`, `AvaliacaoResposta` e `RelatorioTreino` (Task 1).
- Produz:

```ts
export interface RespostaTreino { pergunta: string; resposta: string; avaliacao: AvaliacaoResposta }
export interface Treinador {
  gerarPerguntas(cfg: ConfigTreino): Promise<PerguntaTreino[]>;
  avaliar(cfg: ConfigTreino, pergunta: string, resposta: string): Promise<AvaliacaoResposta>;
  relatorio(cfg: ConfigTreino, respostas: RespostaTreino[]): Promise<RelatorioTreino>;
}
export function criarTreinador(cliente: Anthropic, gerarId: () => string): Treinador;
```

Regras (§3.7):
- **Todas as chamadas:** `pedirEstruturado` com `MODELO_PRINCIPAL`, `esforco: 'medium'`, `maxTokens: 8000`.
- **System:** "você é uma entrevistadora experiente", com a vaga e o currículo no system.
- **Perguntas:**
  - no idioma `cfg.idioma` e no tipo `cfg.tipo`;
  - exatamente `cfg.quantidade` perguntas. Se vierem mais, corte; se vierem menos, aceite.
  - O `id` vem de `gerarId()`.
- **Avaliação:** sempre em português. `dicasIngles` vem vazio quando `cfg.idioma === 'pt'`; se o modelo mandar dicas mesmo assim, elas são descartadas.
- **Relatório:** em português.
- **Uso do áudio:** o treino nunca usa a transcrição do som do computador. Isso é garantido pela Task 11.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it('gera a quantidade pedida com ids', async () => {
  create.mockResolvedValue(respostaTexto(JSON.stringify({ perguntas: ['a', 'b', 'c', 'd', 'e', 'f'] })));
  const p = await criarTreinador(cliente, () => 'id').gerarPerguntas({ ...cfg, quantidade: 5 });
  expect(p).toHaveLength(5); expect(p[0]).toEqual({ id: 'id', texto: 'a' });
  expect(create.mock.calls[0][0]).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'medium' }, fallbacks: 'default' });
});
it('em português descarta dicas de inglês', async () => {
  create.mockResolvedValue(respostaTexto(JSON.stringify({ foiBem: ['x'], faltou: [], respostaMelhorada: 'y', dicasIngles: ['z'] })));
  expect((await t.avaliar({ ...cfg, idioma: 'pt' }, 'P', 'R')).dicasIngles).toEqual([]);
});
it('relatório valida o esquema', async () => { /* JSON válido → objeto igual; JSON sem campo → rejeita */ });
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/ia/treinador.test.ts`. O esperado é FALHA.

- [ ] **Passo 3: Implementar `treinador.ts`, seguindo as regras acima**

- [ ] **Passo 4: Rodar os testes**

  Rode `npx vitest run src/main/ia`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Add interview practice question generation, feedback and report".

---

### Task 11: Casca do Electron — janelas, captura, atalhos, IPC e preload

**Arquivos:**
- Criar: `src/shared/ipc.ts`, `src/main/janelas/versao-windows.ts`, `src/main/janelas/janela-principal.ts`, `src/main/janelas/painel.ts`, `src/main/atalhos-globais.ts`, `src/main/captura.ts`, `src/main/ipc.ts`
- Modificar: `src/main/index.ts`, `src/preload/index.ts`
- Testar: `src/main/janelas/versao-windows.test.ts`, `src/main/atalhos-globais.test.ts`

**Interfaces:**
- Consome: todos os módulos das Tasks 2 a 10.
- Produz `src/shared/ipc.ts`, consumido pelas Tasks 12 e 13 (copiar exatamente):

```ts
import type * as T from './tipos';
export interface DocumentosLidos { docs: T.DocumentoLido[]; tokens: number; estimado: boolean }
export interface CopilotoApi {
  config: {
    obter(): Promise<{
      preferencias: T.Preferencias; temChaves: { anthropic: boolean; soniox: boolean };
      statusChaves: { anthropic: T.ResultadoChave | null; soniox: T.ResultadoChave | null }; // null = sem chave ou ainda verificando
    }>;
    salvar(p: T.Preferencias): Promise<Record<T.AcaoAtalho, string | null>>; // erros de validação/registro por ação
    salvarChaves(c: { anthropic?: string; soniox?: string }): Promise<{ anthropic?: T.ResultadoChave; soniox?: T.ResultadoChave }>;
  };
  documentos: { escolher(): Promise<string[]>; ler(caminhos: string[]): Promise<DocumentosLidos> };
  reuniao: {
    iniciar(o: { caminhos: string[]; contexto: string; idioma: T.IdiomaSugestao; modo: 'audio' | 'ensaio' }): Promise<void>;
    falaEnsaio(quem: T.Quem, texto: string): void;
    alternarPausa(): void; perguntar(texto: string): void; navegar(delta: 1 | -1): void;
    encerrar(): Promise<T.ItemHistoricoReuniao | null>;
    aoInstantaneo(cb: (i: T.InstantaneoReuniao) => void): () => void;
  };
  audio: { enviar(quem: T.Quem, pcm: ArrayBuffer): void; nivel(quem: T.Quem, nivel: number): void; aoNivel(cb: (quem: T.Quem, nivel: number) => void): () => void };
  painel: { aoDigitar(cb: () => void): () => void; terminarDigitacao(): void; aoPreferencias(cb: (p: T.Preferencias) => void): () => void };
  historico: { listar(): Promise<T.ResumoItemHistorico[]>; obter(id: string): Promise<T.ItemHistorico | null>; apagar(id: string): Promise<void> };
  treino: {
    lerArquivo(): Promise<string | null>; // escolhe 1 arquivo e devolve o texto de todas as partes
    perguntas(cfg: T.ConfigTreino): Promise<T.PerguntaTreino[]>;
    avaliar(cfg: T.ConfigTreino, pergunta: string, resposta: string): Promise<T.AvaliacaoResposta>;
    finalizar(cfg: T.ConfigTreino, respostas: { pergunta: string; resposta: string; avaliacao: T.AvaliacaoResposta }[]): Promise<T.ItemHistoricoTreino>;
    ditadoIniciar(): Promise<void>; ditadoParar(): Promise<string>; aoDitado(cb: (texto: string) => void): () => void;
  };
  aoComandoCaptura(cb: (c: { acao: 'iniciar'; quem: T.Quem[] } | { acao: 'parar' }) => void): () => void;
}
declare global { interface Window { copiloto: CopilotoApi } }
```

- Produz também:
  - `suportaExclusaoCaptura(release: string): boolean`: `true` se a versão começa com `10.` e a build é ≥ 19041. Vale `false` para outra plataforma ou texto inválido.
  - `registrarAtalhos(gs: { register(a: string, fn: () => void): boolean; unregisterAll(): void }, atalhos: Record<AcaoAtalho, string>, acoes: Record<AcaoAtalho, () => void>): Record<AcaoAtalho, boolean>`.

Regras:
- **Janela principal:** 1100×750, `webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }`. Ao fechar durante uma reunião ativa, mostra um `dialog.showMessageBox` com os botões `['Gerar resumo e sair', 'Sair sem resumo', 'Cancelar']`, que levam a `encerrar()`, `descartar()` ou cancelar o fechamento.
- **Painel:**
  - `frame: false`, `transparent: false`, `resizable: true`, `alwaysOnTop: true`, `focusable: false`, `skipTaskbar: false`, `show: false`, 420×640 por padrão, ou a posição salva em `preferencias.painel` (gravada ao mover ou redimensionar, com debounce de 500 ms).
  - Depois de criado: `setAlwaysOnTop(true, 'screen-saver')`, `setContentProtection(preferencias.invisivelNoCompartilhamento)`, `setOpacity(preferencias.opacidadePainel)`, `showInactive()`.
  - Se `process.platform === 'win32' && !suportaExclusaoCaptura(os.release())`, envia o aviso `windows-antigo`.
  - **Digitar** (`Control+Alt+D`): `setFocusable(true)`, `show()`, `focus()` e o evento `painel:digitar`. `terminarDigitacao()` faz `setFocusable(false)` e `blur()`.
  - **Ocultar** alterna entre `hide()` e `showInactive()`.
  - Ao salvar preferências, as do painel são reaplicadas na hora e enviadas por `painel:preferencias`.
- **`captura.ts`:**
  - `session.defaultSession.setDisplayMediaRequestHandler`: `desktopCapturer.getSources({ types: ['screen'] })` e `callback({ video: sources[0], audio: 'loopback' })`, sem mostrar seletor.
  - `setPermissionRequestHandler`: permite só `media` e `display-capture`.
- **Reunião:**
  - `reuniao.iniciar`:
    1. Lê as chaves. Sem chave Anthropic, ou sem chave Soniox no modo `audio`, lança `Error('Configure as chaves nas Configurações')`.
    2. Relê os documentos pelos caminhos e monta o `ContextoReuniao` com `sobreVoce` das preferências.
    3. Recusa se a contagem de tokens passar de `LIMITE_TOKENS_DOCUMENTOS`.
    4. Cria a `Anthropic({ apiKey })`, os três prefixos (detector, explicador e resumo), o detector, o explicador e o resumidor.
    5. Cria `criarSessaoReuniao` com `criarStt = (quem, cb) => criarSessaoSoniox(quem, cb, fabricaSoniox(chave))`, `publicar` para as duas janelas (`reuniao:instantaneo`), `salvar = historico.salvar` e `gerarId = randomUUID`.
    6. Salva os caminhos em `preferencias.ultimosArquivos`, mostra o painel e, no modo `audio`, envia `aoComandoCaptura({ acao: 'iniciar', quem: ['voce', 'outros'] })` à janela principal.
  - `encerrar` e `descartar` enviam `{ acao: 'parar' }` e escondem o painel.
  - `audio.enviar` chama `sessao.receberAudio(quem, new Uint8Array(pcm))`. `audio.nivel` é repassado ao painel.
- **Atalhos globais:** registrados no `app.whenReady` e de novo ao salvar as preferências (`unregisterAll` primeiro). Cada atalho chama a ação da sessão ativa, sem fazer nada se não houver sessão. Um registro recusado aparece no resultado de `config.salvar` (`'Já usado por outro programa'`) e gera o aviso `atalho-recusado`.
- **`salvarChaves`:** verifica com `verificarChaveAnthropic(new Anthropic({ apiKey }))` e `verificarChaveSoniox(new SonioxNodeClient({ api_key }))`. Só grava as chaves com resultado `'ok'`.
- **Verificação ao abrir (§9):** no `app.whenReady`, cada chave já gravada é verificada em segundo plano, e o resultado fica em `statusChaves`, devolvido por `config.obter`. Até terminar, ou sem chave, o valor é `null`.
- **Treino:**
  - `ditadoIniciar` cria uma única `criarSessaoSoniox('voce', …)` e envia `aoComandoCaptura({ acao: 'iniciar', quem: ['voce'] })`, só o microfone.
  - `ditadoParar` encerra a sessão, envia `{ acao: 'parar' }` e devolve o texto juntado das falas.
  - `finalizar` chama `treinador.relatorio`, monta o `ItemHistoricoTreino` (`vagaResumo` com os primeiros 200 caracteres da vaga) e salva no histórico.
- **Preload:** implementa `CopilotoApi` com `ipcRenderer.invoke`, `send` e `on`. As funções `ao…` devolvem uma função que remove o ouvinte.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it('Windows 10 2004+ suporta exclusão', () => {
  expect(suportaExclusaoCaptura('10.0.19041')).toBe(true); expect(suportaExclusaoCaptura('10.0.22631')).toBe(true);
  expect(suportaExclusaoCaptura('10.0.18363')).toBe(false); expect(suportaExclusaoCaptura('6.3.9600')).toBe(false);
  expect(suportaExclusaoCaptura('lixo')).toBe(false);
});
it('registra todos e informa recusados', () => {
  const gs = { register: vi.fn((a: string) => a !== 'Control+Alt+X'), unregisterAll: vi.fn() };
  const r = registrarAtalhos(gs, ATALHOS_PADRAO, acoesFalsas);
  expect(gs.unregisterAll).toHaveBeenCalledBefore(gs.register); expect(r.explicar).toBe(false); expect(r.pausar).toBe(true);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/main/janelas src/main/atalhos-globais.test.ts`. O esperado é FALHA.

- [ ] **Passo 3: Implementar os módulos, seguindo as regras acima**

  Mantenha `ipc.ts` só como ligação: cada handler chama um módulo das tasks anteriores.

- [ ] **Passo 4: Verificar**

  Rode `npm test && npm run typecheck && npm run lint && npm run build`. O esperado é passar em tudo.

- [ ] **Passo 5: Commit**

  "Wire Electron shell: windows, loopback capture, global hotkeys, IPC and preload".

---

### Task 12: Renderer da janela principal — áudio e telas

**Arquivos:**
- Criar: `src/renderer/public/captura-pcm.js`, `src/renderer/src/audio/pcm.ts`, `src/renderer/src/audio/captura-audio.ts`, `src/renderer/src/api.ts`
- Criar: `src/renderer/src/telas/Configuracoes.tsx`, `NovaReuniao.tsx`, `Reuniao.tsx`, `Historico.tsx`, `Treino.tsx`
- Modificar: `src/renderer/src/main.tsx`
- Testar: `src/renderer/src/audio/pcm.test.ts`

**Interfaces:**
- Consome: `CopilotoApi` (Task 11) via `window.copiloto`; tipos da Task 1; `mensagemAviso` e `TEXTO_AVISO`.
- Produz:
  - `paraPcm16(f: Float32Array): Int16Array`: limita os valores a [-1, 1] e escala por 32767.
  - `nivelRms(f: Float32Array): number`, entre 0 e 1.
  - `class AgrupadorPcm { constructor(amostrasPorBloco = 1600, aoBloco: (b: Int16Array) => void); adicionar(f: Float32Array): void }`.
  - `iniciarCaptura(quem: Quem[], microfoneId: string | null): Promise<() => void>`: devolve a função que para a captura.

Regras:
- **`captura-pcm.js`:** um `AudioWorkletProcessor` registrado como `'captura-pcm'`, que copia o canal 0 de cada quadro e faz `port.postMessage(Float32Array)`.
- **`iniciarCaptura`:**
  - Um `AudioContext({ sampleRate: 16000 })` por fonte e `audioWorklet.addModule('./captura-pcm.js')`.
  - `voce`: `getUserMedia({ audio: { deviceId, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`.
  - `outros`: `getDisplayMedia({ audio: true, video: { frameRate: 1 } })`. A faixa de vídeo é mantida, para não arriscar o fim do áudio. Se o stream não tiver faixa de áudio, lança `Error('O Windows não entregou o som do computador')`.
  - Grafo: `MediaStreamSource` → `AudioWorkletNode` → `GainNode(gain 0)` → `destination`, para não tocar de volta.
  - A cada mensagem, chama `AgrupadorPcm.adicionar`. Cada bloco vai por `copiloto.audio.enviar(quem, bloco.buffer)`, e o `nivelRms` vai por `copiloto.audio.nivel`, no máximo 5 vezes por segundo.
  - A função de parar encerra as faixas e fecha os contextos.
- **`main.tsx`:**
  - Menu lateral com **Nova reunião**, **Treino de entrevista**, **Histórico** e **Configurações**.
  - Abre direto nas Configurações se `temChaves.anthropic` for falso.
  - Se `statusChaves` tiver algum `'invalida'`, mostra no topo o `TEXTO_AVISO.chave` com um link para as Configurações. Repita a consulta a `config.obter` a cada 2 s até os dois status saírem de `null`, no máximo 30 s.
  - Escuta `aoComandoCaptura`: `iniciar` chama `iniciarCaptura`, guardando a função de parar; `parar` chama essa função.
  - Erros de captura aparecem num aviso no topo.
- **`Configuracoes.tsx`:**
  - Campos de senha para as duas chaves, com o resultado de `salvarChaves` ao lado: "✓ válida", "chave inválida" ou "sem internet". Links para `https://console.anthropic.com` e `https://soniox.com`.
  - "Sobre você" (textarea) e microfone (`enumerateDevices` com `kind === 'audioinput'`).
  - Atalhos: campos de texto com o erro por ação devolvido por `config.salvar`.
  - Tamanho da letra, opacidade do painel (slider de 0.6 a 1.0) e a caixa "Invisível no compartilhamento de tela".
- **`NovaReuniao.tsx`:**
  - Lista de arquivos, com os botões "Escolher arquivos" e "Usar os mesmos da última reunião" (`preferencias.ultimosArquivos`). Para cada arquivo, mostra as partes lidas ou o `mensagemAviso`, e um botão para remover.
  - Barra `tokens / 80.000`, com "(estimado)" quando for o caso.
  - "Contexto da reunião" (textarea) e o idioma das sugestões (Automático, Português ou Inglês).
  - Caixa obrigatória "Avisei os participantes de que a reunião será transcrita."
  - Botões **Iniciar** (desabilitado sem a caixa marcada ou acima do limite) e **Ensaiar** (desabilitado acima do limite; não exige a caixa).
  - Ao iniciar, mostra `Reuniao.tsx`.
- **`Reuniao.tsx`:**
  - O estado, a lista de cartões (mesmo conteúdo do painel, em tamanho maior), a transcrição e os botões Pausar e Encerrar.
  - No modo ensaio: um campo de texto com a escolha "Outros"/"Você" e o botão Enviar (`falaEnsaio`).
  - Ao encerrar, mostra o resumo devolvido.
- **`Historico.tsx`:** a lista; ao abrir um item, mostra o resumo e os conceitos (ou o relatório do treino), com o botão Apagar e confirmação.
- **`Treino.tsx`:**
  - Preparação: vaga colada ou por arquivo (`treino.lerArquivo`), currículo por arquivo, idioma, tipo e quantidade.
  - Uma pergunta por vez, com os botões "Responder falando" (`ditadoIniciar`; o texto parcial aparece por `aoDitado`; "Terminei" chama `ditadoParar`) e "Digitar resposta".
  - A avaliação mostra "O que foi bem", "O que faltou", "Resposta melhorada" e "Dicas de inglês" (esta só quando houver dicas).
  - No fim, mostra o relatório de `treino.finalizar`.
- **Interface:** tudo em pt-BR, com Tailwind. A classe `text-lg` é aplicada quando `tamanhoLetra === 'grande'`.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it('converte e limita', () => { expect(Array.from(paraPcm16(new Float32Array([0, 1, -1, 2])))).toEqual([0, 32767, -32767, 32767]); });
it('rms do silêncio é 0', () => { expect(nivelRms(new Float32Array(128))).toBe(0); });
it('agrupa em blocos de 1600', () => {
  const blocos: Int16Array[] = []; const a = new AgrupadorPcm(1600, (b) => blocos.push(b));
  for (let i = 0; i < 13; i++) a.adicionar(new Float32Array(128)); // 1664 amostras
  expect(blocos).toHaveLength(1); expect(blocos[0].length).toBe(1600);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/renderer`. O esperado é FALHA.

- [ ] **Passo 3: Implementar `pcm.ts`, a captura e as telas, seguindo as regras acima**

- [ ] **Passo 4: Verificar**

  Rode `npm test && npm run typecheck && npm run lint && npm run build`. O esperado é passar, e `out/renderer/captura-pcm.js` deve existir.

- [ ] **Passo 5: Commit**

  "Add main window screens and audio capture to 16 kHz PCM".

---

### Task 13: Painel flutuante

**Arquivos:**
- Criar: `src/renderer/src/painel/Painel.tsx`, `src/renderer/src/painel/CartaoView.tsx`, `src/renderer/src/painel/rotulos.ts`
- Modificar: `src/renderer/src/painel.tsx`
- Testar: `src/renderer/src/painel/rotulos.test.ts`

**Interfaces:**
- Consome: `CopilotoApi.reuniao`, `audio.aoNivel` e `painel.*` (Task 11); `Cartao`, `InstantaneoReuniao` e `TEXTO_AVISO`.
- Produz:
  - `rotuloEstado(i: InstantaneoReuniao): string`. A ordem de prioridade é:
    1. qualquer conexão `erro` → "erro de conexão";
    2. qualquer `reconectando` → "reconectando…";
    3. `pausado` → "pausado";
    4. `ouvindo` com modo `ensaio` → "ensaio";
    5. `ouvindo` → "ouvindo";
    6. `encerrando` → "gerando resumo…";
    7. senão → "".
  - `textoFonte(f: Fonte): string` → `"Manual.pdf, p. 12"`.

Regras (§3.3 e §3.4):
- **Topo:** a área de arrastar (`-webkit-app-region: drag`), o rótulo do estado, dois medidores ("Você" e "Outros", de `aoNivel`) e os botões Pausar e Encerrar (`no-drag`).
- **Avisos:** os do instantâneo aparecem como faixas amarelas.
- **Cartões:**
  - O cartão `indiceAtual` aparece em destaque. Os demais ficam abaixo, recolhidos com só o título; clicar expande.
  - "Diga isso": título (a pergunta) e o texto grande do `digaIsso`.
  - "Conceito": título (o termo), "Explicação" e "Como explicar ao cliente".
  - "Resposta": o texto da resposta.
  - As fontes ficam numa linha pequena (`textoFonte`, juntadas por " · "), só quando houver.
  - Estado `escrevendo`: um cursor piscando. Estado `erro`: o texto de `cartao.erro`.
- **Transcrição ao vivo:** um botão a mostra e esconde (escondida por padrão), com as últimas 10 falas e os parciais.
- **Campo "Perguntar":** fica escondido. `painel.aoDigitar` mostra o campo e dá foco. `Enter` faz `reuniao.perguntar(texto)` e `terminarDigitacao()`; `Esc` faz só `terminarDigitacao()`. Nos dois casos, o campo é escondido.
- **Letra:** `aoPreferencias` aplica o tamanho da letra.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it('erro de conexão tem prioridade', () => {
  expect(rotuloEstado({ ...inst, estado: 'ouvindo', conexao: { voce: 'ok', outros: 'erro' } })).toBe('erro de conexão');
});
it('ensaio', () => { expect(rotuloEstado({ ...inst, estado: 'ouvindo', modo: 'ensaio' })).toBe('ensaio'); });
it('texto da fonte', () => { expect(textoFonte({ arquivo: 'Manual.pdf', local: 'p. 12' })).toBe('Manual.pdf, p. 12'); });
```

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `npx vitest run src/renderer/src/painel`. O esperado é FALHA.

- [ ] **Passo 3: Implementar `rotulos.ts`, `CartaoView.tsx`, `Painel.tsx` e o `painel.tsx` de entrada**

- [ ] **Passo 4: Verificar**

  Rode `npm test && npm run typecheck && npm run lint && npm run build`. O esperado é passar.

- [ ] **Passo 5: Commit**

  "Add floating panel with cards, meters, live transcript and ask box".

---

### Task 14: Ensaio de ponta a ponta com a IA real

**Arquivos:**
- Criar: `scripts/ensaio-real.ts`, `scripts/ensaio/SisFat-manual.md`, `scripts/ensaio/falas.json`

**Interfaces:**
- Consome: `lerDocumento` (Task 3), `montarPrefixo`, `criarDetector`, `criarExplicador` e `criarResumidor` (Tasks 6 e 7), `criarSessaoReuniao` (Task 8).
- Produz: o comando `npm run ensaio:real`, que roda só com a variável `ANTHROPIC_API_KEY` definida. Sem ela, imprime "Defina ANTHROPIC_API_KEY para rodar o ensaio (custa alguns centavos)." e sai com código 0. Ele não roda no CI.

Conteúdo:
- **`SisFat-manual.md`:** um manual fictício, em português, de ≈ 2 páginas, sobre um sistema de faturamento "SisFat". Cita "rateio por centro de custo", "NF-e", "SLA de atendimento 4 h" e "lote de faturamento".
- **`falas.json`:** cerca de 8 falas `{ quem, texto }`, com perguntas diretas em português e em inglês. Por exemplo: "Como funciona o rateio por centro de custo no SisFat?", "What is the SLA for critical tickets?", "E o lote de faturamento roda quando?".
- **O script:**
  1. Lê o manual.
  2. Cria a sessão no modo `ensaio`, com `publicar` registrando os cartões prontos e `salvar` sendo uma função que não faz nada.
  3. Envia as falas com `falaEnsaio`, esperando 3 s entre elas.
  4. Espera os cartões terminarem (até 60 s) e chama `encerrar`.
  5. Imprime cada cartão (tipo, título, campos, fontes), o tempo até o primeiro texto de cada cartão, o resumo e o total de `cache_read_input_tokens` lido do `usage` das respostas. Para isso, envolva o cliente para somar o `usage`.

- [ ] **Passo 1: Criar os três arquivos**

- [ ] **Passo 2: Verificar sem chave**

  Rode `env -u ANTHROPIC_API_KEY npm run ensaio:real`. O esperado é a mensagem acima e código 0. Rode também `npm run typecheck`, que deve passar.

- [ ] **Passo 3: Rodar com chave, só se a usuária fornecer uma e autorizar o custo**

  Conferir que:
  - há cartões "Diga isso" para as perguntas;
  - o cartão do SLA saiu em inglês;
  - há fontes "SisFat-manual.md, parte N" nos conceitos;
  - `cache_read_input_tokens` é maior que 0 a partir do segundo cartão.

  Registrar as latências no relatório final da execução. Se a usuária não fornecer chave, registre que este passo ficou pendente.

- [ ] **Passo 4: Commit**

  "Add real-API rehearsal script with sample manual".

---

### Task 15: Instalador no GitHub Actions, README e roteiro de teste

**Arquivos:**
- Criar: `electron-builder.yml`, `README.md`, `../.github/workflows/copiloto-reunioes.yml`

**Interfaces:**
- Consome: os scripts `lint`, `typecheck`, `test` e `dist:win` (Task 1).
- Produz: o artefato `copiloto-reunioes-instalador`, com `Copiloto-de-Reunioes-Setup-<versão>.exe`.

Conteúdo:
- **`electron-builder.yml`:**
  - `appId: br.com.juliana.copilotoreunioes`, `productName: Copiloto de Reuniões`;
  - `directories.output: dist`, `files: ['out/**', 'package.json']`;
  - `asarUnpack: ['node_modules/pdfjs-dist/**']`;
  - `win.target: nsis`, `nsis.oneClick: false`, `nsis.perMachine: false`;
  - `artifactName: Copiloto-de-Reunioes-Setup-${version}.${ext}`.
- **Workflow:**
  - `on.push.paths` e `on.pull_request.paths`: `['copiloto-reunioes/**', '.github/workflows/copiloto-reunioes.yml']`, mais `workflow_dispatch`.
  - Job em `windows-latest`, com `defaults.run.working-directory: copiloto-reunioes`.
  - Passos:
    1. `actions/checkout@v4`;
    2. `actions/setup-node@v4` (`node-version: 22`, `cache: npm`, `cache-dependency-path: copiloto-reunioes/package-lock.json`);
    3. `npm ci`;
    4. `npm run lint`;
    5. `npm run typecheck`;
    6. `npm test`;
    7. `npm run dist:win`;
    8. `actions/upload-artifact@v4` (`name: copiloto-reunioes-instalador`, `path: copiloto-reunioes/dist/*.exe`).
- **`README.md`**, em português, no mesmo estilo do `mentorias-naap/README.md`. Seções:
  1. O que é: o resumo da §1 e o que fica de fora (§2).
  2. Instalar: baixar o artefato na aba Actions do GitHub; o aviso "Windows protegeu o computador" → "Mais informações" → "Executar assim mesmo".
  3. Criar as chaves:
     - Anthropic (console.anthropic.com): criar a chave e definir um limite de gasto mensal (ex.: US$ 20).
     - Soniox (soniox.com): criar a chave e conferir as opções de retenção de dados.
  4. Uso no dia a dia: anexar documentos, contexto, o lembrete da LGPD, Iniciar, usar **fone de ouvido**, fechar músicas e vídeos.
  5. Tabela de atalhos (Global Constraints).
  6. Treino de entrevista.
  7. Privacidade (§8).
  8. Custos (tabela da §10).
  9. Roteiro de teste de 10 minutos: os 8 itens da §11.3, copiados na íntegra.
  10. Desenvolvimento: comandos, `ELECTRON_SKIP_BINARY_DOWNLOAD=1` e `npm run ensaio:real`.

- [ ] **Passo 1: Criar os três arquivos**

- [ ] **Passo 2: Verificar o YAML e as configurações localmente**

  Rode `python3 -c "import yaml,sys;[yaml.safe_load(open(f)) for f in sys.argv[1:]]" ../.github/workflows/copiloto-reunioes.yml electron-builder.yml`. O esperado é sair sem erro. Rode também `npm test && npm run typecheck && npm run lint && npm run build`, que deve passar.

- [ ] **Passo 3: Commit e push**

  Faça o commit "Add Windows installer workflow, README and manual test script". Depois, `git push -u origin claude/client-meeting-support-system-s8avxc`.

- [ ] **Passo 4: Conferir o workflow no GitHub**

  Pelas ferramentas `mcp__github__*`, verifique se o run do workflow `copiloto-reunioes.yml` no último commit terminou verde e se o artefato existe. Se falhar, leia os logs do job, corrija, valide localmente e faça um novo push, até ficar verde.
