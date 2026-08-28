begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'stranger@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code)
overriding system value
values (910, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Recoge', 'tienda-recoge',
  'Descripción completa de la tienda que ofrece recolección.', 'MX');

insert into public.user_display_names (user_id, display_name)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Elena Volcán');

insert into public.shop_pickup_points
  (shop_id, address_line1, locality, administrative_area_code, postal_code, notes)
values (910, 'Av. Vallarta 1234', 'Zapopan', 'MX-JAL', '45010', 'Portón verde');

-- An order that has not been accepted yet, and one that has.
insert into public.orders
  (id, buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days,
   handling_time_zone, status, fulfillment_method)
overriding system value
values
  (910, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 910, gen_random_uuid(), 'MXN', 250, 1,
   'America/Mexico_City', 'requested', 'pickup');

-- 1. The owner sees the whole address.
set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'address_line1',
  'Av. Vallarta 1234',
  'the shop owner reads the full pickup address'
);

select is(
  public.shop_pickup_point(910) ->> 'notes',
  'Portón verde',
  'the shop owner reads the pickup notes'
);

-- 2. A buyer whose order is still requested sees only city and state.
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'locality',
  'Zapopan',
  'a buyer with a pending request sees the locality'
);

select ok(
  public.shop_pickup_point(910) -> 'address_line1' is null,
  'a buyer with a pending request does not see the street'
);

-- 3. Once the seller accepts, the street appears and stays through completion.
set local role postgres;
update public.orders set status = 'accepted', accepted_at = now() where id = 910;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'address_line1',
  'Av. Vallarta 1234',
  'the street appears once the order is accepted'
);

set local role postgres;
update public.orders set status = 'completed', completed_at = now() where id = 910;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'address_line1',
  'Av. Vallarta 1234',
  'the street is still readable on a completed order'
);

-- 4. A signed-in stranger gets the coarse form only.
set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select ok(
  public.shop_pickup_point(910) -> 'address_line1' is null
    and public.shop_pickup_point(910) ->> 'locality' = 'Zapopan',
  'an unrelated signed-in user sees only city and state'
);

-- 5. Reading the table directly returns nothing to a buyer.
select is_empty(
  $$select shop_id from public.shop_pickup_points$$,
  'a buyer reads no rows from the table itself'
);

-- 6. The area code must belong to the shop's country.
set local role postgres;
select throws_ok(
  $$insert into public.shop_pickup_points
      (shop_id, address_line1, locality, administrative_area_code, postal_code)
    values (910, 'Otra calle 1', 'Toluca', 'US-CA', '50000')$$,
  'P0001',
  null,
  'a pickup point in another country is refused'
);

-- 7. The regression the column-revoke design would have caused.
set local role anon;

select is(
  public.shop_pickup_point(910) ->> 'locality',
  'Zapopan',
  'an anonymous caller sees the pickup locality'
);

select ok(
  public.shop_pickup_point(910) -> 'address_line1' is null,
  'an anonymous caller does not see the pickup street'
);

select ok(
  not has_table_privilege('anon', 'public.shop_pickup_points', 'select'),
  'anonymous has no direct select privilege on pickup points'
);

select is(
  public.shop_seller_display_name(910),
  'Elena Volcán',
  'the public shop reader returns the seller display name'
);

select ok(
  has_function_privilege('anon', 'public.shop_seller_display_name(bigint)', 'execute'),
  'anonymous may call the narrow public seller-name reader'
);

select lives_ok(
  $$select * from public.shops where id = 910$$,
  'select * on shops still works for anonymous callers'
);

reset role;
reset request.jwt.claims;

select * from finish();
rollback;
