begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select has_table('public', 'shops', 'shops table exists');
select has_table('public', 'products', 'products table exists');
select has_table('public', 'user_trust_profiles', 'user trust profiles table exists');
select has_column('public', 'user_trust_profiles', 'user_id', 'trust profiles identify auth users');
select has_column('public', 'user_trust_profiles', 'joined_on', 'trust profiles preserve account creation date');
select has_column('public', 'user_trust_profiles', 'verification_level', 'trust profiles track verification level');
select has_column('public', 'products', 'condition', 'products have condition');
select has_column('public', 'products', 'used_condition', 'products have used condition detail');
select has_column('public', 'shops', 'country_code', 'shops have a country code');
select has_column('public', 'shops', 'administrative_area_codes', 'shops have administrative area codes');

insert into auth.users (id, email, created_at) values
  ('123e4567-e89b-12d3-a456-426614174000', 'seller-a@test.local', '2024-02-29 12:30:00+00'),
  ('987fcdeb-51a2-43d7-9012-345678901234', 'seller-b@test.local', '2026-08-20 08:15:00+00');

select results_eq(
  'select count(*) from public.user_trust_profiles',
  array[2::bigint],
  'auth registration creates one trust profile per user'
);

select results_eq(
  $$select count(*) from public.user_trust_profiles where verification_level = 'unverified'$$,
  array[2::bigint],
  'new trust profiles start unverified'
);

select results_eq(
  $$select count(*) from public.user_trust_profiles p join auth.users u on u.id = p.user_id where p.joined_on = u.created_at::date$$,
  array[2::bigint],
  'trust profiles preserve auth account creation dates'
);

insert into public.shops (owner_id, name, slug, description) values
  ('123e4567-e89b-12d3-a456-426614174000', 'Tienda A', 'tienda-a', 'Descripción completa para la tienda A.'),
  ('987fcdeb-51a2-43d7-9012-345678901234', 'Tienda B', 'tienda-b', 'Descripción completa para la tienda B.');

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer-without-shop@test.local', '2026-08-20 09:00:00+00');

select results_eq(
  $$select distinct country_code from public.shops$$,
  array['MX'::text],
  'existing shop inserts default to Mexico'
);

select throws_ok(
  $$insert into public.shops (owner_id, name, slug, description, country_code) values ('123e4567-e89b-12d3-a456-426614174000', 'País inválido', 'pais-invalido', 'Descripción completa para la tienda inválida.', 'mx')$$,
  '23514',
  null,
  'country code must use uppercase ISO format'
);

select throws_ok(
  $$insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values ('123e4567-e89b-12d3-a456-426614174000', 'Estado inválido', 'estado-invalido', 'Descripción completa para la tienda inválida.', 'MX', array['US-CA'])$$,
  '23514',
  null,
  'administrative area must belong to shop country'
);

select throws_ok(
  $$insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values ('123e4567-e89b-12d3-a456-426614174000', 'Tres estados', 'tres-estados', 'Descripción completa para la tienda inválida.', 'MX', array['MX-JAL', 'MX-COL', 'MX-OAX'])$$,
  '23514',
  null,
  'a shop may store at most two administrative areas'
);

select throws_ok(
  $$insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values ('123e4567-e89b-12d3-a456-426614174000', 'Estado repetido', 'estado-repetido', 'Descripción completa para la tienda inválida.', 'MX', array['MX-JAL', 'MX-JAL'])$$,
  '23514',
  null,
  'a shop may not repeat an administrative area'
);

select lives_ok(
  $$insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values ('123e4567-e89b-12d3-a456-426614174000', 'Dos estados', 'dos-estados', 'Descripción completa para la tienda válida.', 'MX', array['MX-JAL', 'MX-COL'])$$,
  'a shop may store two administrative areas of its country'
);

insert into public.products (shop_id, name, description, price_mxn, status, category_id) values
  ((select id from public.shops where slug = 'tienda-a'), 'Borrador A', 'Descripción completa del borrador A.', 100, 'draft', null),
  ((select id from public.shops where slug = 'tienda-b'), 'Publicado B', 'Descripción completa del producto B.', 200, 'published', (select id from public.categories where slug = 'celulares-y-accesorios')),
  ((select id from public.shops where slug = 'tienda-b'), 'Borrador B', 'Descripción completa del borrador B.', 300, 'draft', null);

set local role anon;

select results_eq(
  'select count(*) from public.user_trust_profiles',
  array[2::bigint],
  'anonymous visitors only see trust profiles attached to public shops'
);

select throws_ok(
  $$update public.user_trust_profiles set verification_level = 'verified'$$,
  '42501',
  null,
  'anonymous visitors cannot change trust profiles'
);

select results_eq(
  'select count(*) from public.products',
  array[1::bigint],
  'anonymous visitors see only published products'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '123e4567-e89b-12d3-a456-426614174000';

select throws_ok(
  $$update public.user_trust_profiles set verification_level = 'verified' where user_id = '123e4567-e89b-12d3-a456-426614174000'$$,
  '42501',
  null,
  'sellers cannot change their own trust profile'
);

select results_eq(
  'select count(*) from public.products',
  array[2::bigint],
  'seller A sees own draft and public product, not seller B draft'
);

select results_eq(
  $$update public.shops set name = 'Hack' where slug = 'tienda-b' returning id$$,
  $$select id from public.shops where false$$,
  'seller A cannot update seller B shop'
);

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn) values ((select id from public.shops where slug = 'tienda-b'), 'Producto ajeno', 'Descripción completa del producto ajeno.', 99)$$,
  '42501',
  null,
  'seller A cannot add product to seller B shop'
);

select lives_ok(
  $$insert into public.products (shop_id, name, description, price_mxn) values ((select id from public.shops where slug = 'tienda-a'), 'Producto propio', 'Descripción completa del producto propio.', 99)$$,
  'seller A can add product to owned shop'
);

select results_eq(
  $$delete from public.products where name = 'Borrador B' returning id$$,
  $$select id from public.products where false$$,
  'seller A cannot delete seller B draft'
);

select lives_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, condition, used_condition) values ((select id from public.shops where slug = 'tienda-a'), 'Usado válido', 'Descripción completa del producto usado válido.', 150, 'used', 'mint')$$,
  'used product accepts a valid subcondition'
);

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, condition) values ((select id from public.shops where slug = 'tienda-a'), 'Usado incompleto', 'Descripción completa del producto usado incompleto.', 150, 'used')$$,
  '23514',
  null,
  'used product requires a subcondition'
);

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, condition, used_condition) values ((select id from public.shops where slug = 'tienda-a'), 'Nuevo inválido', 'Descripción completa del producto nuevo inválido.', 150, 'new', 'good')$$,
  '23514',
  null,
  'new product rejects a used subcondition'
);

select * from finish();
rollback;
