begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_table('public', 'shop_trust_evaluation_queue', 'trust evaluation queue exists');
select has_table('public', 'shop_trust_evaluations', 'trust evaluation history exists');
select has_function(
  'private', 'evaluate_trust_tier',
  array['numeric','numeric','numeric','numeric','numeric','numeric','bigint','numeric','bigint','integer'],
  'pure trust evaluator exists'
);

select is(
  (select array_to_string(array_agg(key order by key), ',') from jsonb_object_keys(private.evaluate_trust_tier(120,96,97,96,98,1.3,80,4.8,25,14)) key),
  'free_listing_limit,next_tier_requirements,reasons,summary,trust_tier',
  'evaluator returns exactly five contract keys'
);

select is(
  private.evaluate_trust_tier(120,96,97,96,98,1.3,80,4.8,25,14)->>'trust_tier',
  'Top Rated',
  'exact Top Rated boundaries qualify'
);

select is(
  (private.evaluate_trust_tier(120,96,97,96,98,1.3,80,4.8,25,14)->>'free_listing_limit')::integer,
  100,
  'Top Rated receives 100 free listings'
);

select is(
  jsonb_array_length(private.evaluate_trust_tier(120,96,97,96,98,1.3,80,4.8,25,14)->'next_tier_requirements'),
  0,
  'Top Rated has no next-tier gaps'
);

select is(
  private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.6,10,21)->>'trust_tier',
  'Reliable',
  'exact Reliable boundaries qualify'
);

select is(
  (private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.6,10,21)->>'free_listing_limit')::integer,
  40,
  'Reliable receives 40 free listings'
);

select is(
  private.evaluate_trust_tier(null,90,95,92,95,2.5,25,4.6,10,21)->>'trust_tier',
  'Standard',
  'null applicable metric fails higher tier'
);

select is(
  private.evaluate_trust_tier(360,90,95,92,95,2.5,25,null,9,21)->>'trust_tier',
  'Reliable',
  'rating gate is waived below ten reviews'
);

select is(
  private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.59,10,21)->>'trust_tier',
  'Standard',
  'rating below 4.6 fails once ten reviews exist'
);

select is(
  private.evaluate_trust_tier(120,96,97,96,98,1.3,80,4.79,24,14)->>'trust_tier',
  'Top Rated',
  'Top Rated rating gate is waived below 25 reviews'
);

select is(
  private.evaluate_trust_tier(121,96,97,96,98,1.3,80,4.8,25,14)->>'trust_tier',
  'Reliable',
  'one failed Top Rated gate falls to Reliable'
);

select is(
  private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.6,null,21)->>'trust_tier',
  'Standard',
  'null review count fails higher-tier qualification'
);

select ok(
  array_length(regexp_split_to_array(private.evaluate_trust_tier(null,null,null,null,null,null,null,null,null,null)->>'summary', '\s+'), 1) <= 35,
  'summary contains at most 35 words'
);

select ok(
  jsonb_array_length(private.evaluate_trust_tier(null,null,null,null,null,null,null,null,null,null)->'reasons') > 0,
  'Standard output explains missing evidence'
);

select results_eq(
  $$select tier from (values
    ('activity', private.evaluate_trust_tier(120,96,97,96,98,1.3,80,4.8,25,15)->>'trust_tier'),
    ('accuracy', private.evaluate_trust_tier(120,96,96.99,96,98,1.3,80,4.8,25,14)->>'trust_tier'),
    ('completion', private.evaluate_trust_tier(120,96,97,96,97.99,1.3,80,4.8,25,14)->>'trust_tier'),
    ('disputes', private.evaluate_trust_tier(120,96,97,96,98,1.31,80,4.8,25,14)->>'trust_tier'),
    ('orders', private.evaluate_trust_tier(120,96,97,96,98,1.3,79,4.8,25,14)->>'trust_tier'),
    ('rating', private.evaluate_trust_tier(120,96,97,96,98,1.3,80,4.79,25,14)->>'trust_tier'),
    ('reply', private.evaluate_trust_tier(121,96,97,96,98,1.3,80,4.8,25,14)->>'trust_tier'),
    ('response', private.evaluate_trust_tier(120,95.99,97,96,98,1.3,80,4.8,25,14)->>'trust_tier'),
    ('shipping', private.evaluate_trust_tier(120,96,97,95.99,98,1.3,80,4.8,25,14)->>'trust_tier')
  ) cases(name, tier) order by name$$,
  $$select 'Reliable'::text from generate_series(1, 9)$$,
  'each Top Rated threshold fails on the immediately lower side'
);

select results_eq(
  $$select tier from (values
    ('activity', private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.6,10,22)->>'trust_tier'),
    ('accuracy', private.evaluate_trust_tier(360,90,94.99,92,95,2.5,25,4.6,10,21)->>'trust_tier'),
    ('completion', private.evaluate_trust_tier(360,90,95,92,94.99,2.5,25,4.6,10,21)->>'trust_tier'),
    ('disputes', private.evaluate_trust_tier(360,90,95,92,95,2.51,25,4.6,10,21)->>'trust_tier'),
    ('orders', private.evaluate_trust_tier(360,90,95,92,95,2.5,24,4.6,10,21)->>'trust_tier'),
    ('rating', private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.59,10,21)->>'trust_tier'),
    ('reply', private.evaluate_trust_tier(361,90,95,92,95,2.5,25,4.6,10,21)->>'trust_tier'),
    ('response', private.evaluate_trust_tier(360,89.99,95,92,95,2.5,25,4.6,10,21)->>'trust_tier'),
    ('shipping', private.evaluate_trust_tier(360,90,95,91.99,95,2.5,25,4.6,10,21)->>'trust_tier')
  ) cases(name, tier) order by name$$,
  $$select 'Standard'::text from generate_series(1, 9)$$,
  'each Reliable threshold fails on the immediately lower side'
);

select results_eq(
  $$select tier from (values
    ('activity', private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.6,10,null)->>'trust_tier'),
    ('accuracy', private.evaluate_trust_tier(360,90,null,92,95,2.5,25,4.6,10,21)->>'trust_tier'),
    ('completion', private.evaluate_trust_tier(360,90,95,92,null,2.5,25,4.6,10,21)->>'trust_tier'),
    ('disputes', private.evaluate_trust_tier(360,90,95,92,95,null,25,4.6,10,21)->>'trust_tier'),
    ('orders', private.evaluate_trust_tier(360,90,95,92,95,2.5,null,4.6,10,21)->>'trust_tier'),
    ('rating', private.evaluate_trust_tier(360,90,95,92,95,2.5,25,null,10,21)->>'trust_tier'),
    ('reply', private.evaluate_trust_tier(null,90,95,92,95,2.5,25,4.6,10,21)->>'trust_tier'),
    ('response', private.evaluate_trust_tier(360,null,95,92,95,2.5,25,4.6,10,21)->>'trust_tier'),
    ('reviews', private.evaluate_trust_tier(360,90,95,92,95,2.5,25,4.6,null,21)->>'trust_tier'),
    ('shipping', private.evaluate_trust_tier(360,90,95,null,95,2.5,25,4.6,10,21)->>'trust_tier')
  ) cases(name, tier) order by name$$,
  $$select 'Standard'::text from generate_series(1, 10)$$,
  'each missing input fails directly applicable Reliable requirements'
);

insert into auth.users (id, email, created_at) values
  ('40000000-0000-4000-8000-000000000001', 'tier-seller@test.local', now()),
  ('40000000-0000-4000-8000-000000000002', 'tier-buyer@test.local', now()),
  ('40000000-0000-4000-8000-000000000003', 'tier-admin@test.local', now());

insert into public.shops (owner_id, name, slug, description)
values ('40000000-0000-4000-8000-000000000001', 'Nivel Uno', 'nivel-uno', 'Descripción completa para probar evaluación de confianza.');

select results_eq(
  $$select count(*) from public.shop_trust_evaluation_queue where shop_id = (select id from public.shops where slug = 'nivel-uno')$$,
  array[1::bigint],
  'new shop is queued for initial evaluation'
);

select is(private.process_shop_trust_queue(), 1, 'queue worker evaluates ready shop');

select results_eq(
  $$select count(*) from public.shop_trust_evaluations where shop_id = (select id from public.shops where slug = 'nivel-uno')$$,
  array[1::bigint],
  'successful evaluation appends history'
);

select results_eq(
  $$select count(*) from public.shop_trust_evaluation_queue where shop_id = (select id from public.shops where slug = 'nivel-uno')$$,
  array[0::bigint],
  'successful evaluation clears queue row'
);

select results_eq(
  $$select trust_tier || ':' || listing_limit from public.shops where slug = 'nivel-uno'$$,
  array['standard:15'::text],
  'empty shop evaluates to Standard 15'
);

select private.enqueue_shop_trust_evaluation((select id from public.shops where slug = 'nivel-uno'));
select private.enqueue_shop_trust_evaluation((select id from public.shops where slug = 'nivel-uno'));

select results_eq(
  $$select count(*) from public.shop_trust_evaluation_queue where shop_id = (select id from public.shops where slug = 'nivel-uno')$$,
  array[1::bigint],
  'dirty queue deduplicates repeated evaluation requests'
);

create function private.test_reject_trust_evaluation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'forced evaluator failure';
end;
$$;

create trigger test_reject_trust_evaluation
before insert on public.shop_trust_evaluations
for each row execute function private.test_reject_trust_evaluation();

select is(private.process_shop_trust_queue(), 0, 'failed evaluation is not counted as processed');

select results_eq(
  $$select count(*) from public.shop_trust_evaluations where shop_id = (select id from public.shops where slug = 'nivel-uno')$$,
  array[1::bigint],
  'failed evaluation preserves last history snapshot'
);

select results_eq(
  $$select trust_tier || ':' || listing_limit from public.shops where slug = 'nivel-uno'$$,
  array['standard:15'::text],
  'failed evaluation preserves cached tier and limit'
);

select results_eq(
  $$select attempt_count from public.shop_trust_evaluation_queue where shop_id = (select id from public.shops where slug = 'nivel-uno') and last_error like '%forced evaluator failure%'$$,
  array[1],
  'failed evaluation remains queued with retry evidence'
);

drop trigger test_reject_trust_evaluation on public.shop_trust_evaluations;
drop function private.test_reject_trust_evaluation();
delete from public.shop_trust_evaluation_queue;

insert into public.orders (
  buyer_id, shop_id, status, idempotency_key, currency_code, subtotal,
  handling_days, handling_time_zone, accepted_at, ship_by_at, shipped_at,
  delivered_at, completed_at, created_at
)
select
  '40000000-0000-4000-8000-000000000002', s.id, 'completed', gen_random_uuid(),
  'MXN', 100, 1, 'America/Mexico_City', now() - interval '10 days',
  now() - interval '8 days', now() - interval '9 days', now() - interval '8 days',
  now() - interval '7 days', now() - interval '10 days'
from public.shops s cross join generate_series(1, 80)
where s.slug = 'nivel-uno';

insert into public.order_reviews (order_id, buyer_id, shop_id, rating, matched_description, created_at)
select id, buyer_id, shop_id, 5, true, now() - interval '6 days'
from public.orders order by id limit 25;

insert into public.messages (conversation_id, sender_id, body, idempotency_key, created_at)
values (
  (select id from public.conversations order by id limit 1),
  '40000000-0000-4000-8000-000000000002', '¿Cuándo envías?', gen_random_uuid(), now() - interval '60 minutes'
), (
  (select id from public.conversations order by id limit 1),
  '40000000-0000-4000-8000-000000000001', 'Ya quedó enviado.', gen_random_uuid(), now()
);

insert into public.order_disputes (order_id, shop_id, buyer_id, reason, buyer_statement)
select id, shop_id, buyer_id, 'other', 'Administración revisa este pedido completado.'
from public.orders order by id limit 1;

select private.evaluate_shop_trust((select id from public.shops where slug = 'nivel-uno'));

select results_eq(
  $$select metric_qualified_tier from public.shop_trust_evaluations where shop_id = (select id from public.shops where slug = 'nivel-uno') order by evaluated_at desc, id desc limit 1$$,
  array['top_rated'::text],
  'auditable metrics qualify shop for Top Rated'
);

select results_eq(
  $$select effective_tier from public.shop_trust_evaluations where shop_id = (select id from public.shops where slug = 'nivel-uno') order by evaluated_at desc, id desc limit 1$$,
  array['standard'::text],
  'open dispute blocks promotion and preserves current tier'
);

update public.order_disputes set status = 'resolved', admin_resolver_id = '40000000-0000-4000-8000-000000000003', resolution = 'dismissed', resolution_notes = 'Evidencia insuficiente para atribuir responsabilidad.', seller_fault = false, resolved_at = now();

select private.evaluate_shop_trust((select id from public.shops where slug = 'nivel-uno'));

select results_eq(
  $$select trust_tier || ':' || listing_limit from public.shops where slug = 'nivel-uno'$$,
  array['top_rated:100'::text],
  'resolved dispute allows Top Rated promotion and 100 listings'
);

select results_eq(
  $$select count(*) from public.shop_trust_evaluations where shop_id = (select id from public.shops where slug = 'nivel-uno')$$,
  array[3::bigint],
  'each successful evaluation preserves append-only history'
);

select private.enqueue_all_shops();

select results_eq(
  $$select count(*) from public.shop_trust_evaluation_queue$$,
  $$select count(*) from public.shops$$,
  'daily sweep function deduplicates and queues every shop'
);

select results_eq(
  $$select jobname || ':' || schedule from cron.job where jobname in ('plaza-process-trust-queue', 'plaza-refresh-all-shop-trust') order by jobname$$,
  array['plaza-process-trust-queue:*/5 * * * *'::text, 'plaza-refresh-all-shop-trust:15 0 * * *'::text],
  'named queue and daily refresh schedules are active'
);

select * from finish();
rollback;
