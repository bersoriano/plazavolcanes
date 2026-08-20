begin;

create extension if not exists pgtap with schema extensions;

select plan(48);

select has_function(
  'private', 'evaluate_buyer_trust',
  array['date','text','bigint','numeric','numeric','numeric','numeric','numeric','numeric','numeric','numeric','numeric','numeric','integer'],
  'pure buyer trust evaluator exists'
);

select is(
  (select array_to_string(array_agg(key order by key), ',') from jsonb_object_keys(
    private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,80,90,60,75,14)
  ) key),
  'buyer_trust_tier,markers,member_since,next_tier_requirements,reasons,summary,verification_level',
  'evaluator returns exactly seven contract keys'
);

select is(
  (select array_to_string(array_agg(key order by key), ',') from jsonb_object_keys(
    private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,80,90,60,75,14)->'markers'
  ) key),
  'average_time_to_close,buyer_completion_rate,cancellation_rate,claim_rate,fast_closer_rate,payment_reliability,recent_activity,response_rate,review_rate,total_completed_purchases',
  'evaluator returns exactly ten supported markers'
);

select is(
  private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,80,90,60,75,14)->>'buyer_trust_tier',
  'Top Buyer',
  'exact Top Buyer boundaries qualify'
);

select is(
  private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,95,72,60,75,240,50,30)->>'buyer_trust_tier',
  'Reliable',
  'exact Reliable boundaries qualify'
);

select is(
  private.evaluate_buyer_trust('2026-01-01','unverified',4,100,0,0,0,100,1,100,100,1,100,1)->>'buyer_trust_tier',
  'New',
  'low history remains New'
);

select results_eq(
  $$select tier from (values
    (private.evaluate_buyer_trust('2026-01-01','verified',24,97,2,1,3,98,36,80,90,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,96.99,2,1,3,98,36,80,90,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,97,2.01,1,3,98,36,80,90,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3.01,98,36,80,90,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,97.99,36,80,90,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36.01,80,90,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,79.99,90,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,80,89.99,60,75,14)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,80,90,60,75,15)->>'buyer_trust_tier')
  ) cases(tier)$$,
  $$select 'Reliable'::text from generate_series(1,9)$$,
  'each Top Buyer threshold fails immediately below qualification'
);

select results_eq(
  $$select tier from (values
    (private.evaluate_buyer_trust('2026-01-01','basic',7,93,4,2,6,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,92.99,4,2,6,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4.01,2,6,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6.01,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,94.99,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,95,72.01,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,95,72,59.99,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,95,72,60,75,240,50,31)->>'buyer_trust_tier')
  ) cases(tier)$$,
  $$select 'New'::text from generate_series(1,8)$$,
  'each Reliable threshold fails immediately below qualification'
);

select results_eq(
  $$select tier from (values
    (private.evaluate_buyer_trust('2026-01-01','basic',null,93,4,2,6,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,null,4,2,6,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,null,2,6,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,null,95,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,null,72,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,95,null,60,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,95,72,null,75,240,50,30)->>'buyer_trust_tier'),
    (private.evaluate_buyer_trust('2026-01-01','basic',8,93,4,2,6,95,72,60,75,240,50,null)->>'buyer_trust_tier')
  ) cases(tier)$$,
  $$select 'New'::text from generate_series(1,8)$$,
  'null required inputs fail higher tiers'
);

select is(private.evaluate_buyer_trust('2026-01-01','verified',null,null,null,null,null,null,null,null,null,null,null,null)->'markers'->'average_time_to_close'->>'signal', 'No data', 'null metric has No data signal');
select is(private.evaluate_buyer_trust('2026-01-01','verified',8,93,4,2,6,95,24,60,75,240,50,30)->'markers'->'average_time_to_close'->>'signal', 'Excellent', '24 close hours is Excellent');
select is(private.evaluate_buyer_trust('2026-01-01','verified',8,93,4,2,6,95,25,60,75,240,50,30)->'markers'->'average_time_to_close'->>'signal', 'Good', '25 close hours is Good');
select is(private.evaluate_buyer_trust('2026-01-01','verified',8,93,4,2,6,95,49,60,75,240,50,30)->'markers'->'average_time_to_close'->>'signal', 'Average', '49 close hours is Average');
select is(private.evaluate_buyer_trust('2026-01-01','verified',8,93,4,2,6,95,73,60,75,240,50,30)->'markers'->'average_time_to_close'->>'signal', 'Needs improvement', '73 close hours needs improvement');
select is(private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,80,90,60,75,14)->'markers'->'fast_closer_rate'->>'signal', 'Excellent', '80 fast closer rate is Excellent');
select is(private.evaluate_buyer_trust('2026-01-01','verified',8,93,4,2,6,95,72,60,75,240,50,30)->'markers'->'fast_closer_rate'->>'signal', 'Good', '60 fast closer rate is Good');
select is(private.evaluate_buyer_trust('2026-01-01','verified',8,93,4,2,6,95,72,40,75,240,50,30)->'markers'->'fast_closer_rate'->>'signal', 'Average', '40 fast closer rate is Average');
select is(private.evaluate_buyer_trust('2026-01-01','verified',8,93,4,2,6,95,72,39.99,75,240,50,30)->'markers'->'fast_closer_rate'->>'signal', 'Needs improvement', 'fast closer below 40 needs improvement');

select is(private.evaluate_buyer_trust('2026-01-05','verified',8,93,4,2,6,95,72,60,75,240,50,30)->'member_since'->>'primary_text', 'Miembro desde enero de 2026', 'member since uses Spanish month and omits day');
select is(private.evaluate_buyer_trust('2026-01-05','verified',8,93,4,2,6,95,72,60,75,240,50,30)->'verification_level'->>'primary_text', 'Comprador verificado', 'verification copy is Spanish');

select ok(
  not exists (
    select 1 from jsonb_each(private.evaluate_buyer_trust('2026-01-05','verified',8,93,4,2,6,95,72,60,75,240,50,30)->'markers') marker
    where array_length(regexp_split_to_array(marker.value->>'tooltip', '\s+'), 1) > 22
  ),
  'all marker tooltips contain at most 22 words'
);
select ok(array_length(regexp_split_to_array(private.evaluate_buyer_trust('2026-01-05','verified',8,93,4,2,6,95,72,60,75,240,50,30)->>'summary', '\s+'), 1) <= 35, 'summary contains at most 35 words');
select ok(private.evaluate_buyer_trust('2026-01-05','verified',7,92,5,2,7,94,73,59,70,240,20,31)->'next_tier_requirements'->>0 like '%7%', 'next-tier gap references actual value');
select ok(jsonb_array_length(private.evaluate_buyer_trust('2026-01-05','verified',25,97,2,1,3,98,36,80,90,60,75,14)->'next_tier_requirements') = 0, 'Top Buyer has no next-tier gaps');

select has_table('public', 'buyer_trust_profiles', 'buyer trust cache exists');
select has_table('public', 'buyer_trust_evaluations', 'buyer trust history exists');
select has_table('private', 'buyer_trust_evaluation_queue', 'private buyer trust queue exists');

insert into auth.users (id, email, created_at) values
  ('60000000-0000-4000-8000-000000000001', 'buyer-tier-seller@test.local', '2026-01-05'),
  ('60000000-0000-4000-8000-000000000002', 'buyer-tier-buyer@test.local', '2026-01-05'),
  ('60000000-0000-4000-8000-000000000003', 'buyer-tier-other@test.local', '2026-01-05');

insert into public.shops (owner_id, name, slug, description)
values ('60000000-0000-4000-8000-000000000001', 'Compradores Uno', 'compradores-uno', 'Descripción completa para probar perfiles de confianza de compradores.');

select results_eq($$select count(*) from public.buyer_trust_profiles where buyer_id::text like '60000000-%'$$, array[3::bigint], 'registration creates buyer trust cache for every user');
select results_eq($$select count(*) from private.buyer_trust_evaluation_queue where buyer_id::text like '60000000-%'$$, array[3::bigint], 'registration queues each buyer once');
select is(private.process_buyer_trust_queue(), 3, 'queue worker evaluates ready profiles');
select results_eq($$select count(*) from public.buyer_trust_evaluations where buyer_id::text like '60000000-%'$$, array[3::bigint], 'successful evaluation appends history');
select results_eq($$select count(*) from private.buyer_trust_evaluation_queue where buyer_id::text like '60000000-%'$$, array[0::bigint], 'successful evaluation clears queue');
select results_eq($$select buyer_trust_tier from public.buyer_trust_profiles where buyer_id = '60000000-0000-4000-8000-000000000002'$$, array['new'::text], 'empty buyer evaluates New');

select private.enqueue_buyer_trust_evaluation('60000000-0000-4000-8000-000000000002');
select private.enqueue_buyer_trust_evaluation('60000000-0000-4000-8000-000000000002');
select results_eq($$select count(*) from private.buyer_trust_evaluation_queue where buyer_id = '60000000-0000-4000-8000-000000000002'$$, array[1::bigint], 'queue deduplicates repeated requests');

create function private.test_reject_buyer_trust_evaluation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'forced buyer evaluator failure'; end;
$$;
create trigger test_reject_buyer_trust_evaluation before insert on public.buyer_trust_evaluations
for each row execute function private.test_reject_buyer_trust_evaluation();

select is(private.process_buyer_trust_queue(), 0, 'failed evaluation is not counted as processed');
select results_eq($$select count(*) from public.buyer_trust_evaluations where buyer_id = '60000000-0000-4000-8000-000000000002'$$, array[1::bigint], 'failed evaluation preserves last history');
select results_eq($$select buyer_trust_tier from public.buyer_trust_profiles where buyer_id = '60000000-0000-4000-8000-000000000002'$$, array['new'::text], 'failed evaluation preserves cache');
select results_eq($$select attempt_count from private.buyer_trust_evaluation_queue where buyer_id = '60000000-0000-4000-8000-000000000002' and last_error like '%forced buyer evaluator failure%'$$, array[1], 'failed evaluation retains retry evidence');

drop trigger test_reject_buyer_trust_evaluation on public.buyer_trust_evaluations;
drop function private.test_reject_buyer_trust_evaluation();
delete from private.buyer_trust_evaluation_queue;

insert into public.orders (
  buyer_id, shop_id, status, idempotency_key, currency_code, subtotal,
  handling_days, handling_time_zone, accepted_at, payment_completed_at,
  payment_confirmed_by, shipped_at, delivered_at, completed_at
)
select '60000000-0000-4000-8000-000000000002', s.id, 'completed', gen_random_uuid(), 'MXN', 100,
  1, 'America/Mexico_City', now() - interval '10 days', now() - interval '9 days',
  '60000000-0000-4000-8000-000000000001', now() - interval '8 days', now() - interval '7 days', now() - interval '6 days'
from public.shops s where s.slug = 'compradores-uno';

insert into public.orders (
  buyer_id, shop_id, status, idempotency_key, currency_code, subtotal,
  handling_days, handling_time_zone, accepted_at, shipped_at, delivered_at, completed_at
)
select '60000000-0000-4000-8000-000000000002', s.id, 'completed', gen_random_uuid(), 'MXN', 100,
  1, 'America/Mexico_City', now() - interval '10 days', now() - interval '8 days', now() - interval '7 days', now() - interval '6 days'
from public.shops s where s.slug = 'compradores-uno';

insert into public.orders (
  buyer_id, shop_id, status, idempotency_key, currency_code, subtotal,
  handling_days, handling_time_zone, accepted_at, canceled_at, canceled_by
)
select '60000000-0000-4000-8000-000000000002', s.id, 'canceled_by_buyer', gen_random_uuid(), 'MXN', 100,
  1, 'America/Mexico_City', now() - interval '5 days', now() - interval '4 days', '60000000-0000-4000-8000-000000000002'
from public.shops s where s.slug = 'compradores-uno';

insert into public.orders (
  buyer_id, shop_id, status, idempotency_key, currency_code, subtotal,
  handling_days, handling_time_zone, accepted_at, canceled_at, canceled_by, seller_cancellation_reason
)
select '60000000-0000-4000-8000-000000000002', s.id, 'canceled_by_seller', gen_random_uuid(), 'MXN', 100,
  1, 'America/Mexico_City', now() - interval '5 days', now() - interval '4 days',
  '60000000-0000-4000-8000-000000000001', 'buyer_non_payment'
from public.shops s where s.slug = 'compradores-uno';

insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, created_at)
select id, '60000000-0000-4000-8000-000000000001', 'seller', 'shipped', 'accepted', 'shipped', shipped_at
from public.orders where buyer_id = '60000000-0000-4000-8000-000000000002' and status = 'completed';

insert into public.order_reviews (order_id, buyer_id, shop_id, rating, matched_description)
select id, buyer_id, shop_id, 5, true from public.orders
where buyer_id = '60000000-0000-4000-8000-000000000002' and status = 'completed' order by id limit 1;

insert into public.order_disputes (
  order_id, shop_id, buyer_id, reason, status, buyer_statement, admin_resolver_id,
  resolution, resolution_notes, seller_fault, resolved_at
)
select id, shop_id, buyer_id, 'other', 'resolved', 'Reclamo revisado',
  '60000000-0000-4000-8000-000000000003', 'buyer_favor', 'Responsabilidad confirmada', true, now()
from public.orders where buyer_id = '60000000-0000-4000-8000-000000000002' and status = 'completed' order by id limit 1;

select private.evaluate_buyer_trust_profile('60000000-0000-4000-8000-000000000002');

select results_eq($$select (input->>'total_completed_purchases')::numeric from public.buyer_trust_evaluations where buyer_id = '60000000-0000-4000-8000-000000000002' order by id desc limit 1$$, array[2::numeric], 'aggregation counts completed purchases for lifetime');
select results_eq($$select round((input->>'buyer_completion_rate')::numeric, 2) from public.buyer_trust_evaluations where buyer_id = '60000000-0000-4000-8000-000000000002' order by id desc limit 1$$, array[50::numeric], 'completion denominator includes completed and both trust-eligible cancellation paths');
select results_eq($$select round((input->>'cancellation_rate')::numeric, 2) from public.buyer_trust_evaluations where buyer_id = '60000000-0000-4000-8000-000000000002' order by id desc limit 1$$, array[25::numeric], 'cancellation numerator includes accepted buyer cancellations only');
select results_eq($$select round((input->>'payment_reliability')::numeric, 2) from public.buyer_trust_evaluations where buyer_id = '60000000-0000-4000-8000-000000000002' order by id desc limit 1$$, array[50::numeric], 'payment reliability compares confirmed payments with confirmed non-payment');
select results_eq($$select round((input->>'claim_rate')::numeric, 2) from public.buyer_trust_evaluations where buyer_id = '60000000-0000-4000-8000-000000000002' order by id desc limit 1$$, array[50::numeric], 'claim denominator uses all first-shipped orders');
select results_eq($$select round((input->>'review_rate')::numeric, 2) from public.buyer_trust_evaluations where buyer_id = '60000000-0000-4000-8000-000000000002' order by id desc limit 1$$, array[50::numeric], 'review rate uses completed-order cohort');

set local role authenticated;
set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000001';
select results_eq($$select count(*) from public.buyer_trust_profiles where buyer_id = '60000000-0000-4000-8000-000000000002'$$, array[1::bigint], 'shared-order seller can read buyer trust profile');
set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000003';
select is_empty($$select * from public.buyer_trust_profiles where buyer_id = '60000000-0000-4000-8000-000000000002'$$, 'unrelated user cannot read buyer trust profile');
reset role;

select private.enqueue_all_buyer_trust_profiles();
select results_eq($$select count(*) from private.buyer_trust_evaluation_queue$$, $$select count(*) from public.buyer_trust_profiles$$, 'daily sweep queues every profile including stale profiles');
select results_eq(
  $$select jobname || ':' || schedule from cron.job where jobname in ('plaza-process-buyer-trust-queue','plaza-refresh-all-buyer-trust') order by jobname$$,
  array['plaza-process-buyer-trust-queue:*/5 * * * *'::text, 'plaza-refresh-all-buyer-trust:30 0 * * *'::text],
  'named queue and stale-profile schedules are active'
);

select * from finish();
rollback;
