begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_table('public', 'shops', 'shops table exists');
select has_table('public', 'products', 'products table exists');
select has_column('public', 'products', 'condition', 'products have condition');
select has_column('public', 'products', 'used_condition', 'products have used condition detail');

insert into auth.users (id, email) values
  ('123e4567-e89b-12d3-a456-426614174000', 'seller-a@test.local'),
  ('987fcdeb-51a2-43d7-9012-345678901234', 'seller-b@test.local');

insert into public.shops (owner_id, name, slug, description) values
  ('123e4567-e89b-12d3-a456-426614174000', 'Tienda A', 'tienda-a', 'Descripción completa para la tienda A.'),
  ('987fcdeb-51a2-43d7-9012-345678901234', 'Tienda B', 'tienda-b', 'Descripción completa para la tienda B.');

insert into public.products (shop_id, name, description, price_mxn, status) values
  (1, 'Borrador A', 'Descripción completa del borrador A.', 100, 'draft'),
  (2, 'Publicado B', 'Descripción completa del producto B.', 200, 'published'),
  (2, 'Borrador B', 'Descripción completa del borrador B.', 300, 'draft');

set local role anon;

select results_eq(
  'select count(*) from public.products',
  array[1::bigint],
  'anonymous visitors see only published products'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '123e4567-e89b-12d3-a456-426614174000';

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
  $$insert into public.products (shop_id, name, description, price_mxn) values (2, 'Producto ajeno', 'Descripción completa del producto ajeno.', 99)$$,
  '42501',
  null,
  'seller A cannot add product to seller B shop'
);

select lives_ok(
  $$insert into public.products (shop_id, name, description, price_mxn) values (1, 'Producto propio', 'Descripción completa del producto propio.', 99)$$,
  'seller A can add product to owned shop'
);

select results_eq(
  $$delete from public.products where id = 3 returning id$$,
  $$select id from public.products where false$$,
  'seller A cannot delete seller B draft'
);

select lives_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, condition, used_condition) values (1, 'Usado válido', 'Descripción completa del producto usado válido.', 150, 'used', 'mint')$$,
  'used product accepts a valid subcondition'
);

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, condition) values (1, 'Usado incompleto', 'Descripción completa del producto usado incompleto.', 150, 'used')$$,
  '23514',
  null,
  'used product requires a subcondition'
);

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, condition, used_condition) values (1, 'Nuevo inválido', 'Descripción completa del producto nuevo inválido.', 150, 'new', 'good')$$,
  '23514',
  null,
  'new product rejects a used subcondition'
);

select * from finish();
rollback;
