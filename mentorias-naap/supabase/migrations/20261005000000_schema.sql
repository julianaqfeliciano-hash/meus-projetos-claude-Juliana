-- =============================================================================
-- Mentorias NAAP — esquema do banco de dados (Supabase / PostgreSQL)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Pode ser executado mais de uma vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfis (um por usuário do Supabase Auth)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '',
  email             text not null,
  phone             text not null default '',
  role              text not null default 'student' check (role in ('student', 'admin')),
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected', 'blocked')),
  -- Sessão ativa: só a última sessão aberta consegue assistir (impede conta compartilhada).
  active_session_id uuid,
  accepted_terms_at timestamptz,
  approved_at       timestamptz,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, accepted_terms_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'accepted_terms_at', '')::timestamptz
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Módulos, vídeos, vendas e acessos
-- -----------------------------------------------------------------------------
create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  position    int  not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.videos (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.modules (id) on delete cascade,
  title            text not null,
  description      text not null default '',
  youtube_id       text not null,
  recorded_on      date,
  duration_minutes int,
  pdf_path         text,
  pdf_name         text,
  position         int  not null default 0,
  published        boolean not null default false,
  notified_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists videos_module_idx on public.videos (module_id);

-- Venda presencial registrada pela administração.
create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles (id) on delete cascade,
  sold_on        date not null default current_date,
  amount_cents   int  not null check (amount_cents >= 0),
  payment_method text not null default 'pix',
  notes          text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists sales_student_idx on public.sales (student_id);

-- Quais módulos cada aluno pode assistir. O acesso não expira.
create table if not exists public.module_access (
  student_id uuid not null references public.profiles (id) on delete cascade,
  module_id  uuid not null references public.modules (id) on delete cascade,
  sale_id    uuid references public.sales (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (student_id, module_id)
);

-- Progresso de cada aluno em cada vídeo (usado nos relatórios).
create table if not exists public.video_progress (
  student_id      uuid not null references public.profiles (id) on delete cascade,
  video_id        uuid not null references public.videos (id) on delete cascade,
  seconds_watched int  not null default 0,  -- tempo total assistido
  max_position    int  not null default 0,  -- ponto mais distante alcançado (s)
  duration        int  not null default 0,  -- duração do vídeo (s), informada pelo player
  view_count      int  not null default 0,  -- quantas vezes abriu o vídeo
  first_watched_at timestamptz not null default now(),
  last_watched_at  timestamptz not null default now(),
  primary key (student_id, video_id)
);

-- -----------------------------------------------------------------------------
-- Funções auxiliares de permissão
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Verdadeiro quando o usuário está aprovado E esta é a sessão mais recente dele.
create or replace function public.is_active_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
      and active_session_id::text = (auth.jwt() ->> 'session_id')
  );
$$;

create or replace function public.has_module_access(p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_student() and exists (
    select 1 from public.module_access
    where student_id = auth.uid() and module_id = p_module
  );
$$;

-- Registra o progresso enviado pelo player. Só funciona para quem tem acesso.
create or replace function public.track_progress(
  p_video    uuid,
  p_position int,
  p_duration int,
  p_delta    int,
  p_new_view boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module uuid;
begin
  select module_id into v_module from public.videos where id = p_video and published;
  if v_module is null or not public.has_module_access(v_module) then
    raise exception 'sem acesso a este vídeo';
  end if;

  insert into public.video_progress as vp
    (student_id, video_id, seconds_watched, max_position, duration, view_count)
  values (
    auth.uid(), p_video,
    greatest(least(p_delta, 120), 0),
    greatest(p_position, 0),
    greatest(p_duration, 0),
    case when p_new_view then 1 else 0 end
  )
  on conflict (student_id, video_id) do update set
    seconds_watched = vp.seconds_watched + greatest(least(p_delta, 120), 0),
    max_position    = greatest(vp.max_position, p_position),
    duration        = greatest(vp.duration, p_duration),
    view_count      = vp.view_count + case when p_new_view then 1 else 0 end,
    last_watched_at = now();

  update public.profiles set last_seen_at = now() where id = auth.uid();
end;
$$;

revoke all on function public.track_progress(uuid, int, int, int, boolean) from public, anon;
grant execute on function public.track_progress(uuid, int, int, int, boolean) to authenticated;

-- Encerra as outras sessões de login do usuário (usado pelo servidor ao entrar).
create or replace function public.revoke_other_sessions(p_user uuid, p_keep uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.sessions where user_id = p_user and id <> p_keep;
$$;

revoke all on function public.revoke_other_sessions(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_other_sessions(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Segurança por linha (RLS)
--
-- Leituras do aluno passam por estas regras. Todas as alterações (aprovar,
-- cadastrar vídeo, registrar venda...) são feitas pelo servidor com a chave
-- de serviço, depois de conferir que quem pediu é o administrador.
-- -----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.modules        enable row level security;
alter table public.videos         enable row level security;
alter table public.sales          enable row level security;
alter table public.module_access  enable row level security;
alter table public.video_progress enable row level security;

drop policy if exists "perfil: próprio ou admin" on public.profiles;
create policy "perfil: próprio ou admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "módulos: publicados para alunos aprovados" on public.modules;
create policy "módulos: publicados para alunos aprovados" on public.modules
  for select to authenticated
  using (public.is_admin() or (published and public.is_active_student()));

drop policy if exists "vídeos: só de módulos comprados" on public.videos;
create policy "vídeos: só de módulos comprados" on public.videos
  for select to authenticated
  using (
    public.is_admin()
    or (
      published
      and public.has_module_access(module_id)
      and exists (select 1 from public.modules m where m.id = module_id and m.published)
    )
  );

drop policy if exists "acessos: próprios ou admin" on public.module_access;
create policy "acessos: próprios ou admin" on public.module_access
  for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "vendas: admin" on public.sales;
create policy "vendas: admin" on public.sales
  for select to authenticated
  using (public.is_admin());

drop policy if exists "progresso: próprio ou admin" on public.video_progress;
create policy "progresso: próprio ou admin" on public.video_progress
  for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

-- Nenhuma escrita direta pelo navegador (a não ser via track_progress).
revoke insert, update, delete on all tables in schema public from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Armazenamento dos PDFs (bucket privado)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "materiais: admin envia" on storage.objects;
create policy "materiais: admin envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiais' and public.is_admin());

drop policy if exists "materiais: admin substitui" on storage.objects;
create policy "materiais: admin substitui" on storage.objects
  for update to authenticated
  using (bucket_id = 'materiais' and public.is_admin());

drop policy if exists "materiais: admin lê" on storage.objects;
create policy "materiais: admin lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'materiais' and public.is_admin());

-- =============================================================================
-- Depois de criar SUA conta no site, rode a linha abaixo (com o seu e-mail)
-- para torná-la administradora:
--
--   update public.profiles
--   set role = 'admin', status = 'approved', approved_at = now()
--   where email = 'seu-email@exemplo.com';
-- =============================================================================
