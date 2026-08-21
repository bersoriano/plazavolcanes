begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_column('public', 'products', 'slug', 'products carry a slug');

select col_is_unique('public', 'products', 'slug', 'product slugs are unique');

insert into auth.users (id, email, created_at) values
  ('44444444-4444-4444-8444-444444444444', 'slug-seller@test.local', '2026-08-20 10:00:00+00');

insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('44444444-4444-4444-8444-444444444444', 'Slug Shop', 'slug-shop', 'Descripción completa de la tienda de slugs.', 'MX', array['MX-JAL']);

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status, slug) values ((select id from public.shops where slug = 'slug-shop'), 'Sin slug', 'Descripción completa del producto sin slug.', 100, 'draft', 'Mayúsculas No')$$,
  '23514',
  null,
  'product slugs reject anything outside the lowercase hyphen format'
);

insert into public.products (shop_id, name, description, price_mxn, status, slug) values
  ((select id from public.shops where slug = 'slug-shop'), 'Motorola Razr 5G', 'Descripción completa del teléfono plegable.', 100, 'draft', 'motorola-razr-5g');

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status, slug) values ((select id from public.shops where slug = 'slug-shop'), 'Motorola Razr 5G', 'Descripción completa del segundo teléfono plegable.', 200, 'draft', 'motorola-razr-5g')$$,
  '23505',
  null,
  'two products cannot claim the same slug'
);

insert into public.products (shop_id, name, description, price_mxn, status) values
  ((select id from public.shops where slug = 'slug-shop'), 'Motorola Razr 5G', 'Descripción completa del tercer teléfono plegable.', 300, 'draft'),
  ((select id from public.shops where slug = 'slug-shop'), '¡!¿?', 'Descripción completa del producto sin letras.', 400, 'draft');

select results_eq(
  $$select slug from public.products where price_mxn = 300$$,
  array['motorola-razr-5g-2'::text],
  'an insert without a slug is given the next free suffix'
);

select results_eq(
  $$select slug from public.products where price_mxn = 400$$,
  array['producto'::text],
  'a name with nothing sluggable falls back'
);

select results_eq(
  $$select count(*) from public.products where slug is null or slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'$$,
  array[0::bigint],
  'the backfill left every existing product with a well formed slug'
);

select * from finish();
rollback;
