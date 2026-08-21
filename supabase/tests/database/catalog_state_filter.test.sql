begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_function(
  'public',
  'catalog_state_counts',
  array['text'],
  'catalog state counts RPC exists with its public signature'
);

select has_index(
  'public',
  'shops',
  'shops_administrative_area_codes_idx',
  'administrative area overlap lookups are indexed'
);

insert into auth.users (id, email, created_at) values
  ('22222222-2222-4222-8222-222222222222', 'state-seller@test.local', '2026-08-20 10:00:00+00');

insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('22222222-2222-4222-8222-222222222222', 'Taller Jalisco', 'taller-jalisco', 'Descripción completa del taller de Jalisco.', 'MX', array['MX-JAL']),
  ('22222222-2222-4222-8222-222222222222', 'Taller Oaxaca', 'taller-oaxaca', 'Descripción completa del taller de Oaxaca.', 'MX', array['MX-OAX']),
  ('22222222-2222-4222-8222-222222222222', 'Taller Doble', 'taller-doble', 'Descripción completa del taller con dos estados.', 'MX', array['MX-JAL', 'MX-COL']);

insert into public.products (shop_id, name, description, price_mxn, status, category_id) values
  ((select id from public.shops where slug = 'taller-jalisco'), 'Taza jalisciense', 'Descripción completa de la taza jalisciense.', 100, 'published', (select id from public.categories where slug = 'celulares-y-accesorios')),
  ((select id from public.shops where slug = 'taller-oaxaca'), 'Taza oaxaqueña', 'Descripción completa de la taza oaxaqueña.', 200, 'published', (select id from public.categories where slug = 'celulares-y-accesorios')),
  ((select id from public.shops where slug = 'taller-doble'), 'Taza doble', 'Descripción completa de la taza doble.', 300, 'published', (select id from public.categories where slug = 'celulares-y-accesorios')),
  ((select id from public.shops where slug = 'taller-jalisco'), 'Borrador jalisciense', 'Descripción completa del borrador jalisciense.', 400, 'draft', null);

select results_eq(
  $$select product_id from public.search_product_ids('', 'es-MX', 'MX', 'MX-JAL', null, 100) order by product_id$$,
  $$select id from public.products where name in ('Taza jalisciense', 'Taza doble') order by id$$,
  'the area filter keeps every shop that operates in the selected state'
);

select results_eq(
  $$select product_id from public.search_product_ids('', 'es-MX', 'MX', 'MX-OAX', null, 100)$$,
  $$select id from public.products where name = 'Taza oaxaqueña'$$,
  'the area filter excludes shops from other states'
);

select results_eq(
  $$select count(*) from public.search_product_ids('', 'es-MX', 'MX', 'MX-YUC', null, 100)$$,
  array[0::bigint],
  'a state without published products returns nothing'
);

select results_eq(
  $$select count(*) from public.search_product_ids('', 'es-MX', 'MX', null, null, 100)$$,
  array[3::bigint],
  'a null area keeps the national catalog intact'
);

select results_eq(
  $$select administrative_area_code, product_count from public.catalog_state_counts('MX') order by administrative_area_code$$,
  $$values ('MX-COL'::text, 1::bigint), ('MX-JAL'::text, 2::bigint), ('MX-OAX'::text, 1::bigint)$$,
  'state counts credit a product to every state its shop operates in and skip drafts'
);

select results_eq(
  $$select count(*) from public.catalog_state_counts('US')$$,
  array[0::bigint],
  'state counts stay scoped to the requested country'
);

select * from finish();
rollback;
