begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

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
insert into public.orders (buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, fulfillment_method)
select '50000000-0000-4000-8000-000000000002', id, gen_random_uuid(), 'MXN', 100, 1, 'America/Mexico_City', 'shipping'
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
insert into public.orders (buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, fulfillment_method)
select '50000000-0000-4000-8000-000000000002', id, gen_random_uuid(), 'MXN', 100, 1, 'America/Mexico_City', 'shipping'
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
insert into public.orders (buyer_id, shop_id, status, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, accepted_at, fulfillment_method)
select '50000000-0000-4000-8000-000000000002', id, 'accepted', gen_random_uuid(), 'MXN', 100, 1, 'America/Mexico_City', now(), 'shipping'
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

select has_table('public', 'buyer_response_events', 'buyer response clock table exists');
select has_table('public', 'buyer_activity_events', 'meaningful buyer activity table exists');
select has_column('public', 'buyer_response_events', 'order_id', 'buyer response clocks identify order');

select lives_ok(
  $$select public.send_conversation_message(
    (select c.id from public.conversations c join public.orders o on o.id = c.order_id where o.payment_confirmation_required limit 1),
    '¿Confirmas la entrega?',
    '50000000-0000-4000-8000-000000000151'
  )$$,
  'seller order message starts buyer response clock'
);
select lives_ok(
  $$select public.send_conversation_message(
    (select c.id from public.conversations c join public.orders o on o.id = c.order_id where o.payment_confirmation_required limit 1),
    'Segundo mensaje',
    '50000000-0000-4000-8000-000000000152'
  )$$,
  'repeated seller order message is accepted'
);
select results_eq(
  $$select count(*) from public.buyer_response_events where replied_at is null$$,
  array[1::bigint],
  'repeated seller messages share one buyer clock'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.send_conversation_message(
    (select c.id from public.conversations c join public.orders o on o.id = c.order_id where o.payment_confirmation_required limit 1),
    'Sí, recibido.',
    '50000000-0000-4000-8000-000000000153'
  )$$,
  'buyer reply closes response clock'
);
select results_eq(
  $$select count(*) from public.buyer_response_events where replied_at is not null and elapsed_minutes >= 0$$,
  array[1::bigint],
  'closed buyer clock stores elapsed minutes'
);
select lives_ok(
  $$select public.start_pre_sale_conversation((select id from public.shops where slug = 'pagos-uno'))$$,
  'buyer starts pre-sale conversation'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
select lives_ok(
  $$select public.send_conversation_message(
    (select id from public.conversations where type = 'pre_sale' and buyer_id = '50000000-0000-4000-8000-000000000002'),
    'Respuesta preventa',
    '50000000-0000-4000-8000-000000000154'
  )$$,
  'seller can reply in pre-sale conversation'
);
select results_eq(
  $$select count(*) from public.buyer_response_events$$,
  array[1::bigint],
  'pre-sale messages never create buyer clocks'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000002';
select lives_ok(
  $$select public.confirm_order_received((select id from public.orders where payment_confirmation_required and status = 'shipped'), '50000000-0000-4000-8000-000000000161')$$,
  'receipt confirmation creates buyer activity'
);
select lives_ok(
  $$select public.confirm_order_satisfied((select id from public.orders where payment_confirmation_required and status = 'delivered'), '50000000-0000-4000-8000-000000000162')$$,
  'order completion creates buyer activity'
);
select lives_ok(
  $$select public.create_order_review((select id from public.orders where payment_confirmation_required and status = 'completed'), 5, true, 'Todo bien')$$,
  'review submission creates buyer activity'
);
select lives_ok(
  $$select public.open_order_dispute((select id from public.orders where not payment_confirmation_required and status = 'shipped'), 'other', 'Necesito ayuda', '[]'::jsonb)$$,
  'claim submission creates buyer activity'
);
select results_eq(
  $$select distinct activity_type from public.buyer_activity_events order by activity_type$$,
  array[
    'accepted_order_canceled'::text, 'buyer_message'::text, 'checkout'::text,
    'claim_submitted'::text, 'order_completed'::text, 'payment_completed'::text,
    'receipt_confirmed'::text, 'review_submitted'::text
  ],
  'only approved meaningful buyer activity types are recorded'
);
select results_eq(
  $$select count(*) from public.buyer_activity_events where buyer_id = auth.uid()$$,
  $$select count(*) from public.buyer_activity_events$$,
  'buyer can read own activity'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
select results_eq(
  $$select count(*) from public.buyer_activity_events$$,
  $$select count(*) from public.buyer_activity_events where buyer_id = '50000000-0000-4000-8000-000000000002'$$,
  'shared-order seller can read buyer activity'
);
select results_eq(
  $$select count(*) from public.buyer_response_events$$,
  array[1::bigint],
  'shared-order seller can read buyer response clocks'
);

set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000003';
select is_empty(
  $$select * from public.buyer_activity_events$$,
  'unrelated user cannot read buyer activity'
);
select is_empty(
  $$select * from public.buyer_response_events$$,
  'unrelated user cannot read buyer response clocks'
);
select results_eq(
  $$select count(*) from public.buyer_activity_events where activity_type = 'login'$$,
  array[0::bigint],
  'login is not meaningful buyer activity'
);

select * from finish();
rollback;
