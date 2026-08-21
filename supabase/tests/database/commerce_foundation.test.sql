begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_column('public', 'shops', 'trust_tier', 'shops cache trust tier');
select has_column('public', 'shops', 'listing_limit', 'shops cache listing limit');
select has_column('public', 'shops', 'time_zone', 'shops store fulfillment time zone');
select has_column('public', 'products', 'handling_days', 'products store handling promise');
select has_table('public', 'carts', 'carts table exists');
select has_table('public', 'cart_items', 'cart items table exists');
select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_items', 'order item snapshots exist');
select has_table('public', 'order_addresses', 'order address snapshots exist');
select has_table('public', 'order_events', 'order audit events exist');
select has_function('public', 'add_cart_item', array['bigint', 'integer'], 'cart mutation RPC exists');
select has_function('public', 'checkout_cart', array['bigint', 'jsonb', 'text', 'uuid'], 'atomic checkout RPC exists');

insert into auth.users (id, email, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'commerce-seller@test.local', now()),
  ('10000000-0000-4000-8000-000000000002', 'commerce-buyer@test.local', now());

insert into public.shops (owner_id, name, slug, description)
values ('10000000-0000-4000-8000-000000000001', 'Comercio Uno', 'comercio-uno', 'Descripción completa para probar pedidos y límites.');

insert into public.products (shop_id, name, description, price_mxn, status, category_id, units_available)
select s.id, 'Producto ' || n, 'Descripción suficientemente larga para producto ' || n, 10 * n, 'draft',
  (select id from public.categories where slug = 'celulares-y-accesorios'), 10
from public.shops s cross join generate_series(1, 16) n
where s.slug = 'comercio-uno';

select results_eq(
  $$select trust_tier || ':' || listing_limit from public.shops where slug = 'comercio-uno'$$,
  array['standard:15'::text],
  'new shops start Standard with 15 listings'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

update public.products set status = 'published'
where id in (select id from public.products order by id limit 15);

select throws_ok(
  $$update public.products set status = 'published' where name = 'Producto 16'$$,
  'P0001',
  'Límite de publicaciones alcanzado.',
  'transactional guard blocks the sixteenth publication'
);

select throws_ok(
  $$select public.add_cart_item((select id from public.products where name = 'Producto 1'), 1)$$,
  'P0001',
  'No puedes comprar en tu propia tienda.',
  'seller cannot add an owned product to cart'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.add_cart_item((select id from public.products where name = 'Producto 1'), 2)$$,
  'buyer can add a published product to cart'
);

select results_eq(
  $$select quantity from public.cart_items$$,
  array[2],
  'cart stores requested quantity'
);

select lives_ok(
  $$select public.checkout_cart(
    (select id from public.shops where slug = 'comercio-uno'),
    '{"recipient":"María López","address_line1":"Calle Uno 10","locality":"Guadalajara","administrative_area":"Jalisco","postal_code":"44100","country_code":"MX"}'::jsonb,
    'Entregar por la tarde',
    '10000000-0000-4000-8000-000000000099'::uuid
  )$$,
  'buyer checks out cart atomically'
);

select results_eq(
  $$select subtotal from public.orders$$,
  array[20.00::numeric],
  'order subtotal uses immutable quantity and price snapshot'
);

select results_eq(
  $$select count(*) from public.order_items$$,
  array[1::bigint],
  'checkout creates item snapshot'
);

select results_eq(
  $$select count(*) from public.order_events where event_type = 'requested'$$,
  array[1::bigint],
  'checkout appends requested audit event'
);

select * from finish();
rollback;
