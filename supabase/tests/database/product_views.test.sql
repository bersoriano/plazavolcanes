begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_table('private', 'product_view_days', 'views are counted in a private table');
select has_function('public', 'record_product_view', 'anyone can count a visit');
select has_function('public', 'shop_product_stats', 'an owner can read their stats');

insert into auth.users (id, email, created_at) values
  ('50000000-0000-4000-8000-000000000001', 'owner-views@test.local', now()),
  ('50000000-0000-4000-8000-000000000002', 'buyer-views@test.local', now());

insert into public.shops (id, owner_id, name, slug, description)
overriding system value values
  (9401, '50000000-0000-4000-8000-000000000001', 'Vistas', 'tienda-vistas', 'Descripción suficientemente larga para la tienda.');
update public.shops set is_publishing_approved = true where id = 9401;

alter table public.products disable trigger enforce_product_cover_on_publish;
insert into public.products (id, shop_id, name, slug, description, price_mxn, status, is_admin_enabled, category_id)
overriding system value values
  (94011, 9401, 'Publicado', 'vistas-publicado', 'Descripción suficientemente larga para el artículo.', 100, 'published', true,
    (select id from public.categories where slug = 'celulares-y-accesorios')),
  (94012, 9401, 'Borrador', 'vistas-borrador', 'Descripción suficientemente larga para el artículo.', 100, 'draft', true,
    (select id from public.categories where slug = 'celulares-y-accesorios'));
-- The moderation defaults only apply to client roles, but make sure.
update public.products set status = 'published' where id = 94011;

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select public.record_product_view(94011);
select public.record_product_view(94011);
select public.record_product_view(94012);
select throws_ok('select * from private.product_view_days', '42501', null, 'visitors cannot read the counts');
select throws_ok('select * from public.shop_product_stats(9401)', '42501', null, 'nor the stats');

set local role authenticated;
set local request.jwt.claims = '{"sub": "50000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.record_product_view(94011);

select is(
  (select views from public.shop_product_stats(9401) where product_id = 94011),
  2::bigint,
  'two visits counted; the owner''s own visit is not'
);
select is(
  (select views from public.shop_product_stats(9401) where product_id = 94012),
  0::bigint,
  'a draft is never counted'
);

set local request.jwt.claims = '{"sub": "50000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok('select * from public.shop_product_stats(9401)', '42501', null, 'another user cannot read the stats');
select lives_ok('select public.record_product_view(94011)', 'a signed-in buyer can count a visit');

reset role;
select * from finish();
rollback;
