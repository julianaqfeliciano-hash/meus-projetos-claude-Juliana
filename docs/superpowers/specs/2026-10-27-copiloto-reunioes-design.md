# Copiloto de Reuniões: especificação de design

Data: 2026-10-27 · Status: aguardando revisão da usuária

## 1. Objetivo

A usuária trabalha com sistemas especializados e faz reuniões online com clientes, no Microsoft Teams (aplicativo instalado) e no Google Meet, em um computador Windows. Durante essas reuniões, aparecem perguntas e conceitos de sistemas que ela ainda não domina.

O **Copiloto de Reuniões** é um programa para Windows que:

1. ouve a reunião (a voz dos outros participantes e a voz dela, pelo microfone);
2. transcreve ao vivo, em português e em inglês;
3. com IA (Claude), sugere **o que responder** quando fazem uma pergunta a ela e **explica conceitos técnicos** que aparecem na conversa, usando a documentação anexada à reunião;
4. mostra essas sugestões num **painel flutuante que não aparece no compartilhamento de tela**, controlado por **atalhos de teclado** que funcionam com o Teams ou o Meet em foco;
5. no fim, guarda um **resumo** e os **conceitos explicados**;
6. oferece um **modo treino de entrevista de emprego**: uma simulação com perguntas da vaga e comentários sobre cada resposta.

A referência de produto é o Perssua. Desse produto, só a função de assistente ao vivo entra nesta versão.

### Critério de sucesso

Numa reunião real, quando o cliente faz uma pergunta ou cita um termo técnico, um cartão útil começa a aparecer no painel em poucos segundos, sem que o cliente veja o painel e sem que ela precise sair do Teams.

## 2. Escopo

### Dentro

- Programa Windows instalável (Windows 10 versão 2004 ou mais novo, ou Windows 11), para uma usuária só.
- Captura de áudio do microfone ("Você") e do som do computador ("Outros"), sem compartilhar a tela.
- Transcrição ao vivo em português e inglês, inclusive misturados.
- Cartões "Diga isso" e "Conceito", criados automaticamente e por atalho, mais um campo para digitar uma pergunta.
- Documentos anexados por reunião (PDF com texto, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.md`), com a fonte (arquivo e página, slide ou aba) mostrada no cartão.
- Painel flutuante sempre por cima, invisível em capturas e compartilhamentos de tela.
- Atalhos globais configuráveis.
- Resumo e conceitos salvos no Histórico. A transcrição completa e o áudio nunca são gravados em disco.
- Modo ensaio: falas digitadas no lugar do áudio.
- Treino de entrevista de emprego, em português ou inglês.
- Instalador gerado automaticamente pelo GitHub Actions.

### Fora (decisões explícitas)

- **Login, contas e servidor próprio:** tudo roda e fica salvo no computador da usuária.
- **Biblioteca de sistemas:** os documentos são escolhidos a cada reunião. O programa lembra só os caminhos dos últimos arquivos usados.
- Tradução ao vivo e outros extras do Perssua.
- **Uso escondido em entrevistas de emprego reais.** O treino de entrevista é uma simulação e não capta o som de reuniões. Não haverá nenhum recurso para burlar a detecção de plataformas de entrevista ou de ferramentas de monitoramento, nem para esconder o programa da barra de tarefas ou da lista de processos. A invisibilidade se limita ao conteúdo do painel nas capturas de tela, como nas notas do apresentador do PowerPoint.
- macOS, Linux e celular.
- Atualização automática: a usuária baixa o instalador novo quando houver versão nova.
- Busca semântica em documentos grandes: o limite de tamanho torna isso desnecessário.

## 3. Experiência de uso

### 3.1 Primeira execução

Na primeira vez, abre a tela **Configurações**, que pede:

- **Chave da Anthropic** (IA) e **chave da Soniox** (transcrição), com links para criar cada uma. O programa testa as chaves na hora e avisa se alguma for inválida.
- **Sobre você** (opcional): um texto curto, como "Sou consultora de implantação do sistema X na empresa Y". Ele serve para as sugestões "Diga isso" saírem na primeira pessoa e de acordo com o papel dela.
- **Microfone**, escolhido numa lista.

As chaves ficam criptografadas pelo Windows, com `safeStorage` (DPAPI). Isto não é login: depois de configurado, o programa abre direto.

### 3.2 Janela principal

Menu lateral com quatro itens:

1. **Nova reunião**
   - Anexar documentos, opcional (arrastar ou escolher). Há um botão "Usar os mesmos da última reunião".
   - Uma barra mostra o espaço usado, com limite de ≈ 150 páginas (ver §7).
   - Cada arquivo mostra se foi lido e quantas páginas, slides ou abas tem. Aparecem avisos para PDF escaneado, formato antigo (`.doc`, `.xls`, `.ppt`) ou arquivo grande demais.
   - **Contexto da reunião** (opcional): cliente, objetivo, assuntos esperados.
   - **Idioma das sugestões:** Automático (padrão), Português ou Inglês.
   - Caixa obrigatória: "Avisei os participantes de que a reunião será transcrita."
   - Botões **Iniciar** (com áudio) e **Ensaiar** (sem áudio, ver §3.6).
2. **Treino de entrevista** (§3.7).
3. **Histórico:** lista de reuniões e treinos, com data, contexto e duração. Abrir um item mostra o resumo e os conceitos (ou o relatório do treino). Há um botão "Apagar".
4. **Configurações:** chaves, Sobre você, microfone, atalhos, tamanho da letra, opacidade do painel e a opção "Invisível no compartilhamento de tela" (ligada por padrão).

### 3.3 Painel flutuante

- Janela sem moldura, sempre por cima das outras (inclusive do Teams em tela cheia), que pode ser movida e redimensionada. Posição e tamanho são lembrados, e a opacidade é ajustável (60 a 100%).
- **Invisível em capturas** (`setContentProtection(true)`, que no Windows usa `WDA_EXCLUDEFROMCAPTURE`). No Windows 10 2004 ou mais novo, a janela some da captura. Em versões mais antigas, ela apareceria como um retângulo preto. Nessas versões o programa avisa a usuária e não esconde esse fato dela.
- **Não rouba o foco:** abre e se atualiza sem tirar o foco do Teams ou do Meet (`showInactive`, não focável). Só recebe foco quando a usuária usa "Digitar pergunta".
- **No topo:** indicador de estado (ouvindo, pausado, reconectando ou erro), medidores de áudio "Você" e "Outros", e os botões Pausar e Encerrar.
- **No centro:** os cartões, com o mais novo em cima e em destaque.
- **Embaixo:** o campo "Perguntar" (escondido até o atalho) e um botão para mostrar ou esconder a transcrição ao vivo (escondida por padrão).

### 3.4 Cartões

| Tipo | Quando aparece | Conteúdo |
|---|---|---|
| **Diga isso** | Alguém fez uma pergunta à usuária, detectada automaticamente ou pedida por atalho | A pergunta, resumida numa linha. A resposta sugerida, com 2 a 4 frases faladas e naturais, na primeira pessoa e **no idioma da conversa**. Fontes, se houver. |
| **Conceito** | Apareceu um termo técnico ou de negócio, automaticamente ou por atalho | O termo. A explicação simples **em português**, com 2 ou 3 frases. "Como explicar ao cliente", com 1 ou 2 frases **no idioma da conversa**. Fontes, se houver. |
| **Resposta** | A usuária digitou uma pergunta | A resposta direta à pergunta digitada, em português, com fontes se houver. |

- A **fonte** aparece como "Manual Faturamento.pdf, p. 12", "Proposta.pptx, slide 4" ou "Parâmetros.xlsx, aba Impostos". Quando a resposta não vem dos documentos, o cartão não mostra fonte nem aviso. Essa foi uma decisão da usuária: a IA explica com conhecimento geral sem distinguir.
- O texto do cartão aparece **palavra por palavra** (streaming).
- O mesmo conceito ou a mesma pergunta não gera dois cartões na mesma reunião (§6.3).

### 3.5 Atalhos (padrões, configuráveis)

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+Espaço` | **Me ajuda a responder**: cartão "Diga isso" para a pergunta mais recente feita à usuária. Se não houver pergunta clara, sugere o que dizer com base nos últimos 60 s. |
| `Ctrl+Alt+X` | **Explicar**: cartão "Conceito" para o termo técnico mais recente dos últimos 60 s. |
| `Ctrl+Alt+D` | **Digitar pergunta**: o painel recebe foco e mostra o campo. `Enter` envia e `Esc` cancela; nos dois casos o painel deixa de ser focável. |
| `Ctrl+Alt+O` | **Ocultar ou mostrar** o painel. |
| `Ctrl+Alt+B` | **Pausar ou retomar** a escuta. Pausado, nenhum áudio é enviado e nada é cobrado. |
| `Ctrl+Alt+,` e `Ctrl+Alt+.` | Cartão anterior e próximo. |

Critérios usados na escolha dos padrões:

- **Não conflitam com o Teams:** os atalhos de reunião do Teams são `Ctrl+Shift+…` (ex.: `Ctrl+Shift+M` para o microfone, `Ctrl+Shift+K` para levantar a mão). O único `Ctrl+Alt` do Teams é `Ctrl+Alt+E` (gravar clipe).
- **Não conflitam com o Meet:** o Meet usa `Ctrl+Alt+C` (chat), `Ctrl+Alt+P` (participantes) e `Ctrl+Alt+H` (levantar a mão). Guias não oficiais também citam `S`, `L` e `E`.
- **Não geram símbolos no teclado ABNT2:** `Ctrl+Alt` equivale a `AltGr`, que gera símbolos com Q, W, E, C, números de 1 a 6, `=`, `[` e `]`.
- **Não usam as setas:** alguns notebooks giram a tela com `Ctrl+Alt+setas`.

As Configurações mostram um aviso se o Windows recusar um atalho por já estar em uso por outro programa.

### 3.6 Modo ensaio

Funciona igual a uma reunião, mas sem captura de áudio nem transcrição. A usuária digita falas e escolhe se são de "Outros" ou "Você". Os cartões, os atalhos e o resumo funcionam normalmente. Ele serve para testar os documentos antes de uma reunião e para os testes automatizados do fluxo completo.

### 3.7 Treino de entrevista

1. **Preparação:**
   - Descrição da vaga, colada ou num arquivo.
   - Currículo, num arquivo, opcional.
   - Idioma da entrevista: português ou inglês.
   - Tipo: comportamental, técnica ou mista.
   - Número de perguntas: 5, 8 ou 10.
2. A IA gera as perguntas, adaptadas à vaga e ao currículo.
3. A tela mostra uma pergunta por vez. A usuária responde **falando** (só o microfone, com transcrição ao vivo, e o botão "Terminei") ou **digitando**.
4. Para cada resposta, a IA mostra: o que foi bem, o que faltou, uma versão melhorada da resposta e, se a entrevista for em inglês, dicas de vocabulário e de gramática. Os comentários vêm sempre em português.
5. No fim, um **relatório** com pontos fortes, pontos a treinar e as perguntas em que ela foi pior. O relatório fica salvo no Histórico.

Esse modo usa a janela principal comum (não o painel) e **nunca** capta o som do computador.

## 4. Arquitetura

Aplicativo **Electron** com **TypeScript**, interface em **React** e **Tailwind CSS 4** (mesma linguagem e estilo do Mentorias NAAP). Testes com **Vitest**, instalador com **electron-builder** (NSIS).

Fica numa pasta nova, `copiloto-reunioes/`, na raiz do repositório, independente do `mentorias-naap/`.

### 4.1 Processos e componentes

```
Renderer da janela principal (React)     Renderer do painel (React)
  telas: Nova reunião, Treino,             cartões, estado, campo Perguntar,
  Histórico, Configurações                 transcrição ao vivo
  captura de áudio (AudioWorklet)
        │  IPC tipado (preload, contextIsolation)  │
        └──────────────────┬───────────────────────┘
                     Processo principal (Node)
  ┌────────────┬────────────┬─────────────┬──────────────┬─────────────┐
  │ config     │ documents  │ stt         │ ai           │ storage     │
  │ chaves,    │ leitura de │ sessão de   │ detector,    │ histórico   │
  │ preferên-  │ arquivos → │ transcrição │ explicador,  │ (JSON local)│
  │ cias       │ partes     │ (Soniox)    │ resumo,      │             │
  │            │            │             │ treinador    │             │
  └────────────┴────────────┴─────────────┴──────────────┴─────────────┘
                 meeting (orquestrador) · hotkeys · windows
```

Responsabilidade de cada unidade (cada uma testável isoladamente):

| Unidade | Faz | Depende de |
|---|---|---|
| `config` | Lê e grava as preferências (`config.json`) e as chaves (criptografadas com `safeStorage`). Valida os atalhos. | Electron `safeStorage`, `app.getPath('userData')` |
| `documents` | Converte um arquivo em `{ nome, partes: [{ rotulo: "p. 3" \| "slide 2" \| "aba Impostos", texto }] }`. Detecta PDF sem texto e formatos não suportados. Conta tokens. | bibliotecas de leitura (pdf.js, mammoth, JSZip) e a API de contagem de tokens |
| `transcript` | Guarda as falas finais `{ quem: "voce" \| "outros", texto, idioma, inicio, fim }`. Devolve a janela dos últimos N segundos e o texto completo. É lógica pura. | nada |
| `stt` | Interface `SttSession { start, sendAudio(pcm), stop, eventos: tokens, fimDeFala, erro, reconectando }`, implementada sobre a Soniox. Uma sessão por fonte de áudio. | `@soniox/node` |
| `ai/prompt` | Monta os pedidos de forma **determinística**: o prefixo (instruções + Sobre você + contexto + documentos) é idêntico, byte a byte, durante toda a reunião, para o cache funcionar. | nada |
| `ai/detector` | A partir dos últimos 3 min de transcrição e da lista de itens já cobertos, devolve `{ itens: [{ tipo: "pergunta" \| "conceito", texto, idioma }] }`, com no máximo 2 itens. | `@anthropic-ai/sdk`, `ai/prompt` |
| `ai/explainer` | Para um item, ou para um pedido de atalho ou pergunta digitada, gera o cartão em streaming e devolve trechos de texto e fontes. | `@anthropic-ai/sdk`, `ai/prompt` |
| `ai/summarizer` | Gera o resumo final a partir da transcrição completa (em memória). | `@anthropic-ai/sdk` |
| `ai/coach` | Gera as perguntas do treino, avalia cada resposta e monta o relatório. | `@anthropic-ai/sdk` |
| `meeting` | Orquestra uma reunião ou ensaio. Máquina de estados `preparando → ouvindo ⇄ pausado → encerrando → concluída`. Liga transcrição, transcript, detector e explicador, faz a deduplicação e a fila de cartões, e trata as ações dos atalhos. | interfaces acima (injetadas, para testes com versões falsas) |
| `storage` | Grava, lista e apaga itens do Histórico (`historico/<id>.json`) e guarda os caminhos dos últimos arquivos usados. | sistema de arquivos |
| `hotkeys` | Registra e remove os atalhos globais (`globalShortcut`) e informa conflitos. | Electron |
| `windows` | Cria a janela principal e o painel (sempre por cima, `setContentProtection`, `showInactive`, foco controlado) e guarda posição e tamanho. | Electron |
| renderer: `audio` | Captura o microfone (`getUserMedia`) e o som do computador (`getDisplayMedia`, atendido pelo `setDisplayMediaRequestHandler` do processo principal com `audio: 'loopback'`, sem seletor). Descarta a faixa de vídeo. Converte para PCM 16 kHz mono `s16le` num AudioWorklet e envia por IPC. Calcula os níveis dos medidores. | APIs web do Chromium |

Segurança do Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` nos renderers, e um preload expõe só uma API IPC tipada. As chaves de API **nunca** chegam aos renderers: todas as chamadas à Anthropic e à Soniox saem do processo principal.

## 5. Fluxos

### 5.1 Iniciar a reunião

1. A usuária anexa os documentos. `documents` lê cada arquivo e conta os tokens.
2. Ela clica em **Iniciar**. `meeting` monta o prefixo do pedido (fixo dali em diante).
3. O renderer abre as duas capturas. O processo principal abre duas sessões de transcrição (`voce` e `outros`) com `language_hints: ["pt", "en"]`, identificação de idioma e detecção de fim de fala.
4. O painel aparece. Ao mesmo tempo, o programa faz um pré-aquecimento do cache do detector e do explicador: um pedido com `max_tokens: 0` para cada modelo, com as mesmas configurações de esforço dos pedidos reais. Isso faz o primeiro cartão sair rápido e evita que duas explicações simultâneas gravem o cache em dobro.

### 5.2 Cartões automáticos

1. A transcrição envia tokens. As falas finais vão para o `transcript`, e as parciais vão para o painel (transcrição ao vivo).
2. **Quando o detector é chamado:**
   - 1,5 s depois de um fim de fala dos "Outros";
   - ou a cada 10 s, se houver fala final nova de qualquer fonte.

   Só há **uma chamada em andamento por vez**. Gatilhos que chegam durante uma chamada se juntam numa única chamada seguinte.
3. O detector recebe o prefixo fixo, os últimos 3 min de transcrição com rótulos e a lista de itens já cobertos.
4. Para cada item novo, `meeting` cria o cartão no estado "escrevendo" e chama o explicador. No máximo 2 explicações em paralelo; as demais esperam numa fila.
5. O explicador envia o texto aos poucos. O painel atualiza o cartão, que termina no estado "pronto" ou "erro".

### 5.3 Atalhos

- `Ctrl+Alt+Espaço` e `Ctrl+Alt+X` chamam o explicador **direto**, sem passar pelo detector, com os últimos 60 s e a instrução de achar a pergunta (ou o termo) mais recente.
- `Ctrl+Alt+D` dá foco ao painel. A pergunta digitada vai ao explicador como tipo "Resposta".
- Os demais atalhos agem só sobre as janelas e o estado da reunião.

### 5.4 Encerrar

1. **Encerrar** (botão), ou fechar o programa e confirmar.
2. A captura de áudio e as sessões de transcrição param.
3. O `summarizer` gera o resumo: assuntos tratados, dúvidas do cliente, decisões, pendências e próximos passos.
4. `storage` grava `{ data, duração, contexto, nomes dos documentos, resumo, conceitos: [termo, explicação, fontes] }`. Os cartões "Diga isso" e a transcrição **não** são gravados.
5. A transcrição é descartada da memória.
6. Se o resumo falhar, o programa tenta de novo. Se falhar outra vez, grava só os conceitos e avisa.

### 5.5 Treino de entrevista

Preparação → `coach` gera as perguntas (saída estruturada) → para cada pergunta, a resposta (por voz, com uma sessão de transcrição só do microfone, ou digitada) vai para `coach`, que devolve a avaliação → no fim, o relatório vai para `storage`.

## 6. IA

### 6.1 Modelos (configuração "mista" escolhida pela usuária)

| Uso | Modelo | Esforço | Observações |
|---|---|---|---|
| Detector | `claude-haiku-5-5` | `low` | Saída estruturada (JSON schema). Rápido e barato. Chamado com frequência. |
| Explicador (cartões) | `claude-opus-5-5` | `low` | Streaming, com citações ligadas nos documentos. Esforço baixo para responder rápido (qualidade a medir no plano). |
| Resumo final | `claude-opus-5-5` | `medium` | Saída estruturada. |
| Treino de entrevista | `claude-opus-5-5` | `medium` | Saída estruturada para perguntas, avaliações e relatório. |

- Os pedidos ao Opus 5.5 usam o **fallback do servidor** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): se o pedido for recusado por um classificador de segurança, a própria API refaz com outro modelo.
- O Haiku não tem fallback no servidor. Se a resposta vier com `stop_reason: "refusal"`, o ciclo do detector é ignorado.
- O Opus 5.5 não permite desligar o raciocínio interno ("thinking"). Por isso, o esforço é o único controle de velocidade.

### 6.2 Montagem dos pedidos e cache

- **Prefixo fixo por reunião, nesta ordem:**
  1. instruções do papel (system);
  2. Sobre você;
  3. contexto da reunião;
  4. idioma escolhido;
  5. documentos.

  Cada documento vai como um bloco `document` com fonte do tipo *content*, com **um bloco de texto por página, slide ou aba**. Assim, a citação devolve o índice do bloco e o programa sabe exatamente qual página, slide ou aba citar.
- **Ponto de cache:** fica no último bloco de documento.
  - **Explicador (Opus):** TTL de **1 hora**, porque as chamadas são espaçadas e podem passar de 5 min entre uma e outra.
  - **Detector (Haiku):** TTL padrão de **5 min**, porque as chamadas são contínuas durante a fala.

  Os caches são separados por modelo. O prefixo não contém horário, nem IDs, nem nada que mude durante a reunião.
- **Parte variável**, depois do ponto de cache: o trecho da transcrição, a lista de itens já cobertos e a tarefa.
- **Formato do cartão:** o explicador escreve em texto com marcadores fixos, que o programa interpreta enquanto o texto chega. A estrutura vem do prompt, não de saída estruturada, porque citações e saída estruturada não funcionam juntas:
  - `DIGA ISSO:` para "Diga isso";
  - `EXPLICAÇÃO:` e `COMO EXPLICAR AO CLIENTE:` para "Conceito";
  - `RESPOSTA:` para "Resposta".
- **Regras de idioma no prompt:**
  - "Diga isso" e "Como explicar ao cliente" saem no idioma da conversa (ou no idioma fixado pela usuária).
  - A explicação de conceitos e as respostas digitadas saem em português.
  - O resumo sai em português.

### 6.3 Regras do detector e deduplicação

- **"Pergunta":** algo que os "Outros" perguntaram ou pediram **diretamente à usuária** e que ainda não tem cartão. Conversa casual, como "tudo bem?", não conta.
- **"Conceito":** um termo técnico ou de negócio que uma profissional que não conhece aquele sistema pode não saber, como siglas, módulos, regras e jargões. Termos comuns não contam.
- **Itens já cobertos:** a lista é enviada em cada chamada. Além disso, `meeting` normaliza o texto (minúsculas, sem acentos, sem pontuação, singular simples) e descarta repetições antes de criar um cartão.
- **Limites:** no máximo 2 itens por chamada e no máximo 1 cartão automático a cada 8 s, para não inundar o painel. Pedidos por atalho ignoram esse limite.

## 7. Documentos

| Formato | Como é lido | Rótulo da parte |
|---|---|---|
| PDF | Texto de cada página (pdf.js, no processo principal) | `p. N` |
| `.docx` | Texto bruto (mammoth), dividido por títulos ou a cada ~3.000 caracteres | `seção N` (ou o título) |
| `.pptx` | Texto dos slides e das notas (XML via JSZip) | `slide N` |
| `.xlsx` | Cada aba vira uma tabela em texto (CSV), limitada às células preenchidas | `aba <nome>` |
| `.txt`, `.md` | Texto, dividido a cada ~3.000 caracteres | `parte N` |

- **PDF sem texto** (menos de ~20 caracteres por página em média): o arquivo fica marcado como "não foi possível ler (digitalizado?)" e não entra no pedido.
- **Formatos antigos** (`.doc`, `.xls`, `.ppt`) e outros: aparece a mensagem "salve como .docx, .xlsx ou .pptx".
- **Limite total:** **80.000 tokens** de documentos por reunião, o que dá ≈ 150 páginas de texto comum, medidos com a API de contagem de tokens (gratuita).
  - Esse limite mantém o pedido do Haiku abaixo de 100 mil tokens, a faixa de preço mais barata.
  - Se passar do limite, o botão Iniciar fica bloqueado até a usuária remover arquivos.
- **Arquivos originais:** não são copiados. O programa guarda só os caminhos dos últimos usados, para o botão "Usar os mesmos da última reunião".

## 8. Armazenamento e privacidade

- **Pasta de dados:** `%APPDATA%/Copiloto de Reuniões/` (`app.getPath('userData')`):
  - `config.json`: preferências;
  - `chaves.bin`: chaves criptografadas;
  - `historico/*.json`: resumos e conceitos.
- **Nunca é gravado em disco:** o áudio, a transcrição completa e os cartões "Diga isso".
- **"Apagar" no Histórico** apaga o arquivo de verdade.
- **Provedores:**
  - O texto da transcrição e dos documentos vai para a Anthropic; o áudio vai para a Soniox. Os dois são usados apenas para processar os pedidos.
  - Por padrão, a Anthropic não usa dados da API para treinar modelos.
  - O guia orienta a conferir as opções de retenção de dados da Soniox.
- **LGPD:** a caixa "Avisei os participantes" é obrigatória para iniciar uma reunião com áudio.

## 9. Erros e imprevistos

| Situação | Comportamento |
|---|---|
| A transcrição cai ou a internet cai | Reconexão automática com espera crescente (1, 2, 4 e 8 s, depois a cada 15 s). O painel mostra "reconectando…". O áudio do período se perde. |
| Erro ou demora da IA (mais de 20 s) | Uma nova tentativa automática. Se falhar de novo, o cartão fica no estado "erro" com "aperte `Ctrl+Alt+Espaço` para tentar de novo". Um erro do detector só pula aquele ciclo. |
| Limite de uso da API (429) | O programa respeita o tempo de espera indicado. O detector reduz a frequência temporariamente. |
| Sem som dos "Outros" por 2 min enquanto "Você" fala | Aviso no painel: "Não estou ouvindo os outros participantes; confira a saída de som do Teams." |
| Chave inválida, sem crédito ou sem permissão | Aviso claro ao abrir o programa e ao iniciar a reunião, com link para o painel do provedor. |
| Atalho recusado pelo Windows | Aviso nas Configurações, com pedido para escolher outro. |
| 15 min de silêncio total | Pausa automática da escuta, com aviso no painel. |
| Fechar o programa no meio da reunião | Confirmação: "Gerar o resumo antes de sair?" |
| Windows anterior à versão 2004 | Aviso de que o painel apareceria como um retângulo preto no compartilhamento. |
| Recusa da IA | Opus: o fallback do servidor resolve. Haiku: o ciclo é ignorado. Se mesmo assim não houver resposta, o cartão mostra "não foi possível gerar esta sugestão". |

## 10. Custos estimados (10 h de reunião por mês)

| Item | Estimativa |
|---|---|
O custo da IA cresce com o tamanho dos documentos anexados, porque eles vão em cada pedido (com cache). A tabela compara a documentação típica, de ≈ 80 páginas (≈ 40 mil tokens), com a documentação no limite (80 mil tokens).

| Item | Documentação típica | Documentação no limite |
|---|---|---|
| Transcrição Soniox, 2 fontes × US$ 0,12/h | ≈ US$ 2,50 | ≈ US$ 2,50 |
| Detector Haiku 5.5 (~200 chamadas/h com fala nova; no máximo 360/h; prefixo em cache) | ≈ US$ 2 | ≈ US$ 3 |
| Explicador Opus 5.5 (~15 cartões/h + 1 gravação de cache de 1 h por reunião) | ≈ US$ 7 | ≈ US$ 12 |
| Resumo final (≈ US$ 0,10 por reunião) | ≈ US$ 1 | ≈ US$ 1 |
| **Total por mês** | **≈ US$ 12–13** | **≈ US$ 19** |

O treino de entrevista custa à parte, ≈ US$ 0,10 a 0,20 por sessão. São estimativas com preços de outubro de 2026, e o custo real vai ser medido no plano. O guia recomenda definir um limite de gasto mensal no painel da Anthropic.

## 11. Testes e verificação

1. **Testes automáticos (Vitest)**, rodando no GitHub Actions:
   - `documents`: um arquivo de exemplo por formato. Testa rótulos, PDF sem texto e formatos recusados.
   - `transcript`: janela de tempo e ordem das falas.
   - `ai/prompt`: prefixo **byte a byte idêntico** entre chamadas da mesma reunião, ordem dos blocos e posição do ponto de cache.
   - Leitura do cartão: marcadores chegando em pedaços e citações convertidas em "arquivo, p. N".
   - Deduplicação e normalização de termos.
   - Agendamento do detector, com relógio falso: gatilhos, uma chamada por vez, junção de gatilhos e limite de 1 cartão a cada 8 s.
   - Máquina de estados de `meeting`, com transcrição e IA falsas, incluindo pausa, erro, reconexão e encerramento.
   - Validação dos atalhos: lista de conflitos e combinações AltGr do ABNT2.
2. **Modo ensaio de ponta a ponta com a IA real:** um script opcional, que roda só com chave e com autorização da usuária, porque custa centavos. Ele envia falas de exemplo em português e em inglês e confere se os cartões e as fontes fazem sentido.
3. **Roteiro manual no Windows da usuária** (≈ 10 min), porque não dá para testar som real, Teams e compartilhamento de tela no ambiente de desenvolvimento (Linux na nuvem):
   1. Instalar e configurar as chaves.
   2. Fazer uma chamada de teste no Teams (ex.: "Reunião agora" com o celular como segundo participante). Conferir as falas "Você" e "Outros" em português e em inglês.
   3. Fazer uma pergunta pelo celular e conferir o cartão "Diga isso". Citar um termo dos documentos e conferir o cartão "Conceito" com a fonte.
   4. Testar todos os atalhos com o Teams em foco.
   5. Compartilhar a **tela inteira** e conferir no celular que o painel não aparece.
   6. Repetir os itens 2 e 5 no Google Meet (Chrome).
   7. Encerrar e conferir o Histórico. Conferir que não há arquivos de áudio ou de transcrição na pasta de dados.
   8. Fazer um treino de entrevista curto em inglês.

## 12. Entrega

- Pasta `copiloto-reunioes/` com um README em português: o que é, instalação, como criar as chaves da Anthropic e da Soniox (com limite de gasto), uso no dia a dia, atalhos, privacidade e o roteiro de teste.
- **GitHub Actions** (`.github/workflows/copiloto-reunioes.yml`, em `windows-latest`): a cada push que altera `copiloto-reunioes/`, roda lint, verificação de tipos e testes, gera o instalador `.exe` (NSIS) e o anexa como artefato do workflow.
- O instalador não tem assinatura digital, então o Windows mostra "Windows protegeu o computador". Para instalar, é preciso clicar em "Mais informações" e depois em "Executar assim mesmo". O README explica isso.

## 13. Riscos e pontos a confirmar no plano

1. **API em tempo real da Soniox:** o modelo atual é `stt-rt-v5`, pelo SDK `@soniox/node` 2.4.0. Falta confirmar a forma de autenticação atual (o envio de `api_key` na mensagem inicial deixa de funcionar em 15/01/2027), o formato do áudio e a qualidade com português e inglês misturados. Plano B: Deepgram Nova-3, pela mesma interface `SttSession`.
2. **Eco:** sem fone de ouvido, o microfone capta a voz dos "Outros" e as falas aparecem duplicadas como "Você". A mitigação principal é recomendar fone. Na versão 1 não há cancelamento de eco próprio além do `echoCancellation` do navegador no microfone.
3. **Captura do som do computador:** capta **todo** o som do Windows, inclusive músicas e notificações. O README orienta a fechar essas fontes.
4. **Invisibilidade:** o Teams e o Meet respeitam `WDA_EXCLUDEFROMCAPTURE`, e isso precisa ser confirmado no roteiro manual. Outros programas de gravação podem não respeitar.
5. **Latência do explicador:** a meta é o cartão começar a aparecer em até ~6 s depois do fim da pergunta. Se o Opus 5.5 com esforço `low` ficar lento, vou medir as alternativas e levar as opções para a usuária decidir. A troca de modelo é decisão dela.
6. **Haiku 5.5:** confirmar o suporte a saída estruturada e o preço acima de 100 mil tokens.
7. **Atalhos:** confirmar no Windows real que `Ctrl+Alt+,` e `Ctrl+Alt+.` são aceitos pelo `globalShortcut` com o teclado ABNT2.

## 14. Critérios de aceite

1. O instalador funciona no Windows 10 2004 ou mais novo e no Windows 11, e o programa abre nas Configurações na primeira execução.
2. Numa chamada pelo Teams (aplicativo) e pelo Meet (Chrome), a transcrição ao vivo mostra falas "Você" e "Outros" em português e em inglês.
3. Uma pergunta feita diretamente à usuária gera um cartão "Diga isso", no idioma da conversa, que começa a aparecer em até ~6 s depois do fim da pergunta (caso típico).
4. Um termo técnico presente nos documentos gera um cartão "Conceito" com explicação em português e com a fonte (arquivo e página, slide ou aba).
5. Todos os atalhos funcionam com o Teams ou o Meet em foco, sem tirar o foco deles (exceto "Digitar pergunta").
6. Com a tela inteira compartilhada, o outro participante não vê o painel.
7. Ao encerrar, o resumo e os conceitos aparecem no Histórico, e não existe áudio nem transcrição gravados em disco.
8. O treino de entrevista funciona em português e em inglês, com perguntas, avaliação de cada resposta e relatório final.
9. As situações da tabela do §9 se comportam como descrito.
10. Os testes automáticos passam no GitHub Actions e o instalador é gerado como artefato.
