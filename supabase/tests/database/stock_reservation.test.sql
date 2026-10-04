begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_column('public', 'orders', 'stock_reserved', 'orders record whether they took units off the shelf');

insert into auth.users (id, email, created_at) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'stock-seller@test.local', now()),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'stock-buyer-a@test.local', now()),
  ('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'stock-buyer-b@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code, time_zone)
overriding system value
values (930, 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'Tienda Inventario', 'tienda-inventario',
  'Descripción completa de la tienda para probar el inventario.', 'MX', 'America/Mexico_City');

update public.shops set is_publishing_approved = true where id = 930;

insert into public.products (id, shop_id, name, description, price_mxn, status, units_available, category_id, image_path)
overriding system value
values
  (830, 930, 'Reloj', 'Descripción completa del reloj de pulsera.', 500, 'published', 3,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1/reloj.webp'),
  (831, 930, 'Taza', 'Descripción completa de la taza de barro artesanal.', 250, 'published', 1,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1/taza.webp'),
  (832, 930, 'Pulsera', 'Descripción completa de la pulsera tejida.', 90, 'published', 998,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1/pulsera.webp'),
  (833, 930, 'Lámpara', 'Descripción completa de la lámpara de mesa.', 700, 'published', 3,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1/lampara.webp');

-- Each step acts as one person and reads the outcome back as the test owner.
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.pickup_checkout() returns bigint language sql as $$
  select public.checkout_cart_v3(930, 'pickup', null, null, null, gen_random_uuid())
$$;

create function pg_temp.units(p_product bigint) returns smallint language sql as $$
  select units_available from public.products where id = p_product
$$;

-- 1. Checkout takes the ordered units off the shelf and marks the order.
select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(830, 2);
create temp table first_order as select pg_temp.pickup_checkout() as id;
reset role;

select is(pg_temp.units(830), 1::smallint, 'checkout subtracts the ordered quantity');
select is((select stock_reserved from public.orders where id = (select id from first_order)), true, 'checkout marks the order as holding stock');

-- 2. Two buyers want the last unit: the first checkout wins, the second is told.
select pg_temp.act_as('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
select public.add_cart_item(831, 1);
select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(831, 1);
select pg_temp.pickup_checkout();
select pg_temp.act_as('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');

select throws_ok(
  $$select pg_temp.pickup_checkout()$$,
  'P0001',
  '«Taza» se agotó.',
  'the second buyer of the last unit cannot check out'
);
reset role;

select is(pg_temp.units(831), 0::smallint, 'a sold-out listing reaches zero units');
select is(
  (select count(*)::integer from public.cart_items ci join public.carts c on c.id = ci.cart_id
    where c.buyer_id = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'),
  1,
  'a failed checkout leaves the cart untouched'
);

-- 3. Fewer units than the cart asks for names the product and what is left.
delete from public.cart_items ci using public.carts c
where c.id = ci.cart_id and c.buyer_id = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3';
select pg_temp.act_as('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
select public.add_cart_item(833, 3);
reset role;
update public.products set units_available = 2 where id = 833;
select pg_temp.act_as('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');

select throws_ok(
  $$select pg_temp.pickup_checkout()$$,
  'P0001',
  'Solo quedan 2 unidades de «Lámpara».',
  'checkout names the product and the units that remain'
);
reset role;
update public.products set units_available = 1 where id = 833;
select pg_temp.act_as('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');

select throws_ok(
  $$select pg_temp.pickup_checkout()$$,
  'P0001',
  'Solo queda 1 unidad de «Lámpara».',
  'a single remaining unit reads in the singular'
);
select is(pg_temp.units(833), 1::smallint, 'a failed checkout takes no units');

-- 4. A sold-out listing cannot be added to a cart at all.
select throws_ok(
  $$select public.add_cart_item(831, 1)$$,
  '22023',
  'Este producto se agotó.',
  'a sold-out listing cannot be added to a cart'
);
reset role;

-- 5. Rejecting gives the units back, once.
select pg_temp.act_as('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.reject_order((select id from first_order), gen_random_uuid());
reset role;

select is(pg_temp.units(830), 3::smallint, 'a rejected order returns its units');
select is((select stock_reserved from public.orders where id = (select id from first_order)), false, 'a released order no longer holds stock');

update public.orders set status = 'canceled_by_admin' where id = (select id from first_order);
select is(pg_temp.units(830), 3::smallint, 'an order never returns its units twice');

-- 6. A buyer cancellation gives the units back.
select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(830, 1);
create temp table buyer_canceled as select pg_temp.pickup_checkout() as id;
select public.cancel_order_by_buyer((select id from buyer_canceled), gen_random_uuid());
reset role;

select is(pg_temp.units(830), 3::smallint, 'a buyer cancellation returns the units');

-- 7. A seller cancellation gives the units back unless the stock is gone.
select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(830, 1);
create temp table seller_canceled as select pg_temp.pickup_checkout() as id;
select pg_temp.act_as('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.accept_order((select id from seller_canceled), gen_random_uuid());
select public.cancel_order_by_seller((select id from seller_canceled), 'seller_unavailable', gen_random_uuid());
reset role;

select is(pg_temp.units(830), 3::smallint, 'a seller cancellation returns the units');

select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(830, 1);
create temp table inventory_gone as select pg_temp.pickup_checkout() as id;
select pg_temp.act_as('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.accept_order((select id from inventory_gone), gen_random_uuid());
select public.cancel_order_by_seller((select id from inventory_gone), 'inventory_unavailable', gen_random_uuid());
reset role;

select is(pg_temp.units(830), 2::smallint, 'a unit the seller says is gone does not come back');
select is((select stock_reserved from public.orders where id = (select id from inventory_gone)), false, 'the missing unit is no longer held either');

-- 8. An order placed before reservation existed never gives units back.
select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(830, 1);
create temp table legacy_order as select pg_temp.pickup_checkout() as id;
reset role;
update public.orders set stock_reserved = false where id = (select id from legacy_order);
select pg_temp.act_as('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.reject_order((select id from legacy_order), gen_random_uuid());
reset role;

select is(pg_temp.units(830), 1::smallint, 'an order that never held stock returns none');

-- 9. Returning units never pushes a listing past the cap.
select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(832, 1);
create temp table capped_order as select pg_temp.pickup_checkout() as id;
reset role;

select is(pg_temp.units(832), 997::smallint, 'the cap listing loses the ordered unit');

update public.products set units_available = 999 where id = 832;
select pg_temp.act_as('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.reject_order((select id from capped_order), gen_random_uuid());
reset role;

select is(pg_temp.units(832), 999::smallint, 'returned units are clamped to the cap');

-- 10. A shipped order keeps its units consumed.
select pg_temp.act_as('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2');
select public.add_cart_item(830, 1);
create temp table shipped_order as select pg_temp.pickup_checkout() as id;
select pg_temp.act_as('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');
select public.accept_order((select id from shipped_order), gen_random_uuid());
select public.confirm_order_payment((select id from shipped_order), gen_random_uuid());
select public.mark_order_shipped((select id from shipped_order), null, gen_random_uuid());
reset role;

select is(pg_temp.units(830), 0::smallint, 'a handed-over order keeps its units consumed');

select * from finish();
rollback;
