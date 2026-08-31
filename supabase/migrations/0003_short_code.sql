-- Link curto pra compartilhar a proposta no WhatsApp: em vez do uuid inteiro
-- em /proposta/<uuid>, um código curto em /p/<code> — mais fácil de colar e
-- fica mais apresentável na conversa com o cliente. Gerado no app (client),
-- não aqui — o banco só garante que não repete (unique).

alter table public.propostas add column short_code text unique;

create or replace function public.get_proposta_publica_por_codigo(codigo text)
returns setof public.propostas
language sql security definer set search_path = public
as $$ select * from public.propostas where short_code = codigo; $$;
grant execute on function public.get_proposta_publica_por_codigo(text) to anon, authenticated;
