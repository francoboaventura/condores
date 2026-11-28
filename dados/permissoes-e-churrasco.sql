-- Permissões da diretoria x atletas, confirmações abertas/fechadas, escalação liberada e lista do churrasco.
--
-- Diretoria: tudo. Abre e fecha as confirmações da rodada, escala e libera a escalação para os atletas,
-- abre a lista de presença do churrasco e promove atletas à diretoria.
-- Atleta: confirma a própria presença só com as confirmações abertas; vê a escalação da rodada só depois
-- de liberada (rodadas encerradas ele sempre vê); marca a própria presença no churrasco só com a lista aberta.
-- As travas estão no banco (regras de acesso), não só na tela.

-- ---------- rodada: confirmações abertas e escalação liberada ----------
alter table public.cond_rodadas add column if not exists confirmacoes_abertas boolean not null default false;
alter table public.cond_rodadas add column if not exists escalacao_liberada  boolean not null default false;

create or replace function public.cond_confirmacoes_abertas(p_rodada uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select confirmacoes_abertas and status <> 'encerrada' from public.cond_rodadas where id = p_rodada), false) $$;

create or replace function public.cond_escalacao_visivel(p_rodada uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select escalacao_liberada or status = 'encerrada' from public.cond_rodadas where id = p_rodada), false) $$;

drop policy if exists cond_confirmacoes_escrever on public.cond_confirmacoes;
create policy cond_confirmacoes_escrever on public.cond_confirmacoes for all to authenticated
  using      (public.cond_sou_diretoria() or (atleta_id = public.cond_meu_atleta() and public.cond_confirmacoes_abertas(rodada_id)))
  with check (public.cond_sou_diretoria() or (atleta_id = public.cond_meu_atleta() and public.cond_confirmacoes_abertas(rodada_id)));

drop policy if exists cond_escalacoes_ler on public.cond_escalacoes;
create policy cond_escalacoes_ler on public.cond_escalacoes for select to authenticated
  using (public.cond_sou_diretoria() or (public.cond_sou_usuario() and public.cond_escalacao_visivel(rodada_id)));

-- ---------- churrasco (lista de presença de evento) ----------
create table if not exists public.cond_eventos (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null default 'churrasco',
  titulo    text not null,
  data      date not null,
  aberta    boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists public.cond_evento_presencas (
  evento_id uuid not null references public.cond_eventos(id) on delete cascade,
  atleta_id uuid not null references public.cond_atletas(id),
  status    text not null check (status in ('S', 'N')),
  criado_em timestamptz not null default now(),
  primary key (evento_id, atleta_id)
);

create or replace function public.cond_evento_aberto(p_evento uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select aberta from public.cond_eventos where id = p_evento), false) $$;

alter table public.cond_eventos enable row level security;
alter table public.cond_evento_presencas enable row level security;
revoke all on public.cond_eventos, public.cond_evento_presencas from public, anon, authenticated;
grant select, insert, update, delete on public.cond_eventos, public.cond_evento_presencas to authenticated;
grant all on public.cond_eventos, public.cond_evento_presencas to service_role;

drop policy if exists cond_eventos_ler on public.cond_eventos;
create policy cond_eventos_ler on public.cond_eventos for select to authenticated using (public.cond_sou_usuario());
drop policy if exists cond_eventos_diretoria on public.cond_eventos;
create policy cond_eventos_diretoria on public.cond_eventos for all to authenticated
  using (public.cond_sou_diretoria()) with check (public.cond_sou_diretoria());

drop policy if exists cond_evento_presencas_ler on public.cond_evento_presencas;
create policy cond_evento_presencas_ler on public.cond_evento_presencas for select to authenticated using (public.cond_sou_usuario());
drop policy if exists cond_evento_presencas_escrever on public.cond_evento_presencas;
create policy cond_evento_presencas_escrever on public.cond_evento_presencas for all to authenticated
  using      (public.cond_sou_diretoria() or (atleta_id = public.cond_meu_atleta() and public.cond_evento_aberto(evento_id)))
  with check (public.cond_sou_diretoria() or (atleta_id = public.cond_meu_atleta() and public.cond_evento_aberto(evento_id)));

-- ---------- diretoria promove (ou tira) atleta da diretoria ----------
-- vale para a conta de entrada por nome do atleta; ninguém tira a si mesmo da diretoria
create or replace function public.cond_definir_papel(p_atleta uuid, p_papel text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.cond_sou_diretoria() then raise exception 'Só a diretoria pode fazer isso.'; end if;
  if p_papel not in ('diretor', 'atleta') then raise exception 'Papel inválido.'; end if;
  if p_papel = 'atleta' and p_atleta = public.cond_meu_atleta() then
    raise exception 'Você não pode tirar a si mesmo da diretoria.';
  end if;
  update public.cond_usuarios set papel = p_papel where email = public.cond_email_atleta(p_atleta);
  if not found then raise exception 'Esse atleta ainda não tem acesso ao app.'; end if;
end $$;

-- diretoria: quem é diretoria (para o menu do atleta)
create or replace function public.cond_papeis()
returns table (atleta_id uuid, papel text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.cond_sou_diretoria() then raise exception 'Só a diretoria pode ver isso.'; end if;
  return query select u.atleta_id, u.papel from public.cond_usuarios u
                where u.atleta_id is not null and u.email = public.cond_email_atleta(u.atleta_id);
end $$;

revoke all on function public.cond_confirmacoes_abertas(uuid) from public, anon;
revoke all on function public.cond_escalacao_visivel(uuid) from public, anon;
revoke all on function public.cond_evento_aberto(uuid) from public, anon;
revoke all on function public.cond_definir_papel(uuid, text) from public, anon;
revoke all on function public.cond_papeis() from public, anon;
grant execute on function public.cond_confirmacoes_abertas(uuid) to authenticated;
grant execute on function public.cond_escalacao_visivel(uuid) to authenticated;
grant execute on function public.cond_evento_aberto(uuid) to authenticated;
grant execute on function public.cond_definir_papel(uuid, text) to authenticated;
grant execute on function public.cond_papeis() to authenticated;

notify pgrst, 'reload schema';
