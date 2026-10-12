# Mentorias NAAP

Site para os alunos do NAAP assistirem às gravações das mentorias de psicologia.

- O aluno se cadastra com e-mail e senha e espera a aprovação da administração.
- Os vídeos ficam no **Panda Video** e são organizados em **módulos**.
- O aluno só vê os vídeos dos módulos que comprou (venda presencial registrada pela administração). O acesso não expira.
- Cada conta só pode ficar conectada em **um aparelho por vez**. Se alguém entrar em outro aparelho, o anterior é desconectado.
- Marca d'água com nome, e-mail e telefone do NAAP sobre o vídeo, inclusive em tela cheia.
- Cada vídeo pode ter um **PDF** anexo.
- E-mails automáticos: cadastro aprovado, vídeo novo publicado e aviso à administração quando chega um cadastro novo.
- **Relatórios** para a administração: vendas (por mês e forma de pagamento), alunos aprovados e pendentes, vídeos mais assistidos, % assistido, último acesso. Tudo pode ser exportado em CSV (abre no Excel).
- Páginas de **Termos de uso** e **Política de privacidade** (LGPD), com aceite obrigatório no cadastro.

## Custos estimados

| Item | Serviço | Custo |
|---|---|---|
| Hospedagem do site | Cloudflare Workers, plano Free | grátis |
| Banco de dados, login e PDFs | Supabase, plano Free | grátis |
| E-mails | Brevo, plano Free (300 e-mails/dia) | grátis |
| Vídeos | Panda Video, plano Bronze (200 GB armazenados, 500 GB de tráfego/mês) | ≈ US$ 17,90/mês |
| Domínio | `mentoriasnaap.com.br` no registro.br | ≈ R$ 40/ano |

**Total: ≈ R$ 100 a 110 por mês** (praticamente só o Panda Video), dentro do limite de R$ 200. Confira o preço atual do Panda em reais no site deles.

Observações:
- O Supabase Free **pausa o projeto depois de 7 dias sem nenhum acesso**. Para reativar, clique em "Restore" no painel. O plano Pro custa US$ 25/mês.
- O plano grátis da Cloudflare limita o tempo de processamento de cada acesso. Se aparecer "Error 1102 (Worker exceeded resource limits)", ative o **Workers Paid** (US$ 5/mês), sem mudar nada no código.

---

## Colocar no ar (Cloudflare)

Pré-requisitos: Node.js 20 ou mais novo e este repositório na sua máquina (`npm install` na pasta `mentorias-naap`).

### 1. Supabase (banco de dados e login)

1. Crie uma conta em https://supabase.com e um projeto novo, na região **South America (São Paulo)**.
2. No **SQL Editor**, rode **em ordem** cada arquivo da pasta `supabase/migrations/` (cole o conteúdo e clique em **Run**).
3. Em **Authentication → Sign In / Providers → Email**, **desative "Confirm email"**. A aprovação da administração já faz o papel de filtro.
4. Em **Authentication → Emails → SMTP Settings**, ative o SMTP próprio com os dados de SMTP do Brevo (passo 2): host `smtp-relay.brevo.com`, porta `587`, usuário e senha da aba **SMTP & API → SMTP** do Brevo. Sem isso, o e-mail de "Esqueci minha senha" não chega.
5. Em **Authentication → URL Configuration**: Site URL `https://mentoriasnaap.com.br` e Redirect URL `https://mentoriasnaap.com.br/auth/callback`. Enquanto não houver domínio, use o endereço `…workers.dev` do passo 4.
6. Em **Project Settings → API**, copie a `Project URL`, a chave `anon public` e a chave `service_role`.

### 2. Brevo (e-mails automáticos, grátis)

1. Crie a conta em https://www.brevo.com.
2. Em **Senders, Domains & Dedicated IPs → Senders**, cadastre e confirme o e-mail remetente (ex.: `contato@naappsicologia.com.br`).
3. Em **SMTP & API → API Keys**, gere uma chave (começa com `xkeysib-`).

### 3. Panda Video (vídeos)

1. Crie a conta em https://www.pandavideo.com.br e escolha um plano.
2. Nas configurações de segurança, cadastre o domínio do site (e o endereço `…workers.dev`, enquanto ele for usado) como **domínio permitido**, para os vídeos só tocarem dentro da plataforma.

### 4. Cloudflare (hospedagem grátis)

1. Crie uma conta grátis em https://dash.cloudflare.com.
2. Na pasta `mentorias-naap`, faça login: `npx wrangler login` (abre o navegador).
3. Copie `.env.example` para **`.env.production.local`** e preencha com os dados reais dos passos 1 a 3.
4. Publique:
   ```bash
   npm run cf:deploy
   ```
   O comando confere o `.env.production.local`, gera o site e publica. Na primeira vez, a Cloudflare pede para escolher um subdomínio. O site fica em `https://mentorias-naap.<subdominio>.workers.dev`.
5. Para atualizar o site depois de qualquer mudança, rode `npm run cf:deploy` de novo.

Para testar a versão de produção na sua máquina, no mesmo motor da Cloudflare: `npm run cf:preview`.

### 5. Domínio próprio

1. Registre `mentoriasnaap.com.br` em https://registro.br.
2. Na Cloudflare, adicione o domínio (**Add a domain**, plano Free) e troque os servidores DNS no registro.br pelos que a Cloudflare indicar.
3. Em **Workers & Pages → mentorias-naap → Settings → Domains & Routes → Add → Custom domain**, informe `mentoriasnaap.com.br`.
4. Atualize `NEXT_PUBLIC_SITE_URL` no `.env.production.local`, as URLs do passo 1.5 e os domínios permitidos do Panda. Depois rode `npm run cf:deploy`.

### 6. Criar a conta de administrador

1. Acesse o site e cadastre-se normalmente com o seu e-mail.
2. No Supabase, vá em **SQL Editor** e rode (trocando o e-mail):
   ```sql
   update public.profiles
   set role = 'admin', status = 'approved', approved_at = now()
   where email = 'seu-email@exemplo.com';
   ```
3. Saia e entre de novo. Você verá o menu **Relatórios · Alunos · Módulos · Vendas**.

---

## Uso no dia a dia

1. **Depois da mentoria**: envie a gravação ao Panda Video e copie o **link de incorporação** (ou o código `<iframe>`).
2. Em **Módulos**, abra o módulo, clique em "Adicionar vídeo", cole o link e informe a duração em minutos. Deixe marcado "Avisar por e-mail" para os alunos do módulo receberem o aviso.
3. Para anexar um PDF, clique em **Editar / PDF** no vídeo.
4. **Venda presencial**: peça ao aluno que se cadastre no site. Depois, em **Vendas** (ou na ficha do aluno), registre a venda marcando os módulos comprados. Os módulos são liberados na hora e o aluno é aprovado e avisado por e-mail.
5. **Relatórios**: a página inicial da administração mostra os indicadores. Use os filtros de data e os botões "Exportar CSV".

O manual completo, com capturas de tela, está em `docs/manual/Manual-Mentorias-NAAP.pdf`.

Há também **vídeos curtos** (cerca de 1 minuto cada, sem áudio, com legendas na tela) em `docs/videos/`:

- **Aluno(a)**: [criar a conta e entrar](docs/videos/Aluno-1-Criar-a-conta-e-entrar.mp4) · [assistir às mentorias](docs/videos/Aluno-2-Assistindo-as-mentorias.mp4)
- **Administração**: [aprovar alunos e liberar módulos](docs/videos/Administracao-1-Aprovar-alunos-e-liberar-modulos.mp4) · [criar módulo e publicar vídeo](docs/videos/Administracao-2-Criar-modulo-e-publicar-video.mp4) · [relatórios, exportar e bloquear](docs/videos/Administracao-3-Relatorios-exportar-e-bloquear.mp4)
- **Responsável técnico**: [rodar a demonstração local](docs/videos/Tecnico-1-Rodar-a-demonstracao-local.mp4) · [publicar na Cloudflare e criar o administrador](docs/videos/Tecnico-2-Publicar-na-Cloudflare-e-criar-administrador.mp4)

Para mudar as **cores**, edite o início de `src/app/globals.css`. Para usar o **logo**, troque o componente `src/components/Logo.tsx` por uma imagem em `public/`.

---

## Rodar na sua máquina (demonstração)

Pré-requisitos: [Node.js 20 ou mais novo](https://nodejs.org) e [Docker Desktop](https://www.docker.com/products/docker-desktop/) **aberto**.

```bash
cd mentorias-naap
npm install
npm run local:start                 # 1ª vez demora (baixa o banco local)
npm run local:env                   # cria o .env.local automaticamente
npm run demo:seed -- "LINK_DE_EMBED_DO_PANDA"   # dados de exemplo (o link é opcional)
npm run dev                         # abra http://localhost:3000
```

Logins de demonstração (senha `naap2026`):
- Administração: `coordenacao@naappsicologia.com.br`
- Aluna: `maria.souza@email.com` (ou `ana.costa@email.com`)

O link opcional é o de incorporação de um vídeo seu no Panda (`https://player-vz-….tv.pandavideo.com.br/embed/?v=…`). Sem ele, os vídeos de exemplo não tocam. Para a demonstração local tocar o vídeo, cadastre `localhost` como domínio permitido no Panda (se a restrição de domínio estiver ativa).

Se você já tinha rodado a demonstração antes da troca para Panda/Cloudflare, rode `npm run local:env` de novo (o envio de e-mail mudou).

Os e-mails enviados pelo sistema ficam numa caixa de teste em http://127.0.0.1:54324, e o painel do banco em http://127.0.0.1:54323.
Para recomeçar do zero, rode `npm run demo:seed` de novo. Ao terminar, `npm run local:stop` desliga o banco local.

## Desenvolvimento

Tecnologias: Next.js 16 (App Router) publicado na Cloudflare Workers via OpenNext, Supabase (Postgres, Auth e Storage, com regras de RLS), Panda Video, Brevo (e-mail) e Tailwind CSS 4.

O arquivo `src/middleware.ts` usa a convenção "middleware" (Edge Runtime), que o Next 16 marca como obsoleta em favor de `proxy.ts`. Ela foi mantida de propósito: o adaptador da Cloudflare só suporta oficialmente o middleware Edge.
