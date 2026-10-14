# Assistente de Entrevistas — Especificação

- **Data:** 14/10/2026
- **Status:** aguardando revisão da Juliana
- **Pasta do código:** `assistente-entrevistas/`

## 1. Objetivo

Aplicativo para Windows que acompanha entrevistas de emprego feitas pelo Microsoft Teams ou pelo Google Meet. Ele ouve a voz do entrevistador e a da usuária, transcreve tudo ao vivo e, quando a usuária aperta um atalho, mostra uma resposta pronta para ser lida em voz alta, baseada nas experiências reais dela.

Tipos de entrevista atendidos: comportamental/RH e técnica com perguntas faladas, em português ou inglês.

Critérios de sucesso:

1. A janela do assistente não aparece quando a usuária compartilha a tela no Teams ou no Meet.
2. As primeiras palavras da resposta aparecem em até 2 segundos depois do atalho (medido no teste de qualidade, seção 11).
3. A resposta soa como uma pessoa falando de forma formal e natural, sem marcas de texto gerado por IA e sem nenhum texto que não seja a própria fala.
4. A resposta liga a pergunta a uma experiência real dos documentos da usuária sempre que existir uma, com detalhes técnicos tirados desses documentos.
5. Toda entrevista fica salva em arquivo com transcrição e sugestões, mesmo se o app fechar sem querer.

## 2. Fora do escopo

- Ler a tela (exercícios de código exibidos na tela).
- Sugestões automáticas sem o atalho.
- Esconder o programa de softwares de monitoramento, antifraude ou fiscalização de entrevistas (sumir do Gerenciador de Tarefas, se disfarçar de outro programa e afins).
- Inventar experiências profissionais e apresentá-las como da usuária (ver regra dos três níveis, seção 4.1).
- Servidor próprio, contas de usuário, venda do app.
- macOS e Linux.
- Assinatura digital do instalador.
- Separar vozes de vários entrevistadores: todos aparecem como "ENTREVISTADOR".

## 3. Experiência de uso

### 3.1 Tela de preparação

- **Chaves** (só na primeira vez): chave do Deepgram e chave da API do Claude (Anthropic). Ficam guardadas criptografadas (seção 10).
- **Meu perfil** (preenchido uma vez, atualizável):
  - Currículo: PDF, Word (.docx) ou texto (.txt/.md).
  - Documento de experiências detalhadas: PDF, Word ou texto. Aviso se os documentos somados passarem do limite de um pedido à API do Claude (600 páginas ou 32 MB).
- **Esta entrevista:** empresa, descrição da vaga (opcional, colada como texto) e idioma (português ou inglês).
- **Modo de resposta:** Equilíbrio (padrão), Turbo ou Econômico (seção 7).
- **Botão "Testar tudo":** em cerca de 30 segundos confere as duas chaves, se o microfone capta a voz e se o som do computador está chegando (a usuária toca qualquer vídeo). Mostra o resultado de cada item.
- **Botão "Iniciar":** abre a janela flutuante, começa a ouvir e pré-carrega os documentos no Claude.
- **Botão "Abrir pasta de entrevistas".**

### 3.2 Durante a entrevista: janela flutuante

- Pequena, semitransparente, sem moldura, sempre por cima das outras janelas. A usuária arrasta para perto da câmera.
- Não aparece no compartilhamento de tela nem na barra de tarefas.
- Não rouba o foco: o Teams/Meet continua sendo a janela ativa.
- Parte de cima: indicador "ouvindo" com o idioma e a transcrição ao vivo rotulada "ENTREVISTADOR" e "VOCÊ".
- Parte de baixo: a sugestão, em letra grande e parágrafos curtos, aparecendo palavra por palavra.
- Rolagem pela roda do mouse.

Atalhos globais:

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+Enter` | Gera a sugestão para a pergunta mais recente do entrevistador |
| `Ctrl+Alt+H` | Mostra ou esconde a janela |
| `Ctrl+Alt+T` | Alterna a sugestão atual entre o idioma da entrevista e português |
| `Ctrl+Alt+P` | Pausa ou retoma a escuta |

### 3.3 Depois da entrevista

O arquivo `Documentos\Assistente de Entrevistas\AAAA-MM-DD HHhMM - <Empresa>.txt` já foi sendo escrito durante a entrevista. Ele contém o cabeçalho (empresa, idioma, modo, horário), a transcrição completa com horário de cada fala, cada sugestão gerada logo depois da fala a que respondeu e, no fim, o custo estimado da entrevista.

## 4. Regras das respostas

Estas regras viram as instruções fixas (system prompt) enviadas ao Claude.

### 4.1 Regra dos três níveis

1. **Experiência direta:** se os documentos têm uma experiência ligada ao tema, a resposta se baseia nela, com os detalhes técnicos que estão escritos (tecnologias, decisões, números, resultados).
2. **Ponte:** se não houver experiência direta, a resposta parte da experiência real mais próxima (mesmo tipo de problema, tecnologia parecida ou escala parecida), deixa claro de forma natural que a ligação é por semelhança ("não usei X em produção, mas resolvi o mesmo problema central em Y...") e completa com conteúdo técnico correto sobre o tema.
3. **Como eu faria:** se nem a ponte for possível, a resposta explica tecnicamente como a usuária abordaria o problema ("eu começaria por..."), sem afirmar que ela já fez.

A resposta nunca atribui à usuária uma experiência, empresa, projeto, número ou resultado que não esteja nos documentos.

### 4.2 Formato e tom

- Só o texto da fala, em primeira pessoa. Nada antes nem depois: sem "Aqui está a resposta", sem títulos, rótulos, tópicos ou comentários.
- De 80 a 150 palavras (30 a 60 segundos de fala), em 2 ou 3 parágrafos curtos.
- No idioma da entrevista. A tradução para português (atalho `Ctrl+Alt+T`) segue as mesmas regras.
- Registro formal e profissional, mas humano. Em inglês, contrações naturais da fala ("I've", "we're") são permitidas. Sem gírias nem marcas de informalidade.
- Proibido, por soar como IA:
  - aberturas como "Ótima pergunta!", "Certamente", "Com certeza";
  - palavras infladas: "crucial", "fundamental", "robusto", "alavancar", "sinergia", "delve", "leverage", "tapestry", "seamless";
  - listas de três itens por reflexo e a estrutura "não apenas X, mas também Y";
  - conclusões do tipo "Em resumo", "Em suma", "In conclusion";
  - travessões longos (—) e excesso de dois-pontos;
  - frases todas do mesmo tamanho.
- Preferir fatos concretos, números e nomes de tecnologias a adjetivos.

## 5. Arquitetura

Aplicativo **Electron + TypeScript**, estruturado com **electron-vite** e interface em **React**. Não existe servidor próprio: o app fala direto com o Deepgram e com a API do Claude usando as chaves da usuária.

### 5.1 Processos

- **Processo principal (Node):** janelas, atalhos, cofre de chaves, leitura de documentos, conexões com Deepgram e Claude, arquivo da entrevista.
- **Janela de preparação (React):** telas da seção 3.1.
- **Janela flutuante (React):** telas da seção 3.2. É nela que o áudio é capturado.
- Comunicação entre janelas e processo principal por IPC tipado, exposto por um `preload` com `contextIsolation` ligado.

### 5.2 Componentes

Cada componente tem uma responsabilidade e uma interface pequena, para ser testado isoladamente.

| Componente | Arquivo | Responsabilidade | Interface |
|---|---|---|---|
| Captura de áudio | `src/renderer/audio/capture.ts` | Captura o microfone (`getUserMedia`, com cancelamento de eco) e o som do sistema (`getDisplayMedia` com `audio: 'loopback'`, liberado no processo principal por `setDisplayMediaRequestHandler`). Converte cada fonte para PCM 16 bits, 16 kHz, mono, num AudioWorklet. | `start(): Promise<void>`, `stop()`, emite blocos `{ fonte: 'voce' \| 'entrevistador', pcm: ArrayBuffer }` via IPC |
| Transcrição | `src/main/transcription/deepgram.ts` | Uma conexão de streaming por fonte, modelo `nova-3`, `language` = `pt-BR` ou `en`, resultados parciais e finais, `smart_format`, `mip_opt_out=true`. Reconecta sozinha com espera crescente. | `class FluxoDeepgram { conectar(idioma, fonte); enviar(pcm); encerrar(); on('fala', cb); on('estado', cb) }` |
| Buffer da conversa | `src/main/session/conversa.ts` | Guarda as falas (parciais e finais) com horário e quem falou. Devolve os últimos 5 minutos para o prompt. | `adicionar(fala)`, `ultimosMinutos(n): Fala[]` |
| Leitor de documentos | `src/main/documents/leitor.ts` | PDF vira bloco `document` em base64 (lido pelo próprio Claude); Word vira texto via `mammoth`; .txt/.md entram como texto. | `lerDocumento(caminho): Promise<DocumentoLido>` |
| Montagem do pedido | `src/main/suggestions/prompt.ts` | Função pura que monta o pedido ao Claude: regras (seção 4) + documentos (com `cache_control`) + vaga + últimos minutos da conversa + instrução final. | `montarPedido(perfil, entrevista, falas, modo): MessageCreateParams` |
| Cliente Claude | `src/main/suggestions/claude.ts` | Pré-carrega o cache, gera a sugestão em streaming, traduz, trata recusa, erro e nova tentativa. Usa o SDK oficial `@anthropic-ai/sdk`. | `preCarregar(perfil)`, `gerar(pedido, aoReceberTexto): Promise<Resultado>`, `traduzir(texto, idioma)` |
| Arquivo da entrevista | `src/main/session/registro.ts` | Cria o .txt e acrescenta cada fala final e cada sugestão assim que chegam (só acrescenta, nunca reescreve). | `abrir(entrevista)`, `registrarFala(f)`, `registrarSugestao(s)`, `fechar(custo)` |
| Custos | `src/main/session/custos.ts` | Soma minutos de áudio enviados e tokens informados em `usage` pelo Claude; calcula o custo estimado. | `somarAudio(seg)`, `somarUso(usage, modelo)`, `total(): number` |
| Cofre de chaves | `src/main/config/cofre.ts` | Guarda e lê as chaves com `safeStorage` (proteção DPAPI do Windows). | `salvar(nome, valor)`, `ler(nome)` |
| Perfil e preferências | `src/main/config/perfil.ts` | Copia os documentos para a pasta de dados do app (`%APPDATA%`) e guarda as preferências em JSON. | `salvarPerfil`, `carregarPerfil`, `salvarPreferencias` |
| Janelas e atalhos | `src/main/janelas.ts`, `src/main/atalhos.ts` | Cria a janela flutuante com `transparent`, `frame: false`, `alwaysOnTop`, `skipTaskbar`, `focusable: false`, `backgroundThrottling: false` (a captura continua com a janela escondida) e `setContentProtection(true)`. Registra os atalhos globais e avisa quais não puderam ser registrados. | `criarJanelaFlutuante()`, `registrarAtalhos(acoes): string[]` (atalhos que falharam) |
| Verificação | `src/main/verificacao.ts` | Executa o "Testar tudo": chama cada chave com um pedido mínimo e mede o nível de cada fonte de áudio por alguns segundos. | `testarTudo(): Promise<RelatorioTeste>` |

## 6. Fluxo de dados

1. **Iniciar:** carrega perfil e chaves → abre o arquivo da entrevista → cria a janela flutuante → inicia a captura → abre as duas conexões com o Deepgram → `preCarregar(perfil)` envia regras e documentos ao Claude com `max_tokens: 0` para gravar o cache.
2. **Durante:** blocos de áudio → Deepgram → falas parciais (mostradas na janela) e finais (mostradas, guardadas no buffer e gravadas no arquivo).
3. **Atalho `Ctrl+Alt+Enter`:** buffer (últimos 5 minutos, incluindo a fala parcial em andamento) → `montarPedido`, cuja instrução final pede a resposta para a pergunta mais recente do entrevistador presente nesse trecho → `gerar` em streaming → cada pedaço de texto vai para a janela → ao terminar, a sugestão é gravada no arquivo e o custo é somado. Um novo atalho durante uma geração cancela a anterior e começa outra.
4. **Atalho `Ctrl+Alt+T`:** na primeira vez traduz a sugestão atual (resultado guardado); as próximas só alternam entre as duas versões.
5. **Encerrar** (fechar a janela flutuante ou o app): fecha as conexões, grava o custo no arquivo e volta à tela de preparação.

## 7. Velocidade e modos

Técnicas usadas em todos os modos:

- Streaming: a resposta aparece enquanto é gerada.
- Cache de prompt com TTL de 1 hora, gravado no "Iniciar". O prefixo em cache é o que não muda durante a entrevista: regras, documentos e vaga. Só o trecho da conversa vem depois do ponto de cache.
- Só os últimos 5 minutos da conversa vão no pedido.
- Resposta curta (seção 4.2) e `max_tokens` de 1.000.

| Modo | Modelo | Configuração |
|---|---|---|
| Equilíbrio (padrão) | `claude-opus-5-5` | `output_config.effort: "low"`, pensamento adaptativo, `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) |
| Turbo | `claude-opus-5-5` | igual ao Equilíbrio + `speed: "fast"` (beta `fast-mode-2026-02-01`); se o modo rápido devolver limite de uso (429), repete sem `speed` |
| Econômico | `claude-haiku-5-5` | `output_config.effort: "low"`, pensamento desligado |

Os detalhes de cada parâmetro serão conferidos na referência do SDK no momento da implementação.

## 8. Tratamento de erros

| Situação | Comportamento |
|---|---|
| Internet cai / conexão do Deepgram cai | Janela mostra "reconectando…"; nova tentativa com espera crescente (1 s, 2 s, 4 s, até 15 s); o arquivo registra o intervalo sem áudio. |
| Chave inválida (401) ou sem crédito | Mensagem específica ("Chave do Deepgram inválida", "Sem crédito no Claude") com o que fazer. No "Testar tudo" e durante a entrevista. |
| Claude devolve erro temporário (429, 5xx, rede) | Uma nova tentativa automática; se falhar, a janela mostra "Sem sugestão — aperte o atalho de novo". |
| Claude recusa (`stop_reason: "refusal"`) | Mostra "Sem sugestão para essa pergunta". |
| Microfone ou som do sistema indisponível | Aviso ao clicar em "Iniciar", antes de abrir a janela flutuante. |
| Atalho já usado por outro programa | Aviso com o nome do atalho que não funcionou. |
| Documento ilegível ou grande demais | Aviso ao salvar o perfil, com o nome do arquivo. |
| App fecha sem querer | Nada se perde: o arquivo é escrito em tempo real. |

## 9. Custos estimados (por hora de entrevista)

| Item | Estimativa |
|---|---|
| Transcrição Deepgram (2 vozes × 60 min, ~US$ 0,006 a 0,009 por minuto de cada voz) | US$ 0,70 a 1,10 |
| Claude, modo Equilíbrio (cache dos documentos + ~25 sugestões de ~US$ 0,02 a 0,03) | US$ 0,60 a 0,90 |
| **Total no modo Equilíbrio** | **~US$ 1,30 a 2,00** |
| Modo Turbo | parte do Claude custa o dobro (~US$ 0,60 a 0,90 a mais) |
| Modo Econômico | parte do Claude fica em centavos |

Os preços do Deepgram variam entre fontes e serão conferidos na página oficial quando a conta for criada.

## 10. Privacidade e segurança

- Chaves guardadas com `safeStorage` (DPAPI do Windows), nunca em texto puro.
- Documentos ficam no computador e são enviados apenas à API do Claude.
- Áudio enviado apenas ao Deepgram, com `mip_opt_out=true` (fora do programa de melhoria de modelos).
- Os arquivos de entrevista contêm a fala do entrevistador: uso pessoal, para estudo, sem compartilhar.
- Nenhum bot entra na chamada; o app não envia dados a nenhum outro serviço.

## 11. Testes

1. **Testes automáticos (Vitest)**, rodando a cada atualização no GitHub Actions em máquina Windows:
   - `montarPedido`: regras presentes, documentos com `cache_control`, janela de 5 minutos, idioma correto, configuração de cada modo.
   - `leitor`: PDF, Word e texto, e erro para arquivo ilegível.
   - `FluxoDeepgram`: interpretação das mensagens parciais e finais e reconexão (servidor falso).
   - `claude`: streaming, nova tentativa, recusa, cancelamento (cliente falso).
   - `registro`: arquivo só acrescenta e sobrevive a fechamento abrupto.
   - `custos`: cálculo por modo.
   - `atalhos`: aviso quando um atalho não registra.
2. **Teste de qualidade e velocidade** (`npm run avaliar`, precisa da chave do Claude, custo abaixo de US$ 1): 10 perguntas de exemplo (RH e técnicas, português e inglês) contra um perfil de teste. Para cada modo, mede o tempo até a primeira palavra e confere a regra dos três níveis, o tamanho e a ausência das expressões proibidas da seção 4.2. O resultado decide o modo padrão.
3. **Roteiro de teste no Windows da usuária**, entregue junto com o instalador:
   - "Testar tudo" com fone de ouvido.
   - Chamada de teste do Teams: compartilhar a tela e confirmar que a janela flutuante não aparece.
   - Reunião no Meet consigo mesma (ou com alguém de confiança) em português e em inglês: transcrição das duas vozes e sugestão com o atalho.
   - Atalhos funcionando com o Teams/Meet em primeiro plano, sem roubar o foco.
   - Arquivo da entrevista salvo com o custo no fim.

## 12. Distribuição

- `electron-builder` gera o instalador NSIS (`.exe`) no GitHub Actions (máquina `windows-latest`) a cada atualização do código; o instalador fica disponível para download na página da execução.
- Sem assinatura digital: na primeira execução o Windows mostra "O Windows protegeu o computador" → **Mais informações** → **Executar assim mesmo**.
- Requisito: Windows 10 versão 2004 ou mais recente (necessária para a janela ficar fora do compartilhamento de tela) ou Windows 11.

## 13. Riscos e como serão verificados

| Risco | Verificação |
|---|---|
| Português no streaming do Deepgram `nova-3` com qualidade abaixo do esperado | Medido no roteiro do Windows; alternativa documentada pelo Deepgram é o modelo `enhanced` com `pt-BR`. |
| Tempo até a primeira palavra acima de 2 s no modo Equilíbrio | Medido no teste de qualidade; se acontecer, o padrão passa a ser Turbo ou Econômico, conforme o resultado. |
| Arrastar e rolar a janela com `focusable: false` | Conferido no roteiro do Windows; se falhar, a janela passa a aceitar foco só enquanto o mouse está sobre ela. |
| Sem fone, o microfone capta o entrevistador | Cancelamento de eco ligado e recomendação explícita de fone na tela de preparação e no "Testar tudo". |
