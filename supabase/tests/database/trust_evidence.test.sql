begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public', 'order_reviews', 'order reviews exist');
select has_table('public', 'order_disputes', 'order disputes exist');
select has_table('private', 'admin_users', 'private admin membership exists');
select has_table('private', 'admin_audit_events', 'admin changes are audited');
select has_function('public', 'create_order_review', array['bigint', 'integer', 'boolean', 'text'], 'review RPC exists');
select has_function('public', 'open_order_dispute', array['bigint', 'text', 'text', 'jsonb'], 'dispute RPC exists');
select has_function('public', 'resolve_order_dispute', array['bigint', 'text', 'boolean', 'text'], 'admin resolution RPC exists');

insert into auth.users (id, email, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'evidence-seller@test.local', now()),
  ('30000000-0000-4000-8000-000000000002', 'evidence-buyer@test.local', now()),
  ('30000000-0000-4000-8000-000000000003', 'evidence-admin@test.local', now());

insert into public.shops (owner_id, name, slug, description)
values ('30000000-0000-4000-8000-000000000001', 'Evidencia Uno', 'evidencia-uno', 'Descripción completa para probar reseñas y disputas.');

insert into public.orders (buyer_id, shop_id, status, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, delivered_at, completed_at, fulfillment_method)
values (
  '30000000-0000-4000-8000-000000000002',
  (select id from public.shops where slug = 'evidencia-uno'),
  'completed', '30000000-0000-4000-8000-000000000091', 'MXN', 100, 1,
  'America/Mexico_City', now() - interval '100 days', now() - interval '100 days', 'shipping'
);

insert into public.order_addresses (order_id, recipient, address_line1, locality, administrative_area, postal_code, country_code)
values ((select id from public.orders), 'María López', 'Calle Uno 10', 'Guadalajara', 'Jalisco', '44100', 'MX');

insert into private.admin_users (user_id, granted_by)
values ('30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003');

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.create_order_review((select id from public.orders), 5, true, 'Todo coincidió con la descripción.')$$,
  'buyer reviews completed order'
);

select throws_ok(
  $$select public.create_order_review((select id from public.orders), 4, true, null)$$,
  '23505', null,
  'buyer cannot review same order twice'
);

select lives_ok(
  $$select public.open_order_dispute((select id from public.orders), 'item_not_as_described', 'El producto recibido no coincide.', '[]'::jsonb)$$,
  'buyer opens dispute with canonical reason'
);

set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select public.respond_to_dispute((select id from public.order_disputes), 'Comparto evidencia de entrega.', '[]'::jsonb)$$,
  'seller responds to owned-shop dispute'
);

select throws_ok(
  $$select public.resolve_order_dispute((select id from public.order_disputes), 'buyer_favor', true, 'Resolución no autorizada')$$,
  '42501', 'Solo administración puede resolver disputas.',
  'seller cannot resolve dispute'
);

set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000003';

select lives_ok(
  $$select public.resolve_order_dispute((select id from public.order_disputes), 'buyer_favor', true, 'La evidencia confirma incumplimiento.')$$,
  'admin resolves dispute and seller fault'
);

select results_eq(
  $$select seller_fault from public.order_disputes$$,
  array[true],
  'resolved dispute stores admin seller-fault decision'
);

reset role;

insert into public.orders (buyer_id, shop_id, status, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, delivered_at, fulfillment_method)
values (
  '30000000-0000-4000-8000-000000000002',
  (select id from public.shops where slug = 'evidencia-uno'),
  'delivered', '30000000-0000-4000-8000-000000000092', 'MXN', 50, 1,
  'America/Mexico_City', now() - interval '8 days', 'shipping'
);

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000002';

select lives_ok(
  $$select public.open_order_dispute(
    (select id from public.orders where idempotency_key = '30000000-0000-4000-8000-000000000092'),
    'item_not_received', 'El pedido aparece enviado pero no fue recibido.', '[]'::jsonb
  )$$,
  'buyer opens dispute on overdue delivered order'
);

reset role;

select is(private.auto_complete_orders(), 0, 'open dispute pauses seven-day automatic completion');

update public.order_disputes set resolved_at = now() - interval '100 days' where status = 'resolved';

select is(private.redact_expired_order_addresses(), 1, 'retention job redacts eligible completed-order address');

select results_eq(
  $$select count(*) from public.order_addresses where redacted_at is not null and recipient is null and address_line1 is null$$,
  array[1::bigint],
  'redaction removes identifying address fields'
);

select * from finish();
rollback;
