begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

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
select hasnt_function('public', 'checkout_cart', array['bigint', 'jsonb', 'text', 'uuid'], 'checkout v1 is retired');
select hasnt_function(
  'private',
  'checkout_cart_internal',
  array['bigint', 'jsonb', 'text', 'uuid', 'boolean'],
  'the five-argument private checkout is retired'
);
select has_function(
  'private',
  'checkout_cart_internal_v2',
  array['bigint', 'text', 'jsonb', 'jsonb', 'text', 'uuid', 'boolean'],
  'v2 and v3 share one seven-argument private checkout'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.checkout_cart_internal_v2(bigint,text,jsonb,jsonb,text,uuid,boolean)',
    'execute'
  ),
  'authenticated callers cannot execute the private checkout directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.checkout_cart_v2(bigint,jsonb,text,uuid)',
    'execute'
  ),
  'anonymous callers cannot execute checkout v2'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.checkout_cart_v2(bigint,jsonb,text,uuid)',
    'execute'
  ),
  'authenticated callers retain checkout v2 compatibility'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.checkout_cart_v3(bigint,text,jsonb,jsonb,text,uuid)',
    'execute'
  ),
  'authenticated callers execute the fulfillment-aware checkout v3'
);

insert into auth.users (id, email, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'commerce-seller@test.local', now()),
  ('10000000-0000-4000-8000-000000000002', 'commerce-buyer@test.local', now());

insert into public.shops (owner_id, name, slug, description)
values ('10000000-0000-4000-8000-000000000001', 'Comercio Uno', 'comercio-uno', 'Descripción completa para probar pedidos y límites.');

update public.shops
set is_publishing_approved = true
where slug = 'comercio-uno';

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
where id in (
  select products.id
  from public.products products
  join public.shops shops on shops.id = products.shop_id
  where shops.slug = 'comercio-uno'
  order by products.id
  limit 15
);

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
  $$select public.checkout_cart_v2(
    (select id from public.shops where slug = 'comercio-uno'),
    '{"recipient":"María López","address_line1":"Calle Uno 10","locality":"Guadalajara","administrative_area":"Jalisco","postal_code":"44100","country_code":"MX"}'::jsonb,
    'Entregar por la tarde',
    '10000000-0000-4000-8000-000000000099'::uuid
  )$$,
  'buyer checks out cart atomically through v2'
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

reset role;
update public.products
set is_admin_enabled = false
where name = 'Producto 2';

create temp table hidden_commerce_product as
select id from public.products where name = 'Producto 2';

grant select on hidden_commerce_product to authenticated;

insert into public.carts (buyer_id, shop_id)
select '10000000-0000-4000-8000-000000000002', id
from public.shops
where slug = 'comercio-uno';

insert into public.cart_items (cart_id, product_id, quantity)
select carts.id, hidden_commerce_product.id, 1
from public.carts cross join hidden_commerce_product
where carts.buyer_id = '10000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select throws_ok(
  $$select public.add_cart_item((select id from hidden_commerce_product), 1)$$,
  'P0002',
  'Producto no disponible.',
  'a hidden product cannot be added to a cart'
);

select throws_ok(
  $$select public.checkout_cart_v3(
    (select id from public.shops where slug = 'comercio-uno'),
    'pickup',
    null,
    null,
    null,
    '10000000-0000-4000-8000-000000000098'::uuid
  )$$,
  'P0001',
  'Uno o más productos ya no están disponibles.',
  'checkout rejects a cart containing a product that became hidden'
);

select * from finish();
rollback;
