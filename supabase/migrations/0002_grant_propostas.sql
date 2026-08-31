-- Corrige "permission denied for table propostas" (código 42501).
-- A migração anterior criou a tabela e as políticas de RLS, mas não os
-- GRANTs de nível SQL que o Postgres exige por baixo das políticas.
-- Rodar uma vez no SQL Editor do painel do Supabase.

grant select, insert, update, delete on public.propostas to authenticated;
