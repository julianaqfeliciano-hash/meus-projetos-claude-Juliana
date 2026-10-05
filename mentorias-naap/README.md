# Mentorias NAAP

Site para os alunos do NAAP assistirem às gravações das mentorias de psicologia.

- O aluno se cadastra com e-mail e senha e espera a aprovação da administração.
- Os vídeos ficam no YouTube como **não listados** e são organizados em **módulos**.
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
| Vídeos | YouTube (não listado) | grátis |
| Banco de dados, login e PDFs | Supabase, plano Free | grátis |
| Hospedagem do site | Vercel Pro (o plano Hobby, gratuito, não permite uso comercial) | US$ 20/mês ≈ R$ 110 |
| E-mails | Gmail com "senha de app" (até ~500/dia) | grátis |
| Domínio | `mentoriasnaap.com.br` no registro.br | ≈ R$ 40/ano |

**Total: ≈ R$ 115 por mês**, dentro do limite de R$ 200.

Observações:
- O Supabase Free **pausa o projeto depois de 7 dias sem nenhum acesso**. Como há mentoria a cada 2 semanas, pode acontecer. Para reativar, é só clicar em "Restore" no painel. Se isso incomodar, o plano Pro custa US$ 25/mês.
- Se preferir não pagar a Vercel, o site também roda na Netlify ou na Cloudflare. Confira os termos atuais de uso comercial do plano gratuito de cada uma.

---

## Passo a passo para colocar no ar

### 1. Supabase (banco de dados e login)

1. Crie uma conta em https://supabase.com e um projeto novo. Escolha a região **South America (São Paulo)**.
2. No menu **SQL Editor**, cole todo o conteúdo de `supabase/migrations/20261005000000_schema.sql` e clique em **Run**.
3. Em **Authentication → Sign In / Providers → Email**, **desative "Confirm email"**. A aprovação da administração já faz o papel de filtro.
4. Em **Authentication → Emails → SMTP Settings**, ative o SMTP personalizado com os mesmos dados do passo 3 abaixo. Sem isso, o e-mail de "esqueci minha senha" não chega aos alunos.
5. Em **Authentication → URL Configuration**:
   - Site URL: `https://mentoriasnaap.com.br`
   - Redirect URLs: `https://mentoriasnaap.com.br/auth/callback`
6. Em **Project Settings → API**, copie a `Project URL`, a chave `anon public` e a chave `service_role`.

### 2. Domínio

Registre `mentoriasnaap.com.br` em https://registro.br.

### 3. E-mail (Gmail)

1. Na conta Google que vai enviar os e-mails, ative a verificação em duas etapas.
2. Crie uma **senha de app** em https://myaccount.google.com/apppasswords.
3. Use `smtp.gmail.com`, porta `465`, o seu e-mail como usuário e a senha de app.

### 4. Hospedagem (Vercel)

1. Crie uma conta em https://vercel.com e importe este repositório do GitHub.
2. Em **Root Directory**, selecione `mentorias-naap`.
3. Em **Environment Variables**, cadastre todas as variáveis de `.env.example` com os valores reais.
4. Clique em **Deploy**. Depois, em **Settings → Domains**, adicione `mentoriasnaap.com.br` e siga as instruções de DNS (no registro.br).

### 5. Criar a conta de administrador

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

1. **Depois da mentoria**: envie a gravação ao YouTube como **Não listado**.
2. Em **Módulos**, abra o módulo, clique em "Adicionar vídeo" e cole o link do YouTube. Deixe marcado "Avisar por e-mail" para os alunos do módulo receberem o aviso.
3. Para anexar um PDF, clique em **Editar / PDF** no vídeo.
4. **Venda presencial**: peça ao aluno que se cadastre no site. Depois, em **Vendas** (ou na ficha do aluno), registre a venda marcando os módulos comprados. Os módulos são liberados na hora e o aluno é aprovado e avisado por e-mail.
5. **Relatórios**: a página inicial da administração mostra os indicadores. Use os filtros de data e os botões "Exportar CSV".

Para mudar as **cores**, edite o início de `src/app/globals.css`. Para usar o **logo**, troque o componente `src/components/Logo.tsx` por uma imagem em `public/`.

---

## Rodar na sua máquina (demonstração)

Pré-requisitos: [Node.js 20 ou mais novo](https://nodejs.org) e [Docker Desktop](https://www.docker.com/products/docker-desktop/) **aberto**.

```bash
cd mentorias-naap
npm install
npm run local:start                 # 1ª vez demora (baixa o banco local)
npm run local:env                   # cria o .env.local automaticamente
npm run demo:seed -- https://youtu.be/SEU_VIDEO   # dados de exemplo (o link é opcional)
npm run dev                         # abra http://localhost:3000
```

Logins de demonstração (senha `naap2026`):
- Administração: `coordenacao@naappsicologia.com.br`
- Aluna: `maria.souza@email.com` (ou `ana.costa@email.com`)

Os e-mails enviados pelo sistema ficam numa caixa de teste em http://127.0.0.1:54324, e o painel do banco em http://127.0.0.1:54323.
Para recomeçar do zero, rode `npm run demo:seed` de novo. Ao terminar, `npm run local:stop` desliga o banco local.

## Desenvolvimento

Tecnologias: Next.js 16 (App Router), Supabase (Postgres, Auth e Storage, com regras de RLS), Tailwind CSS 4 e Nodemailer.
