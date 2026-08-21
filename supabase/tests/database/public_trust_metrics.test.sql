begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_function(
  'public',
  'shop_public_trust_metrics',
  array['bigint'],
  'public trust metrics RPC exists with its public signature'
);

insert into auth.users (id, email, created_at) values
  ('aaaa1111-aaaa-4aaa-8aaa-aaaa11111111', 'trust-owner@test.local', now()),
  ('bbbb2222-bbbb-4bbb-8bbb-bbbb22222222', 'trust-stranger@test.local', now());

insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('aaaa1111-aaaa-4aaa-8aaa-aaaa11111111', 'Medida', 'medida', 'Descripción completa de la tienda medida.', 'MX', array['MX-JAL']),
  ('aaaa1111-aaaa-4aaa-8aaa-aaaa11111111', 'Sin medir', 'sin-medir', 'Descripción completa de la tienda sin evaluar.', 'MX', array['MX-JAL']);

select results_eq(
  $$select count(*) from public.user_activity where user_id in ('aaaa1111-aaaa-4aaa-8aaa-aaaa11111111', 'bbbb2222-bbbb-4bbb-8bbb-bbbb22222222')$$,
  array[2::bigint],
  'a new account gets a presence row without visiting anything'
);

insert into public.user_activity (user_id, last_seen_at) values
  ('aaaa1111-aaaa-4aaa-8aaa-aaaa11111111', now())
on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;

insert into public.shop_trust_evaluations (
  shop_id, average_reply_time_minutes, response_rate, description_accuracy,
  on_time_shipping_rate, order_completion_rate, dispute_rate, total_orders,
  average_rating, review_count, last_active_days_ago, open_dispute_count,
  metric_qualified_tier, effective_tier, free_listing_limit, reasons,
  next_tier_requirements, summary, evaluated_at
) values
  ((select id from public.shops where slug = 'medida'), 90, 80, 80, 80, 80, 9, 5, 3.5, 2, 30, 0,
   'standard', 'standard', 15, '[]'::jsonb, '[]'::jsonb, 'Evaluación anterior.', now() - interval '2 days'),
  ((select id from public.shops where slug = 'medida'), 42, 98, 95, 100, 97, 2, 34, 4.8, 12, 1, 0,
   'reliable', 'reliable', 40, '["Motivo interno"]'::jsonb, '["Requisito interno"]'::jsonb, 'Resumen para la persona vendedora.', now());

set local role anon;

select results_eq(
  $$select response_rate, dispute_rate, total_orders, review_count
    from public.shop_public_trust_metrics((select id from public.shops where slug = 'medida'))$$,
  $$values (98::numeric, 2::numeric, 34::bigint, 12::bigint)$$,
  'anonymous visitors read the latest evaluation of a shop'
);

select results_eq(
  $$select count(*) from public.shop_public_trust_metrics((select id from public.shops where slug = 'sin-medir'))$$,
  array[1::bigint],
  'a shop that was never evaluated still reports a row, so presence can be shown'
);

select results_eq(
  $$select response_rate is null and total_orders is null
    from public.shop_public_trust_metrics((select id from public.shops where slug = 'sin-medir'))$$,
  array[true],
  'that row carries no invented measurements'
);

select results_eq(
  $$select seller_active_days_ago
    from public.shop_public_trust_metrics((select id from public.shops where slug = 'medida'))$$,
  array[0],
  'the seller who was just seen reads as active today'
);

select throws_ok(
  $$select count(*) from public.user_activity$$,
  '42501',
  null,
  'anonymous visitors never read presence timestamps'
);

select throws_ok(
  $$select count(*) from public.shop_trust_evaluations$$,
  '42501',
  null,
  'the evaluation table itself stays unreadable for anonymous visitors'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbb2222-bbbb-4bbb-8bbb-bbbb22222222", "role": "authenticated"}';

select results_eq(
  $$select count(*) from public.shop_trust_evaluations$$,
  array[0::bigint],
  'a signed in stranger still reads no evaluation rows directly'
);

select results_eq(
  $$select review_count from public.shop_public_trust_metrics((select id from public.shops where slug = 'medida'))$$,
  array[12::bigint],
  'that same stranger reads the public metrics through the function'
);

set local role postgres;

select results_eq(
  $$select count(*)
    from information_schema.routines
    where routine_schema = 'public'
      and routine_name = 'shop_public_trust_metrics'
      and routine_definition ilike '%summary%'$$,
  array[0::bigint],
  'the function never selects the seller facing summary'
);

select * from finish();
rollback;
