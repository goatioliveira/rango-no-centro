-- Testes das regras de acesso (RLS) e das RPCs.
-- Rode com: npm run test:rls   (precisa de Postgres instalado localmente)
\set ON_ERROR_STOP on
\set QUIET on

create schema test;
grant usage on schema test to anon, authenticated;

create function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FALHOU: %', msg;
  end if;
  raise notice 'ok - %', msg;
end $$;

create function test.falha(cmd text, msg text) returns void language plpgsql as $$
begin
  begin
    execute cmd;
  exception when others then
    raise notice 'ok - % (erro esperado: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FALHOU (deveria dar erro): %', msg;
end $$;

-- Executa um comando e devolve quantas linhas ele afetou.
create function test.linhas(cmd text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute cmd;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema test to anon, authenticated;

create function test.como(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;
grant execute on function test.como(text) to anon, authenticated;

-- Usuários: A (vai ser admin), B (amiga), C (intrusa sem código)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@gmail.com',   '{"full_name":"Ana Carioca","avatar_url":"https://x/a.png"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bia@gmail.com',   '{"name":"Bia"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'caio@gmail.com',  '{}');

select test.ok((select apelido from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Ana Carioca',
               'perfil criado automaticamente com o nome do Google');
select test.ok((select apelido from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') = 'caio',
               'sem nome no Google, apelido vem do e-mail');

-- Um restaurante criado "por fora" para ver se não-membros enxergam.
insert into public.restaurants (id, nome, lat, lng, criado_por)
values ('11111111-0000-0000-0000-000000000001', 'Bar Luiz', -22.9045, -43.1779, null);

-- ------------------------------------------------------------------ anon
set role anon;
select test.falha('select * from public.restaurants', 'anônimo não lê restaurantes');
select test.falha('select * from public.profiles', 'anônimo não lê perfis');
select test.falha('select public.join_group(''primeiro-rango'')', 'anônimo não chama join_group');
reset role;

-- ------------------------------------------------------------------ A antes de entrar
set role authenticated;
select test.como('aaaaaaaa-0000-0000-0000-000000000001');
select test.ok((select count(*) from public.restaurants) = 0, 'não-membro não vê restaurantes');
select test.ok((select count(*) from public.restaurants_with_stats) = 0, 'não-membro não vê a view de estatísticas');
select test.ok((select count(*) from public.profiles) = 1, 'não-membro só vê o próprio perfil');
select test.falha('select * from public.app_config', 'ninguém lê o código de convite direto');
select test.falha('update public.profiles set is_member = true where id = auth.uid()', 'não dá pra se autopromover a membro');
select test.falha('update public.profiles set is_admin = true where id = auth.uid()', 'não dá pra se autopromover a admin');
select test.falha($$insert into public.restaurants (nome, lat, lng, criado_por) values ('X', -22.9, -43.17, auth.uid())$$,
                  'não-membro não cria restaurante');
select test.ok(public.join_group('codigo-errado') = false, 'código errado é recusado');
select test.ok(public.join_group('  PRIMEIRO-RANGO ') = true, 'código certo (sem diferenciar maiúsculas/espaços) é aceito');
select test.ok((select is_admin from public.profiles where id = auth.uid()), 'primeiro membro vira admin');
select test.ok((select count(*) from public.restaurants) = 1, 'membro passa a ver os restaurantes');
select test.ok(public.admin_get_invite_code() = 'primeiro-rango', 'admin consegue ver o código');
select test.ok((select count(*) from public.profiles) = 3, 'membro vê todos os perfis');
select test.ok(test.linhas($$update public.profiles set apelido = 'Aninha', apelido_definido = true where id = auth.uid()$$) = 1,
               'membro troca o próprio apelido');
select test.ok(test.linhas($$update public.profiles set apelido = 'Hackeado' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$) = 0,
               'não dá pra trocar o apelido dos outros');

insert into public.restaurants (id, nome, lat, lng, tags, faixa_preco, criado_por)
values ('22222222-0000-0000-0000-000000000002', 'Cosmopolita', -22.9130, -43.1790, '{boteco}', 2, auth.uid());
insert into public.reviews (restaurant_id, user_id, nota_geral, preco_pago, data_visita)
values ('22222222-0000-0000-0000-000000000002', auth.uid(), 8, 50, current_date - 10);
insert into public.reviews (id, restaurant_id, user_id, nota_geral, preco_pago, data_visita)
values ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', auth.uid(), 6, 40, current_date - 1);
select test.falha($$insert into public.reviews (restaurant_id, user_id, nota_geral) values ('22222222-0000-0000-0000-000000000002', auth.uid(), 7.3)$$,
                  'nota só aceita meio ponto');
select test.falha($$insert into public.reviews (restaurant_id, user_id, nota_geral) values ('22222222-0000-0000-0000-000000000002', auth.uid(), 11)$$,
                  'nota não passa de 10');
insert into public.wishlist (restaurant_id) values ('11111111-0000-0000-0000-000000000001');
reset role;

-- ------------------------------------------------------------------ C (sem código) continua de fora
set role authenticated;
select test.como('cccccccc-0000-0000-0000-000000000003');
select test.ok((select count(*) from public.reviews) = 0, 'não-membro não vê avaliações');
select test.ok((select count(*) from public.wishlist) = 0, 'não-membro não vê o quero ir');
select test.ok(test.linhas('delete from public.reviews') = 0, 'não-membro não apaga avaliações');
select test.falha('select public.admin_get_invite_code()', 'não-admin não vê o código');
reset role;

-- ------------------------------------------------------------------ B entra e avalia
set role authenticated;
select test.como('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok(public.join_group('primeiro-rango'), 'segunda pessoa entra com o código');
select test.ok(not (select is_admin from public.profiles where id = auth.uid()), 'segunda pessoa não é admin');
insert into public.reviews (restaurant_id, user_id, nota_geral, preco_pago)
values ('22222222-0000-0000-0000-000000000002', auth.uid(), 9, 60);
select test.falha($$insert into public.reviews (restaurant_id, user_id, nota_geral) values ('22222222-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 1)$$,
                  'não dá pra avaliar em nome de outra pessoa');
select test.ok(test.linhas($$update public.reviews set nota_geral = 0 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 0,
               'não dá pra editar avaliação dos outros');
select test.ok(test.linhas($$delete from public.reviews where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$) = 0,
               'não dá pra apagar avaliação dos outros');
select test.ok(test.linhas($$update public.reviews set comentario = 'Chopp gelado' where user_id = auth.uid()$$) = 1,
               'edita a própria avaliação');
select test.falha($$update public.reviews set user_id = 'aaaaaaaa-0000-0000-0000-000000000001' where user_id = auth.uid()$$,
                  'não dá pra trocar o autor da avaliação');
select test.falha($$update public.restaurants set criado_por = auth.uid()$$, 'não dá pra trocar quem criou o restaurante');
select test.ok(test.linhas($$update public.restaurants set tags = '{boteco,"aceita VR/VA"}' where nome = 'Cosmopolita'$$) = 1,
               'qualquer membro corrige as tags do restaurante');
select test.ok(test.linhas($$delete from public.restaurants where nome = 'Cosmopolita'$$) = 0,
               'membro não apaga restaurante criado por outra pessoa');
select test.falha('select public.admin_remove_member(''aaaaaaaa-0000-0000-0000-000000000001'')', 'não-admin não remove membros');
select test.falha('select public.admin_set_invite_code(''hack'')', 'não-admin não troca o código');

-- Estatísticas: média usa a avaliação mais recente de cada pessoa (A: 6, B: 9 => 7.5)
select test.ok((select media from public.restaurants_with_stats where nome = 'Cosmopolita') = 7.5,
               'média usa só a avaliação mais recente de cada pessoa');
select test.ok((select num_avaliadores from public.restaurants_with_stats where nome = 'Cosmopolita') = 2, 'conta 2 avaliadores');
select test.ok((select num_avaliacoes from public.restaurants_with_stats where nome = 'Cosmopolita') = 3, 'conta 3 avaliações');
select test.ok((select preco_medio from public.restaurants_with_stats where nome = 'Cosmopolita') = 50, 'preço médio = 50');
select test.ok((select eu_fui from public.restaurants_with_stats where nome = 'Cosmopolita'), 'eu_fui = true para quem avaliou');
select test.ok(not (select eu_quero from public.restaurants_with_stats where nome = 'Bar Luiz'), 'eu_quero é por pessoa');
select test.ok((select num_quero_ir from public.restaurants_with_stats where nome = 'Bar Luiz') = 1, 'conta quem quer ir');

-- Fotos: só na própria avaliação e na própria pasta
select test.falha($$insert into public.review_photos (review_id, user_id, path) values ('33333333-0000-0000-0000-000000000003', auth.uid(), auth.uid() || '/x/1.jpg')$$,
                  'não dá pra anexar foto na avaliação dos outros');
select test.falha($$insert into storage.objects (bucket_id, name) values ('fotos', 'aaaaaaaa-0000-0000-0000-000000000001/x/1.jpg')$$,
                  'não dá pra enviar arquivo na pasta dos outros');
insert into storage.objects (bucket_id, name) values ('fotos', 'bbbbbbbb-0000-0000-0000-000000000002/x/1.jpg');
select test.ok(true, 'envia arquivo na própria pasta');
reset role;

-- ------------------------------------------------------------------ admin remove B
set role authenticated;
select test.como('aaaaaaaa-0000-0000-0000-000000000001');
select test.falha('select public.admin_remove_member(auth.uid())', 'admin não remove a si mesmo');
select public.admin_remove_member('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok(test.linhas($$delete from public.reviews where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$) = 1,
               'admin pode apagar avaliação de qualquer um');
select public.admin_set_invite_code('novo-codigo');
select test.ok(public.admin_get_invite_code() = 'novo-codigo', 'admin troca o código');
reset role;

set role authenticated;
select test.como('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select count(*) from public.restaurants) = 0, 'membro removido perde o acesso');
select test.falha('select public.join_group(''novo-codigo'')', 'membro removido não volta nem com o código novo');
reset role;

-- ------------------------------------------------------------------ força bruta no código
set role authenticated;
select test.como('cccccccc-0000-0000-0000-000000000003');
select public.join_group('chute-' || g) from generate_series(1, 10) g;
select test.falha('select public.join_group(''novo-codigo'')', 'depois de 10 tentativas erradas o código é travado');
reset role;

\o
\echo 'TODOS OS TESTES DE RLS PASSARAM'
