begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_column('public', 'orders', 'payment_confirmation_required', 'orders identify payment-required checkout');
select has_column('public', 'orders', 'payment_completed_at', 'orders store seller-confirmed payment time');
select has_column('public', 'orders', 'payment_confirmed_by', 'orders store confirming seller');
select has_column('public', 'orders', 'seller_cancellation_reason', 'orders store structured seller cancellation reason');
select has_function('public', 'checkout_cart_v2', array['bigint','jsonb','text','uuid'], 'payment-required checkout RPC exists');
select has_function('public', 'confirm_order_payment', array['bigint','uuid'], 'seller payment confirmation RPC exists');
select has_function('public', 'cancel_order_by_buyer', array['bigint','uuid'], 'buyer cancellation RPC exists');
select has_function('public', 'cancel_order_by_seller', array['bigint','text','uuid'], 'seller cancellation RPC exists');

insert into auth.users (id, email, created_at) values
  ('50000000-0000-4000-8000-000000000001', 'buyer-evidence-seller@test.local', now()),
  ('50000000-0000-4000-8000-000000000002', 'buyer-evidence-buyer@test.local', now()),
  ('50000000-0000-4000-8000-000000000003', 'buyer-evidence-other@test.local', now());

insert into public.shops (owner_id, name, slug, description)
values ('50000000-0000-4000-8000-000000000001', 'Pagos Uno', 'pagos-uno', 'Descripción completa para probar evidencia de pago del comprador.');

insert into public.products (shop_id, name, description, price_mxn, status, category_id)
select s.id, 'Producto pagable', 'Descripción suficientemente larga para probar solicitudes con pago.', 250, 'published',
  (select id from public.categories where slug = 'celulares-y-accesorios')
from public.shops s where s.slug = 'pagos-uno';

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000002';

select public.add_cart_item((select id from public.products where name = 'Producto pagable'), 1);
select lives_ok(
  $$select public.checkout_cart(
    (select id from public.shops where slug = 'pagos-uno'),
    '{"recipient":"Comprador Uno","address_line1":"Calle Uno 1","locality":"Guadalajara","administrative_area":"Jalisco","postal_code":"44100","country_code":"MX"}'::jsonb,
    null,
    '50000000-0000-4000-8000-000000000101'
  )$$,
  'legacy checkout remains callable'
);

select public.add_cart_item((select id from public.products where name = 'Producto pagable'), 1);
select lives_ok(
  $$select public.checkout_cart_v2(
    (select id from public.shops where slug = 'pagos-uno'),
    '{"recipient":"Comprador Uno","address_line1":"Calle Uno 1","locality":"Guadalajara","administrative_area":"Jalisco","postal_code":"44100","country_code":"MX"}'::jsonb,
    null,
    '50000000-0000-4000-8000-000000000102'
  )$$,
  'v2 checkout creates payment-required order'
);

select results_eq(
  $$select count(*) from public.orders where payment_confirmation_required$$,
  array[1::bigint],
  'only v2 checkout requires payment confirmation'
);
select results_eq(
  $$select count(*) from public.orders where not payment_confirmation_required$$,
  array[1::bigint],
  'legacy checkout remains payment optional'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select public.accept_order((select id from public.orders where not payment_confirmation_required), '50000000-0000-4000-8000-000000000111')$$,
  'seller accepts legacy order'
);
select lives_ok(
  $$select public.accept_order((select id from public.orders where payment_confirmation_required), '50000000-0000-4000-8000-000000000112')$$,
  'seller accepts payment-required order'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000003';
select throws_ok(
  $$select public.confirm_order_payment((select id from public.orders where payment_confirmation_required), '50000000-0000-4000-8000-000000000121')$$,
  '42501',
  'Solo el vendedor puede confirmar el pago.',
  'unrelated user cannot confirm payment'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.mark_order_shipped((select id from public.orders where payment_confirmation_required), null, '50000000-0000-4000-8000-000000000122')$$,
  'P0001',
  'Confirma el pago antes de enviar.',
  'payment-required order cannot ship before confirmation'
);
select lives_ok(
  $$select public.confirm_order_payment((select id from public.orders where payment_confirmation_required), '50000000-0000-4000-8000-000000000123')$$,
  'seller confirms payment receipt'
);
select lives_ok(
  $$select public.confirm_order_payment((select id from public.orders where payment_confirmation_required), '50000000-0000-4000-8000-000000000123')$$,
  'payment confirmation is idempotent'
);
select results_eq(
  $$select count(*) from public.orders where payment_completed_at is not null and payment_confirmed_by = '50000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'payment confirmation stores canonical seller evidence once'
);
select lives_ok(
  $$select public.mark_order_shipped((select id from public.orders where payment_confirmation_required), 'Guía V2', '50000000-0000-4000-8000-000000000124')$$,
  'payment-required order ships after confirmation'
);
select lives_ok(
  $$select public.mark_order_shipped((select id from public.orders where not payment_confirmation_required), 'Guía legado', '50000000-0000-4000-8000-000000000125')$$,
  'legacy order remains shippable without payment evidence'
);

reset role;
insert into public.orders (buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone)
select '50000000-0000-4000-8000-000000000002', id, gen_random_uuid(), 'MXN', 100, 1, 'America/Mexico_City'
from public.shops where slug = 'pagos-uno';

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.cancel_order_by_buyer((select id from public.orders where status = 'requested' order by id desc limit 1), '50000000-0000-4000-8000-000000000131')$$,
  'buyer can cancel before seller acceptance'
);
select results_eq(
  $$select status || ':' || (accepted_at is null)::text from public.orders where id = (select max(id) from public.orders)$$,
  array['canceled_by_buyer:true'::text],
  'pre-acceptance cancellation remains distinguishable for metric exclusion'
);

reset role;
insert into public.orders (buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone)
select '50000000-0000-4000-8000-000000000002', id, gen_random_uuid(), 'MXN', 100, 1, 'America/Mexico_City'
from public.shops where slug = 'pagos-uno';

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
select public.accept_order((select id from public.orders where status = 'requested' order by id desc limit 1), '50000000-0000-4000-8000-000000000132');
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.cancel_order_by_buyer((select id from public.orders where status = 'accepted' order by id desc limit 1), '50000000-0000-4000-8000-000000000133')$$,
  'buyer can cancel accepted unpaid order'
);
select results_eq(
  $$select count(*) from public.orders where status = 'canceled_by_buyer' and accepted_at is not null$$,
  array[1::bigint],
  'accepted buyer cancellation creates trust-eligible evidence'
);

reset role;
insert into public.orders (buyer_id, shop_id, status, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, accepted_at)
select '50000000-0000-4000-8000-000000000002', id, 'accepted', gen_random_uuid(), 'MXN', 100, 1, 'America/Mexico_City', now()
from public.shops where slug = 'pagos-uno';

set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.cancel_order_by_seller((select id from public.orders where status = 'accepted' order by id desc limit 1), 'invalid', '50000000-0000-4000-8000-000000000141')$$,
  '22023',
  'Razón de cancelación inválida.',
  'seller cancellation rejects unknown reason'
);
select lives_ok(
  $$select public.cancel_order_by_seller((select id from public.orders where status = 'accepted' order by id desc limit 1), 'buyer_non_payment', '50000000-0000-4000-8000-000000000142')$$,
  'seller records confirmed buyer non-payment'
);
select results_eq(
  $$select seller_cancellation_reason from public.orders where status = 'canceled_by_seller' order by id desc limit 1$$,
  array['buyer_non_payment'::text],
  'non-payment cancellation stores structured evidence'
);

select * from finish();
rollback;
