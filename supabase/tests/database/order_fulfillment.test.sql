begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code, time_zone)
overriding system value
values (920, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Envio', 'tienda-envio',
  'Descripción completa de la tienda para probar el método de entrega.', 'MX',
  'America/Mexico_City');

update public.shops set is_publishing_approved = true where id = 920;

insert into public.products (id, shop_id, name, description, price_mxn, status, units_available, category_id)
overriding system value
values (820, 920, 'Taza', 'Descripción completa de la taza de barro artesanal.', 250,
  'published', 5, (select id from public.categories where slug = 'celulares-y-accesorios'));

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select public.add_cart_item(820, 1);

-- 1. A shipping checkout writes an address row.
create temp table shipping_order as
select public.checkout_cart_v3(
  920,
  'shipping',
  '{"recipient":"Ana Ruiz","address_line1":"Calle 1","address_line2":null,"locality":"Zapopan","administrative_area":"Jalisco","postal_code":"45010","country_code":"MX","delivery_instructions":null}'::jsonb,
  null,
  'Mensaje',
  gen_random_uuid()
) as id;

select is(
  (select fulfillment_method from public.orders where id = (select id from shipping_order)),
  'shipping',
  'a shipping checkout records the shipping method'
);

select isnt_empty(
  $$select order_id from public.order_addresses
    where order_id = (select id from shipping_order)$$,
  'a shipping checkout writes an address row'
);

-- 2. A pickup checkout writes no address row, and carries the alternate contact.
select public.add_cart_item(820, 1);

create temp table pickup_request as
select gen_random_uuid() as idempotency_key;

create temp table pickup_order as
select public.checkout_cart_v3(
  920,
  'pickup',
  null,
  '{"name":"Luis Ruiz","phone":"+523312345678","note":"mi hermano"}'::jsonb,
  null,
  (select idempotency_key from pickup_request)
) as id;

select is(
  (select fulfillment_method from public.orders where id = (select id from pickup_order)),
  'pickup',
  'a pickup checkout records the pickup method'
);

select is_empty(
  $$select order_id from public.order_addresses
    where order_id = (select id from pickup_order)$$,
  'a pickup checkout writes no address row'
);

select results_eq(
  $$select alt_contact_name || '|' || alt_contact_phone || '|' || alt_contact_note
    from public.orders where id = (select id from pickup_order)$$,
  array['Luis Ruiz|+523312345678|mi hermano'::text],
  'all alternate contact fields are stored in their intended columns'
);

-- 3. Replaying the same key after the cart was emptied returns the first order
-- and cannot create another row.
select is(
  public.checkout_cart_v3(
    920,
    'pickup',
    null,
    '{"name":"Luis Ruiz","phone":"+523312345678","note":"mi hermano"}'::jsonb,
    null,
    (select idempotency_key from pickup_request)
  ),
  (select id from pickup_order),
  'a repeated v3 idempotency key returns the original order'
);

select is(
  (
    select count(*)
    from public.orders
    where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and idempotency_key = (select idempotency_key from pickup_request)
  ),
  1::bigint,
  'a repeated v3 idempotency key creates no extra order row'
);

-- 4. Shipping without an address is refused.
select public.add_cart_item(820, 1);

select throws_ok(
  $$select public.checkout_cart_v3(920, 'shipping', null, null, null, gen_random_uuid())$$,
  '22023',
  'Completa la dirección de entrega.',
  'shipping without an address is refused'
);

-- 5. Pickup carrying an address is refused, so it cannot slip past the gate.
select throws_ok(
  $$select public.checkout_cart_v3(920, 'pickup',
      '{"recipient":"Ana","address_line1":"Calle 1","locality":"Zapopan","administrative_area":"Jalisco","postal_code":"45010","country_code":"MX"}'::jsonb,
      null, null, gen_random_uuid())$$,
  'P0001',
  'Una recolección no lleva dirección de entrega.',
  'pickup with an address is refused'
);

-- 6. An invented method is refused.
select throws_ok(
  $$select public.checkout_cart_v3(920, 'teleport', null, null, null, gen_random_uuid())$$,
  '22023',
  'Elige recolección o envío.',
  'an unknown fulfillment method is refused'
);

-- 7. A phone or note with nobody's name attached is refused.
select public.add_cart_item(820, 1);

select throws_ok(
  $$select public.checkout_cart_v3(920, 'pickup', null, '{"phone":"+523312345678"}'::jsonb, null, gen_random_uuid())$$,
  '22023',
  'Escribe el nombre de la otra persona.',
  'an alternate contact phone without a name is refused'
);

-- 8. A too-short alternate contact name is refused in Spanish, not as a raw
-- constraint violation.
select throws_ok(
  $$select public.checkout_cart_v3(920, 'pickup', null, '{"name":"A"}'::jsonb, null, gen_random_uuid())$$,
  '22023',
  'El nombre de la otra persona debe tener entre 2 y 80 caracteres.',
  'a too-short alternate contact name is refused'
);

-- 9. A phone missing the +52 prefix is refused in Spanish. This is the case a
-- buyer is most likely to hit, typing ten digits with no country code.
select throws_ok(
  $$select public.checkout_cart_v3(920, 'pickup', null, '{"name":"Luis Ruiz","phone":"3312345678"}'::jsonb, null, gen_random_uuid())$$,
  '22023',
  'El teléfono debe tener 10 dígitos.',
  'an alternate contact phone missing the +52 prefix is refused'
);

-- 10. A too-long alternate contact note is refused in Spanish.
select throws_ok(
  $$select public.checkout_cart_v3(920, 'pickup', null, jsonb_build_object('name', 'Luis Ruiz', 'note', repeat('a', 201)), null, gen_random_uuid())$$,
  '22023',
  'La nota no puede pasar de 200 caracteres.',
  'a too-long alternate contact note is refused'
);

select * from finish();
rollback;
