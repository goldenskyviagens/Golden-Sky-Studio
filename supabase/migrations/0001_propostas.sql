-- Módulo Pacotes ("Proposta Premium"): tabela de propostas + bucket de fotos.
-- Rodar uma vez no SQL Editor do painel do Supabase (Project > SQL Editor > New query).

create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  titulo text not null default '',
  dados jsonb not null default '{}'::jsonb
);

alter table public.propostas enable row level security;

-- Só o dono vê/edita/apaga via API normal (lista de "minhas propostas" em /pacotes).
create policy "Donos veem suas propostas" on public.propostas
  for select to authenticated using (auth.uid() = created_by);
create policy "Donos criam propostas" on public.propostas
  for insert to authenticated with check (auth.uid() = created_by);
create policy "Donos editam suas propostas" on public.propostas
  for update to authenticated using (auth.uid() = created_by);
create policy "Donos apagam suas propostas" on public.propostas
  for delete to authenticated using (auth.uid() = created_by);

-- Acesso público só por ID exato (o link) — não existe policy pública de select
-- na tabela, então ninguém consegue listar todas as propostas via API REST.
create or replace function public.get_proposta_publica(proposta_id uuid)
returns setof public.propostas
language sql security definer set search_path = public
as $$ select * from public.propostas where id = proposta_id; $$;
grant execute on function public.get_proposta_publica(uuid) to anon, authenticated;

-- Bucket de fotos: bucket "public" já serve o arquivo direto por URL, sem
-- precisar de policy de select — só precisamos liberar upload pra quem loga.
insert into storage.buckets (id, name, public)
values ('proposta-fotos', 'proposta-fotos', true)
on conflict (id) do nothing;

create policy "Autenticados enviam fotos de propostas" on storage.objects
  for insert to authenticated with check (bucket_id = 'proposta-fotos');
create policy "Autenticados apagam fotos que enviaram" on storage.objects
  for delete to authenticated using (bucket_id = 'proposta-fotos');
