-- =====================================================================
-- Rango no Centro — esquema principal
-- Tabelas, funções auxiliares, RPCs, políticas RLS, índices e realtime.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  apelido            text not null check (char_length(btrim(apelido)) between 1 and 40),
  avatar_url         text,
  google_avatar_url  text,
  apelido_definido   boolean not null default false,
  is_member          boolean not null default false,
  is_admin           boolean not null default false,
  is_blocked         boolean not null default false,
  convite_tentativas integer not null default 0,
  joined_at          timestamptz,
  created_at         timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém faz login pela primeira vez.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome   text;
  v_avatar text;
begin
  v_nome := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Comensal'
  );
  v_avatar := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');

  insert into public.profiles (id, apelido, avatar_url, google_avatar_url)
  values (new.id, left(v_nome, 40), v_avatar, v_avatar)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Configuração privada (código de convite). Ninguém lê pelo cliente.
-- ---------------------------------------------------------------------
create table public.app_config (
  id          integer primary key default 1 check (id = 1),
  invite_code text not null check (char_length(invite_code) between 4 and 64),
  updated_at  timestamptz not null default now()
);

-- Código inicial. Troque pela tela de admin depois do primeiro login.
insert into public.app_config (id, invite_code) values (1, 'primeiro-rango');

-- ---------------------------------------------------------------------
-- Funções auxiliares usadas nas políticas
-- ---------------------------------------------------------------------
create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_member and not p.is_blocked from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_member and p.is_admin and not p.is_blocked from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Tags de categoria
-- ---------------------------------------------------------------------
create table public.tags (
  nome       text primary key check (char_length(btrim(nome)) between 1 and 30),
  criado_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

insert into public.tags (nome, criado_por) values
  ('PF/prato feito', null),
  ('self-service/quilo', null),
  ('à la carte', null),
  ('lanchonete', null),
  ('boteco', null),
  ('japonês', null),
  ('árabe', null),
  ('italiano', null),
  ('vegetariano', null),
  ('rodízio', null),
  ('café', null),
  ('doce/sobremesa', null),
  ('abre fim de semana', null),
  ('aceita VR/VA', null);

-- ---------------------------------------------------------------------
-- Restaurantes
-- ---------------------------------------------------------------------
create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(btrim(nome)) between 1 and 120),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  endereco    text check (char_length(endereco) <= 300),
  tags        text[] not null default '{}' check (cardinality(tags) <= 20),
  faixa_preco smallint check (faixa_preco between 1 and 4),
  criado_por  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index restaurants_created_at_idx on public.restaurants (created_at desc);
create index restaurants_lat_lng_idx on public.restaurants (lat, lng);

-- ---------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------
create function public.is_half_step(n numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$ select n is null or (n between 0 and 10 and n * 2 = floor(n * 2)) $$;

create table public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  restaurant_id        uuid not null references public.restaurants (id) on delete cascade,
  user_id              uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  nota_geral           numeric(3,1) not null check (public.is_half_step(nota_geral)),
  nota_comida          numeric(3,1) check (public.is_half_step(nota_comida)),
  nota_atendimento     numeric(3,1) check (public.is_half_step(nota_atendimento)),
  nota_custo_beneficio numeric(3,1) check (public.is_half_step(nota_custo_beneficio)),
  preco_pago           numeric(8,2) check (preco_pago >= 0 and preco_pago < 100000),
  o_que_pediu          text check (char_length(o_que_pediu) <= 500),
  pontos_positivos     text check (char_length(pontos_positivos) <= 1000),
  pontos_negativos     text check (char_length(pontos_negativos) <= 1000),
  comentario           text check (char_length(comentario) <= 2000),
  data_visita          date not null default current_date,
  voltaria             text check (voltaria in ('sim', 'nao', 'talvez')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index reviews_restaurant_idx on public.reviews (restaurant_id);
create index reviews_user_idx on public.reviews (user_id);
create index reviews_created_at_idx on public.reviews (created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Lista "quero ir"
-- ---------------------------------------------------------------------
create table public.wishlist (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create index wishlist_user_idx on public.wishlist (user_id);

-- ---------------------------------------------------------------------
-- View com as estatísticas de cada restaurante.
-- A média usa só a avaliação MAIS RECENTE de cada pessoa.
-- security_invoker = true => respeita o RLS de quem consulta.
-- ---------------------------------------------------------------------
create view public.restaurants_with_stats
with (security_invoker = true)
as
with latest as (
  select distinct on (rv.restaurant_id, rv.user_id)
    rv.restaurant_id, rv.user_id, rv.nota_geral, rv.preco_pago
  from public.reviews rv
  order by rv.restaurant_id, rv.user_id, rv.data_visita desc, rv.created_at desc
),
agg as (
  select
    l.restaurant_id,
    round(avg(l.nota_geral), 1)  as media,
    count(*)::int                as num_avaliadores,
    round(avg(l.preco_pago), 2)  as preco_medio
  from latest l
  group by l.restaurant_id
),
visitas as (
  select rv.restaurant_id, count(*)::int as num_avaliacoes, max(rv.data_visita) as ultima_visita,
         bool_or(rv.user_id = auth.uid()) as eu_fui
  from public.reviews rv
  group by rv.restaurant_id
),
desejos as (
  select w.restaurant_id, count(*)::int as num_quero_ir, bool_or(w.user_id = auth.uid()) as eu_quero
  from public.wishlist w
  group by w.restaurant_id
)
select
  r.id, r.nome, r.lat, r.lng, r.endereco, r.tags, r.faixa_preco, r.criado_por, r.created_at,
  a.media,
  coalesce(a.num_avaliadores, 0)  as num_avaliadores,
  coalesce(v.num_avaliacoes, 0)   as num_avaliacoes,
  a.preco_medio,
  v.ultima_visita,
  coalesce(v.eu_fui, false)       as eu_fui,
  coalesce(d.num_quero_ir, 0)     as num_quero_ir,
  coalesce(d.eu_quero, false)     as eu_quero
from public.restaurants r
left join agg a     on a.restaurant_id = r.id
left join visitas v on v.restaurant_id = r.id
left join desejos d on d.restaurant_id = r.id;

-- ---------------------------------------------------------------------
-- RPCs (security definer: rodam com privilégio, mas checam quem chama)
-- ---------------------------------------------------------------------

-- Entrar no grupo com o código de convite.
create function public.join_group(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles;
  v_code    text;
  v_first   boolean;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  -- Serializa entradas simultâneas (garante um único "primeiro admin").
  perform pg_advisory_xact_lock(hashtext('rango_join_group'));

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'perfil_inexistente' using errcode = 'P0002';
  end if;
  if v_profile.is_blocked then
    raise exception 'bloqueado' using errcode = '42501';
  end if;
  if v_profile.is_member then
    return true;
  end if;
  if v_profile.convite_tentativas >= 10 then
    raise exception 'muitas_tentativas' using errcode = '42501';
  end if;

  select invite_code into v_code from public.app_config where id = 1;
  if v_code is null or lower(btrim(coalesce(p_code, ''))) <> lower(btrim(v_code)) then
    update public.profiles set convite_tentativas = convite_tentativas + 1 where id = v_uid;
    return false;
  end if;

  select not exists (select 1 from public.profiles where is_member) into v_first;

  update public.profiles
     set is_member = true,
         is_admin = is_admin or v_first,
         joined_at = now(),
         convite_tentativas = 0
   where id = v_uid;

  return true;
end;
$$;

create function public.admin_get_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas_admin' using errcode = '42501';
  end if;
  return (select invite_code from public.app_config where id = 1);
end;
$$;

create function public.admin_set_invite_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas_admin' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_code, ''))) < 4 then
    raise exception 'codigo_curto' using errcode = '22023';
  end if;
  update public.app_config set invite_code = btrim(p_code), updated_at = now() where id = 1;
end;
$$;

-- Remove (e bloqueia) um membro. As avaliações dele continuam no mapa.
create function public.admin_remove_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas_admin' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'nao_pode_remover_a_si_mesmo' using errcode = '22023';
  end if;
  update public.profiles
     set is_member = false, is_admin = false, is_blocked = true
   where id = p_user;
end;
$$;

-- Desbloqueia: a pessoa poderá entrar de novo usando o código atual.
create function public.admin_unblock_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas_admin' using errcode = '42501';
  end if;
  update public.profiles set is_blocked = false, convite_tentativas = 0 where id = p_user;
end;
$$;

create function public.admin_set_admin(p_user uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas_admin' using errcode = '42501';
  end if;
  if p_user = auth.uid() and not p_admin then
    raise exception 'nao_pode_tirar_o_proprio_admin' using errcode = '22023';
  end if;
  update public.profiles set is_admin = p_admin where id = p_user and is_member;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões (explícitas; anon não acessa nada)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.profiles to authenticated;
-- Cada pessoa só pode alterar estes campos do próprio perfil:
grant update (apelido, avatar_url, apelido_definido) on public.profiles to authenticated;

grant select, insert on public.tags to authenticated;
grant select, insert, delete on public.restaurants to authenticated;
grant update (nome, lat, lng, endereco, tags, faixa_preco) on public.restaurants to authenticated;
grant select, insert, delete on public.reviews to authenticated;
grant update (nota_geral, nota_comida, nota_atendimento, nota_custo_beneficio, preco_pago,
              o_que_pediu, pontos_positivos, pontos_negativos, comentario, data_visita, voltaria)
  on public.reviews to authenticated;
grant select, insert, delete on public.wishlist to authenticated;
grant select on public.restaurants_with_stats to authenticated;

grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_half_step(numeric) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.admin_get_invite_code() to authenticated;
grant execute on function public.admin_set_invite_code(text) to authenticated;
grant execute on function public.admin_remove_member(uuid) to authenticated;
grant execute on function public.admin_unblock_member(uuid) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.app_config  enable row level security;  -- sem políticas: ninguém acessa pelo cliente
alter table public.tags        enable row level security;
alter table public.restaurants enable row level security;
alter table public.reviews     enable row level security;
alter table public.wishlist    enable row level security;

-- profiles
create policy "perfil: ver o próprio ou, se membro, todos"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_member());

create policy "perfil: editar o próprio"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- tags
create policy "tags: membros leem"
  on public.tags for select to authenticated
  using (public.is_member());

create policy "tags: membros criam"
  on public.tags for insert to authenticated
  with check (public.is_member() and criado_por = auth.uid());

-- restaurants
create policy "restaurantes: membros leem"
  on public.restaurants for select to authenticated
  using (public.is_member());

create policy "restaurantes: membros criam"
  on public.restaurants for insert to authenticated
  with check (public.is_member() and criado_por = auth.uid());

-- Qualquer membro pode corrigir nome/endereço/tags/preço (é um guia coletivo).
create policy "restaurantes: membros editam"
  on public.restaurants for update to authenticated
  using (public.is_member())
  with check (public.is_member());

create policy "restaurantes: quem criou ou admin apaga"
  on public.restaurants for delete to authenticated
  using (public.is_admin() or (public.is_member() and criado_por = auth.uid()));

-- reviews
create policy "avaliações: membros leem"
  on public.reviews for select to authenticated
  using (public.is_member());

create policy "avaliações: membros criam as próprias"
  on public.reviews for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

create policy "avaliações: editar as próprias"
  on public.reviews for update to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (public.is_member() and user_id = auth.uid());

create policy "avaliações: apagar as próprias ou admin"
  on public.reviews for delete to authenticated
  using (public.is_admin() or (public.is_member() and user_id = auth.uid()));

-- wishlist
create policy "quero ir: membros leem"
  on public.wishlist for select to authenticated
  using (public.is_member());

create policy "quero ir: membros marcam o próprio"
  on public.wishlist for insert to authenticated
  with check (public.is_member() and user_id = auth.uid());

create policy "quero ir: desmarcar o próprio ou admin"
  on public.wishlist for delete to authenticated
  using (public.is_admin() or (public.is_member() and user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Realtime: avisa os clientes quando algo muda nestas tabelas.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.restaurants, public.reviews, public.wishlist, public.profiles;
  end if;
end;
$$;
