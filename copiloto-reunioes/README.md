# Copiloto de Reuniões

Programa para Windows que ouve suas reuniões online (Teams e Google Meet), transcreve ao vivo em português e inglês e, com IA (Claude), sugere **o que responder** quando fazem uma pergunta a você e **explica termos técnicos** que aparecem na conversa, usando os documentos que você anexou.

- As sugestões aparecem num **painel flutuante que não aparece no compartilhamento de tela**, controlado por **atalhos de teclado** que funcionam com o Teams ou o Meet em foco.
- Captura o microfone ("Você") e o som do computador ("Outros"), sem compartilhar a tela.
- No fim da reunião, guarda um **resumo** e os **conceitos explicados** no Histórico.
- Tem um **treino de entrevista de emprego** (simulação, em português ou inglês).

O que **não** faz:

- Não tem login, contas nem servidor próprio: tudo roda e fica salvo no seu computador.
- Não serve para uso escondido em entrevistas de emprego reais. O treino de entrevista é uma simulação e não capta o som de reuniões. Não existe nenhum recurso para burlar a detecção de plataformas de entrevista ou de ferramentas de monitoramento, nem para esconder o programa da barra de tarefas ou da lista de processos. A invisibilidade se limita ao conteúdo do painel nas capturas de tela.
- Não traduz ao vivo, não atualiza sozinho e não funciona em macOS, Linux ou celular.

Requisitos: Windows 10 versão 2004 ou mais novo, ou Windows 11.

---

## Instalar

1. No GitHub, abra a aba **Actions** do repositório e clique na execução mais recente do fluxo **Copiloto de Reuniões** (a que está verde).
2. Na parte de baixo da página, em **Artifacts**, baixe **copiloto-reunioes-instalador** e descompacte o arquivo `.zip`.
3. Dê dois cliques em `Copiloto-de-Reunioes-Setup-<versão>.exe` e siga o instalador.
4. Se aparecer **"O Windows protegeu o computador"** (SmartScreen), clique em **Mais informações** e depois em **Executar assim mesmo**. Isso acontece porque o instalador não tem assinatura digital paga.

Para atualizar, baixe o instalador novo e instale por cima. Não há atualização automática.

## Criar as chaves

O programa precisa de duas chaves, que você cola nas Configurações na primeira vez que abrir. Elas ficam guardadas criptografadas no seu computador.

**Anthropic (a IA)**

1. Entre em https://console.anthropic.com e crie uma conta.
2. Crie uma chave de API.
3. Compre créditos em console.anthropic.com → Billing (sem crédito a IA não responde).
4. Defina um **limite de gasto mensal** (por exemplo, US$ 20), para nunca ter surpresa na fatura.

**Soniox (a transcrição)**

1. Entre em https://soniox.com e crie uma conta.
2. Crie uma chave de API.
3. Confira as opções de **retenção de dados** da Soniox e escolha a que combina com você.

## Uso no dia a dia

1. Em **Nova reunião**, anexe os documentos da reunião: PDF (com texto), Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`), `.txt` ou `.md`. Formatos antigos (`.doc`, `.xls`, `.ppt`) não são aceitos. O limite é de cerca de 80 mil tokens por reunião (≈ 150 páginas).
2. Escreva um pouco de **contexto** (quem é o cliente, qual o assunto).
3. Marque **"Avisei os participantes"**. É o lembrete da LGPD: avise as pessoas de que a reunião está sendo transcrita. Sem isso o programa não inicia uma reunião com áudio.
4. Clique em **Iniciar**.
5. Use **fone de ouvido**. Sem fone, o som dos outros sai pelo alto-falante, entra no seu microfone e as falas se misturam.
6. Feche músicas e vídeos que estiverem tocando, porque o programa também capta o som do computador.
7. Abra o Teams ou o Meet e participe normalmente. O painel flutuante fica por cima e **não aparece quando você compartilha a tela** no Windows 10 2004 ou mais novo e no Windows 11.
8. Ao encerrar, o resumo e os conceitos ficam no **Histórico**.

Pausado (`Ctrl+Alt+B`), nenhum áudio é enviado e nada é cobrado. O botão **Ensaiar** (que funciona sem marcar a caixa "Avisei os participantes") funciona como uma reunião, mas com falas digitadas no lugar do áudio: use para testar os documentos antes de uma reunião.

## Atalhos

Funcionam com o Teams ou o Meet em foco e podem ser mudados nas Configurações.

| Atalho | Ação |
|---|---|
| `Ctrl+Alt+Espaço` | **Me ajuda a responder**: cartão "Diga isso" para a pergunta mais recente feita a você |
| `Ctrl+Alt+X` | **Explicar**: cartão "Conceito" para o termo técnico mais recente |
| `Ctrl+Alt+D` | **Digitar pergunta**: o painel recebe foco e mostra o campo. `Enter` envia e `Esc` cancela |
| `Ctrl+Alt+O` | **Ocultar ou mostrar** o painel |
| `Ctrl+Alt+B` | **Pausar ou retomar** a escuta |
| `Ctrl+Alt+,` e `Ctrl+Alt+.` | Cartão anterior e próximo |

As Configurações mostram um aviso se o Windows recusar um atalho por já estar em uso por outro programa.

## Treino de entrevista

É uma **simulação para treinar**. Ele nunca ouve reuniões e nunca capta o som do computador: só o seu microfone, quando você escolhe responder falando.

1. Cole a descrição da vaga (ou escolha um arquivo) e, se quiser, anexe seu currículo.
2. Escolha o idioma (português ou inglês), o tipo (comportamental, técnica ou mista) e o número de perguntas (5, 8 ou 10).
3. Responda uma pergunta por vez, falando (botão **Terminei** ao acabar) ou digitando.
4. Para cada resposta você vê o que foi bem, o que faltou e uma versão melhorada. Em inglês, também dicas de vocabulário e gramática. Os comentários vêm sempre em português.
5. No fim há um relatório com pontos fortes e pontos a treinar, salvo no Histórico.

## Privacidade

- Tudo fica em `%APPDATA%/Copiloto de Reuniões/`: `config.json` (preferências), `chaves.bin` (chaves criptografadas) e `historico/*.json` (resumos e conceitos).
- **Nunca é gravado em disco**: o áudio, a transcrição completa e os cartões "Diga isso".
- **Apagar** no Histórico apaga o arquivo de verdade.
- O texto da transcrição e dos documentos vai para a **Anthropic**; o áudio vai para a **Soniox**. Os dois servem apenas para processar os pedidos. Por padrão, a Anthropic não usa dados da API para treinar modelos. Confira as opções de retenção da Soniox.
- As chaves nunca ficam visíveis para as janelas do programa.

## Custos

Estimativa para 10 horas de reunião por mês. O custo da IA cresce com o tamanho dos documentos, porque eles vão em cada pedido (com cache). A tabela compara documentação típica (≈ 80 páginas, ≈ 40 mil tokens) com a documentação no limite (80 mil tokens).

| Item | Documentação típica | Documentação no limite |
|---|---|---|
| Transcrição Soniox, 2 fontes × US$ 0,12/h | ≈ US$ 2,50 | ≈ US$ 2,50 |
| Detector Haiku 5.5 (~200 chamadas/h com fala nova; no máximo 360/h; prefixo em cache) | ≈ US$ 2 | ≈ US$ 3 |
| Explicador Opus 5.5 (~15 cartões/h + 1 gravação de cache de 1 h por reunião) | ≈ US$ 7 | ≈ US$ 12 |
| Resumo final (≈ US$ 0,10 por reunião) | ≈ US$ 1 | ≈ US$ 1 |
| **Total por mês** | **≈ US$ 12–13** | **≈ US$ 19** |

O treino de entrevista custa à parte, ≈ US$ 0,10 a 0,20 por sessão. São estimativas com preços de outubro de 2026. Defina um limite de gasto mensal no painel da Anthropic.

## Roteiro de teste de 10 minutos

Não dá para testar som real, Teams e compartilhamento de tela no ambiente de desenvolvimento, então faça este roteiro no seu Windows depois de instalar:

1. Instalar e configurar as chaves.
2. Fazer uma chamada de teste no Teams (ex.: "Reunião agora" com o celular como segundo participante). Conferir as falas "Você" e "Outros" em português e em inglês.
3. Fazer uma pergunta pelo celular e conferir o cartão "Diga isso". Citar um termo dos documentos e conferir o cartão "Conceito" com a fonte.
4. Testar todos os atalhos com o Teams em foco.
5. Compartilhar a **tela inteira** e conferir no celular que o painel não aparece.
6. Repetir os itens 2 e 5 no Google Meet (Chrome).
7. Encerrar e conferir o Histórico. Conferir que não há arquivos de áudio ou de transcrição na pasta de dados.
8. Fazer um treino de entrevista curto em inglês.
9. Anexe um PDF, um Word (.docx), um Excel (.xlsx) e um PowerPoint (.pptx) numa Nova reunião e confira que todos aparecem como lidos.

## Desenvolvimento

Pré-requisito: Node.js 22. Todos os comandos rodam na pasta `copiloto-reunioes`.

```
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install   # instala sem baixar o Electron (útil em Linux/nuvem)
npm install                                   # instalação normal, com o Electron
npm run dev          # abre o programa em modo de desenvolvimento
npm test             # testes automáticos (Vitest)
npm run typecheck    # confere os tipos
npm run lint         # confere o estilo do código
npm run build        # compila para a pasta out/
npm run dist:win     # gera o instalador em dist/ (o GitHub Actions faz isso sozinho)
```

**Ensaio com a IA real:** `npm run ensaio:real` envia falas de exemplo em português e em inglês e confere se os cartões e as fontes fazem sentido. Precisa da variável `ANTHROPIC_API_KEY` definida e **custa alguns centavos**, por isso só rode quando quiser.
