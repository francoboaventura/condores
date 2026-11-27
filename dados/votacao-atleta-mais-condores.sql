-- Votação pública "Atleta Mais Condores"
-- Cada atleta (da tabela cond_atletas) vota uma única vez, em outro atleta.
-- O público (sem login) só consegue: ver a lista de nomes + quem já votou, e registrar o voto.
-- Em quem cada um votou e a contagem ficam visíveis só para a diretoria (função cond_votacao_resultado).

create table if not exists public.cond_votos_atleta_mais_condores (
  id         uuid primary key default gen_random_uuid(),
  eleitor_id uuid not null references public.cond_atletas(id),
  votado_id  uuid not null references public.cond_atletas(id),
  criado_em  timestamptz not null default now(),
  constraint cond_votos_amc_um_voto_por_atleta unique (eleitor_id),
  constraint cond_votos_amc_nao_vota_em_si check (eleitor_id <> votado_id)
);
create index if not exists cond_votos_amc_votado_idx on public.cond_votos_atleta_mais_condores (votado_id);

-- atleta que ainda está no time (usado pela regra de gravação; o público não lê cond_atletas)
create or replace function public.cond_atleta_ativo(p_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.cond_atletas where id = p_id and ativo) $$;

-- ---------- permissões ----------
alter table public.cond_votos_atleta_mais_condores enable row level security;

-- tira tudo e devolve só o necessário: ler quem votou (sem a coluna votado_id) e registrar o voto
revoke all on public.cond_votos_atleta_mais_condores from anon, authenticated;
grant select (id, eleitor_id, criado_em) on public.cond_votos_atleta_mais_condores to anon, authenticated;
grant insert (eleitor_id, votado_id) on public.cond_votos_atleta_mais_condores to anon, authenticated;

drop policy if exists cond_votos_amc_ver_quem_votou on public.cond_votos_atleta_mais_condores;
create policy cond_votos_amc_ver_quem_votou on public.cond_votos_atleta_mais_condores
  for select to anon, authenticated using (true);

drop policy if exists cond_votos_amc_votar on public.cond_votos_atleta_mais_condores;
create policy cond_votos_amc_votar on public.cond_votos_atleta_mais_condores
  for insert to anon, authenticated
  with check (eleitor_id <> votado_id and public.cond_atleta_ativo(eleitor_id) and public.cond_atleta_ativo(votado_id));
-- sem regras de update/delete: ninguém altera nem apaga voto pela API

-- ---------- lista pública para a tela de votação ----------
-- só nome e número da camisa (nada de WhatsApp, aniversário etc.) + se já votou
create or replace function public.cond_votacao_atletas()
returns table (id uuid, nome text, numero smallint, ja_votou boolean)
language sql stable security definer set search_path = public
as $$
  select a.id, a.nome, a.numero,
         exists (select 1 from public.cond_votos_atleta_mais_condores v where v.eleitor_id = a.id)
    from public.cond_atletas a
   where a.ativo
   order by a.nome
$$;

-- ---------- resultado (só diretoria) ----------
create or replace function public.cond_votacao_resultado()
returns json language plpgsql stable security definer set search_path = public
as $$
declare v json;
begin
  if not public.cond_sou_diretoria() then raise exception 'Só a diretoria pode ver o resultado.'; end if;
  select json_build_object(
    'total_votos', (select count(*) from public.cond_votos_atleta_mais_condores),
    'total_atletas', (select count(*) from public.cond_atletas where ativo),
    'faltam_votar', (select count(*) from public.cond_atletas a where a.ativo
                       and not exists (select 1 from public.cond_votos_atleta_mais_condores v where v.eleitor_id = a.id)),
    'ranking', coalesce((
      select json_agg(r order by r.votos desc, r.nome)
        from (select a.id as atleta_id, a.nome, a.numero, count(*)::int as votos
                from public.cond_votos_atleta_mais_condores v
                join public.cond_atletas a on a.id = v.votado_id
               group by a.id, a.nome, a.numero) r
    ), '[]'::json)
  ) into v;
  return v;
end $$;

revoke all on function public.cond_atleta_ativo(uuid) from public;
revoke all on function public.cond_votacao_atletas() from public;
revoke all on function public.cond_votacao_resultado() from public, anon;
grant execute on function public.cond_atleta_ativo(uuid) to anon, authenticated;
grant execute on function public.cond_votacao_atletas() to anon, authenticated;
grant execute on function public.cond_votacao_resultado() to authenticated;
