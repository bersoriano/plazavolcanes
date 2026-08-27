begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_table('public', 'conversations', 'conversations table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'seller_response_events', 'response clocks exist');
select has_table('public', 'seller_activity_events', 'meaningful seller activity exists');
select has_function('public', 'accept_order', array['bigint', 'uuid'], 'seller accept RPC exists');
select has_function('public', 'mark_order_shipped', array['bigint', 'text', 'uuid'], 'seller shipment RPC exists');
select has_function('public', 'confirm_order_received', array['bigint', 'uuid'], 'buyer receipt RPC exists');
select has_function('public', 'confirm_order_satisfied', array['bigint', 'uuid'], 'buyer completion RPC exists');
select has_function('public', 'send_conversation_message', array['bigint', 'text', 'uuid'], 'message RPC exists');

select is(
  private.add_business_days('2026-08-21 16:00:00+00'::timestamptz, 1, 'America/Mexico_City'),
  '2026-08-24 16:00:00+00'::timestamptz,
  'handling deadline skips weekend and preserves local time'
);

insert into auth.users (id, email, created_at) values
  ('20000000-0000-4000-8000-000000000001', 'fulfillment-seller@test.local', now()),
  ('20000000-0000-4000-8000-000000000002', 'fulfillment-buyer@test.local', now());

insert into public.shops (owner_id, name, slug, description)
values ('20000000-0000-4000-8000-000000000001', 'Envíos Uno', 'envios-uno', 'Descripción completa para probar cumplimiento y mensajes.');

insert into public.orders (buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, fulfillment_method)
values (
  '20000000-0000-4000-8000-000000000002',
  (select id from public.shops where slug = 'envios-uno'),
  '20000000-0000-4000-8000-000000000099', 'MXN', 100, 1, 'America/Mexico_City', 'shipping'
);

select results_eq(
  $$select count(*) from public.conversations where type = 'order'$$,
  array[1::bigint],
  'order creation opens one order conversation'
);

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select public.accept_order((select id from public.orders), '20000000-0000-4000-8000-000000000011')$$,
  'owner accepts requested order'
);

select results_eq(
  $$select status from public.orders$$,
  array['accepted'::text],
  'accept transition updates order status'
);

set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.send_conversation_message((select id from public.conversations), '¿Cuándo envías?', '20000000-0000-4000-8000-000000000021')$$,
  'buyer message starts response clock'
);

select lives_ok(
  $$select public.send_conversation_message((select id from public.conversations), 'También necesito seguimiento.', '20000000-0000-4000-8000-000000000022')$$,
  'second buyer message remains in open clock'
);

select results_eq(
  $$select count(*) from public.seller_response_events where replied_at is null$$,
  array[1::bigint],
  'multiple buyer messages share one open response clock'
);

set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select public.send_conversation_message((select id from public.conversations), 'Mañana queda enviado.', '20000000-0000-4000-8000-000000000023')$$,
  'seller reply closes response clock'
);

select results_eq(
  $$select count(*) from public.seller_response_events where replied_at is not null and elapsed_minutes >= 0$$,
  array[1::bigint],
  'seller reply records elapsed minutes'
);

select results_eq(
  $$select count(*) from public.seller_activity_events where activity_type in ('order_accepted', 'seller_message')$$,
  array[2::bigint],
  'only meaningful seller actions create activity evidence'
);

select * from finish();
rollback;
