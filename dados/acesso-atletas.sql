-- Acesso dos atletas por nome + senha padrão, primeiro acesso e votação só com login.
--
-- Cada atleta ativo ganha uma conta "por trás" (e-mail interno atleta-<id>@atletas.condores.app,
-- que ninguém precisa saber) com a senha padrão guardada em cond_config ('senha_padrao_atletas').
-- A senha padrão NÃO fica neste arquivo (o repositório é público). Para definir/trocar:
--   insert into cond_config (chave, valor) values ('senha_padrao_atletas', '...')
--     on conflict (chave) do update set valor = excluded.valor;
-- (trocar a senha padrão vale para contas criadas/resetadas depois; quem já entrou tem a própria senha)
--
-- No primeiro acesso o atleta cria a própria senha e confirma WhatsApp e aniversário (foto opcional).

alter table public.cond_usuarios add column if not exists trocar_senha boolean not null default false;
alter table public.cond_atletas  add column if not exists cadastro_ok_em timestamptz;

create or replace function public.cond_email_atleta(p_atleta uuid)
returns text language sql immutable
as $$ select 'atleta-' || p_atleta::text || '@atletas.condores.app' $$;

-- cria (se ainda não existir) a conta do atleta com a senha padrão
create or replace function public.cond_criar_acesso_atleta(p_atleta uuid)
returns void language plpgsql security definer set search_path = public, extensions
as $$
declare v_email text := public.cond_email_atleta(p_atleta); v_senha text; v_uid uuid; a record;
begin
  select * into a from public.cond_atletas where id = p_atleta and ativo;
  if not found then return; end if;
  select valor into v_senha from public.cond_config where chave = 'senha_padrao_atletas';
  if v_senha is null then return; end if;

  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
            crypt(v_senha, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(),
            '', '', '', '', '', '', '', '');
    insert into auth.identities (user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (v_uid, v_uid::text, jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
            'email', now(), now());
  end if;

  insert into public.cond_usuarios (email, nome, papel, atleta_id, trocar_senha)
  values (v_email, a.nome, 'atleta', a.id, true)
  on conflict (email) do nothing;
end $$;

-- atleta novo (ou que voltou ao time) já ganha acesso
create or replace function public.cond_atleta_ganha_acesso()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if new.ativo then perform public.cond_criar_acesso_atleta(new.id); end if;
  return new;
end $$;
drop trigger if exists cond_atleta_ganha_acesso on public.cond_atletas;
create trigger cond_atleta_ganha_acesso after insert or update of ativo on public.cond_atletas
  for each row execute function public.cond_atleta_ganha_acesso();

-- lista pública para a tela de login (só nome e número)
create or replace function public.cond_login_atletas()
returns table (id uuid, nome text, numero smallint, email text)
language sql stable security definer set search_path = public
as $$
  select a.id, a.nome, a.numero, u.email
    from public.cond_atletas a
    join public.cond_usuarios u on u.email = public.cond_email_atleta(a.id)
   where a.ativo
   order by a.nome
$$;

-- o atleta avisa que já trocou a senha: o banco confere que ela não é mais a padrão
create or replace function public.cond_senha_trocada()
returns void language plpgsql security definer set search_path = public, extensions
as $$
declare v_senha text; v_hash text;
begin
  select valor into v_senha from public.cond_config where chave = 'senha_padrao_atletas';
  select encrypted_password into v_hash from auth.users where id = auth.uid();
  if v_hash is null then raise exception 'Faça login primeiro.'; end if;
  if v_senha is not null and v_hash = crypt(v_senha, v_hash) then
    raise exception 'A senha nova precisa ser diferente da senha padrão.';
  end if;
  update public.cond_usuarios set trocar_senha = false where email = lower(auth.jwt()->>'email');
end $$;

-- primeiro acesso: o atleta confirma os próprios dados (só a própria ficha)
create or replace function public.cond_completar_cadastro(p_whatsapp text, p_aniv_dia int, p_aniv_mes int, p_foto_url text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_atleta uuid := public.cond_meu_atleta();
begin
  if v_atleta is null then raise exception 'Conta sem atleta.'; end if;
  if coalesce(trim(p_whatsapp), '') = '' then raise exception 'Informe o WhatsApp.'; end if;
  if p_aniv_dia is null or p_aniv_mes is null or p_aniv_dia not between 1 and 31 or p_aniv_mes not between 1 and 12 then
    raise exception 'Aniversário inválido.';
  end if;
  if (select trocar_senha from public.cond_usuarios where email = lower(auth.jwt()->>'email')) then
    raise exception 'Crie sua senha nova primeiro.';
  end if;
  update public.cond_atletas
     set whatsapp = trim(p_whatsapp), aniv_dia = p_aniv_dia, aniv_mes = p_aniv_mes,
         foto_url = coalesce(p_foto_url, foto_url), cadastro_ok_em = now()
   where id = v_atleta;
end $$;

-- diretoria: volta a senha de um atleta para a padrão (esqueceu a senha)
create or replace function public.cond_resetar_senha_atleta(p_atleta uuid)
returns void language plpgsql security definer set search_path = public, extensions
as $$
declare v_senha text; v_email text := public.cond_email_atleta(p_atleta);
begin
  if not public.cond_sou_diretoria() then raise exception 'Só a diretoria pode fazer isso.'; end if;
  select valor into v_senha from public.cond_config where chave = 'senha_padrao_atletas';
  if v_senha is null then raise exception 'Senha padrão não definida.'; end if;
  if not exists (select 1 from auth.users where email = v_email) then
    perform public.cond_criar_acesso_atleta(p_atleta);
  else
    update auth.users set encrypted_password = crypt(v_senha, gen_salt('bf')), updated_at = now() where email = v_email;
    update public.cond_usuarios set trocar_senha = true where email = v_email;
  end if;
end $$;

-- ---------- votação: agora só com login, cada um vota como ele mesmo ----------
delete from public.cond_votos_atleta_mais_condores;   -- votos do link público (decisão da diretoria)
revoke all on public.cond_votos_atleta_mais_condores from anon;
drop policy if exists cond_votos_amc_ver_quem_votou on public.cond_votos_atleta_mais_condores;
create policy cond_votos_amc_ver_quem_votou on public.cond_votos_atleta_mais_condores
  for select to authenticated using (public.cond_sou_usuario());
drop policy if exists cond_votos_amc_votar on public.cond_votos_atleta_mais_condores;
create policy cond_votos_amc_votar on public.cond_votos_atleta_mais_condores
  for insert to authenticated
  with check (eleitor_id = public.cond_meu_atleta() and eleitor_id <> votado_id and public.cond_atleta_ativo(votado_id));
drop function if exists public.cond_votacao_atletas();

-- ---------- fotos dos atletas ----------
insert into storage.buckets (id, name, public) values ('cond-fotos', 'cond-fotos', true)
  on conflict (id) do nothing;
drop policy if exists "cond fotos envia" on storage.objects;
create policy "cond fotos envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'cond-fotos' and ((storage.foldername(name))[1] = public.cond_meu_atleta()::text or public.cond_sou_diretoria()));
drop policy if exists "cond fotos troca" on storage.objects;
create policy "cond fotos troca" on storage.objects for update to authenticated
  using (bucket_id = 'cond-fotos' and ((storage.foldername(name))[1] = public.cond_meu_atleta()::text or public.cond_sou_diretoria()));

-- ---------- permissões das funções ----------
revoke all on function public.cond_criar_acesso_atleta(uuid) from public, anon, authenticated;
revoke all on function public.cond_atleta_ganha_acesso() from public, anon, authenticated;
revoke all on function public.cond_login_atletas() from public;
revoke all on function public.cond_senha_trocada() from public, anon;
revoke all on function public.cond_completar_cadastro(text, int, int, text) from public, anon;
revoke all on function public.cond_resetar_senha_atleta(uuid) from public, anon;
grant execute on function public.cond_login_atletas() to anon, authenticated;
grant execute on function public.cond_senha_trocada() to authenticated;
grant execute on function public.cond_completar_cadastro(text, int, int, text) to authenticated;
grant execute on function public.cond_resetar_senha_atleta(uuid) to authenticated;

-- contas para todos os atletas ativos de hoje
select public.cond_criar_acesso_atleta(id) from public.cond_atletas where ativo;

-- diretoria: consulta a senha padrão (para avisar os atletas)
create or replace function public.cond_senha_padrao()
returns text language plpgsql stable security definer set search_path = public
as $$ begin
  if not public.cond_sou_diretoria() then raise exception 'Só a diretoria pode ver isso.'; end if;
  return (select valor from public.cond_config where chave = 'senha_padrao_atletas');
end $$;
revoke all on function public.cond_senha_padrao() from public, anon;
grant execute on function public.cond_senha_padrao() to authenticated;
