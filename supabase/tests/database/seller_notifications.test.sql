begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

select has_table('private', 'notification_outbox', 'emails wait in a private outbox');
select has_table('public', 'notification_preferences', 'each person can switch emails off');

insert into auth.users (id, email, created_at) values
  ('a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7', 'avisos-tienda@test.local', now()),
  ('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', 'avisos-comprador@test.local', now()),
  ('c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9', 'avisos-silencio@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code, time_zone)
overriding system value
values
  (950, 'a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7', 'Tienda Avisos', 'tienda-avisos',
    'Descripción completa de la tienda para probar los avisos.', 'MX', 'America/Mexico_City'),
  (951, 'c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9', 'Tienda Silencio', 'tienda-silencio',
    'Descripción completa de la tienda que no quiere avisos.', 'MX', 'America/Mexico_City');

update public.shops set is_publishing_approved = true where id in (950, 951);

insert into public.products (id, shop_id, name, description, price_mxn, status, units_available, category_id, image_path)
overriding system value
values
  (850, 950, 'Florero', 'Descripción completa del florero de barro.', 400, 'published', 10,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7/florero.webp'),
  (851, 951, 'Cuenco', 'Descripción completa del cuenco de barro.', 150, 'published', 10,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9/cuenco.webp');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.request(p_shop bigint, p_product bigint, p_quantity integer) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  perform pg_temp.act_as('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8');
  perform public.add_cart_item(p_product, p_quantity);
  v_id := public.checkout_cart_v3(p_shop, 'pickup', null, null, null, gen_random_uuid());
  execute 'reset role';
  return v_id;
end;
$$;

create function pg_temp.say(p_sender uuid, p_conversation bigint) returns bigint language sql as $$
  insert into public.messages (conversation_id, sender_id, body, idempotency_key)
  values (p_conversation, p_sender, 'Hola, ¿sigue disponible?', gen_random_uuid())
  returning id
$$;

create function pg_temp.outbox(p_kind text, p_order bigint default null, p_conversation bigint default null) returns integer language sql as $$
  select count(*)::integer from private.notification_outbox
  where kind = p_kind
    and (p_order is null or order_id = p_order)
    and (p_conversation is null or conversation_id = p_conversation)
$$;

create temp table placed (label text primary key, id bigint);
-- Read while acting as a seller or the sender below.
grant select on placed to authenticated, service_role;
insert into placed values ('first', pg_temp.request(950, 850, 2));
insert into placed values ('soon', pg_temp.request(950, 850, 1));
insert into placed values ('silent', pg_temp.request(951, 851, 1));
create function pg_temp.order_id(p_label text) returns bigint language sql as $$
  select id from placed where label = p_label
$$;
create function pg_temp.thread(p_label text) returns bigint language sql as $$
  select id from public.conversations where order_id = pg_temp.order_id(p_label)
$$;

-- 1. Every request tells its shop owner, once.
select results_eq(
  format($$select recipient_id::text || '|' || dedupe_key from private.notification_outbox
    where kind = 'purchase_request' and order_id = %s$$, pg_temp.order_id('first')),
  array['a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7|purchase_request:' || pg_temp.order_id('first')],
  'a new request is queued for the shop owner'
);

-- 2. Buyer messages are throttled per conversation until the seller answers.
select pg_temp.say('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', pg_temp.thread('first'));
select is(pg_temp.outbox('buyer_message', null, pg_temp.thread('first')), 1, 'a buyer message is queued for the seller');

select pg_temp.say('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', pg_temp.thread('first'));
select is(pg_temp.outbox('buyer_message', null, pg_temp.thread('first')), 1, 'a second message in the same hour adds nothing');

select pg_temp.say('a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7', pg_temp.thread('first'));
select is(pg_temp.outbox('buyer_message', null, pg_temp.thread('first')), 1, 'the seller is never emailed about their own message');

select pg_temp.say('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', pg_temp.thread('first'));
select is(pg_temp.outbox('buyer_message', null, pg_temp.thread('first')), 2, 'after the seller answers, the next buyer message is emailed');

update private.notification_outbox set created_at = now() - interval '2 hours'
where kind = 'buyer_message' and conversation_id = pg_temp.thread('first');
select pg_temp.say('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', pg_temp.thread('first'));
select is(pg_temp.outbox('buyer_message', null, pg_temp.thread('first')), 3, 'an hour later an unanswered buyer is emailed about again');

-- 3. A request close to its deadline is flagged once.
update public.orders set decide_by_at = now() + interval '10 hours' where id = pg_temp.order_id('soon');
select ok(private.enqueue_expiring_request_notifications() >= 1, 'the warning sweep queues requests close to expiring');
select is(pg_temp.outbox('request_expiring', pg_temp.order_id('soon')), 1, 'a request with less than a day left is flagged');
select is(pg_temp.outbox('request_expiring', pg_temp.order_id('first')), 0, 'a request with days left is not');
select is(private.enqueue_expiring_request_notifications(), 0, 'each request is flagged only once');

-- 4. Claiming skips what no longer applies and leases the rest.
select pg_temp.act_as('a7a7a7a7-a7a7-4a7a-8a7a-a7a7a7a7a7a7');
select public.accept_order(pg_temp.order_id('soon'), gen_random_uuid());
reset role;
insert into public.notification_preferences (user_id, email_enabled) values ('c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9', false);

set local role service_role;
create temp table claimed as select * from public.claim_notification_batch(50);
reset role;
grant select on claimed to service_role;

select is((select count(*)::integer from claimed), 4, 'one request and three buyer messages are claimed');
select is(
  (select status from private.notification_outbox where kind = 'purchase_request' and order_id = pg_temp.order_id('soon')),
  'skipped',
  'a request the seller already accepted is not announced'
);
select is(
  (select status from private.notification_outbox where kind = 'request_expiring' and order_id = pg_temp.order_id('soon')),
  'skipped',
  'nor warned about'
);
select is(
  (select status from private.notification_outbox where order_id = pg_temp.order_id('silent')),
  'skipped',
  'a seller who switched emails off gets none'
);
select results_eq(
  format($$select recipient_email || '|' || shop_name || '|' || product_name || '|' || quantity from claimed
    where kind = 'purchase_request' and order_id = %s$$, pg_temp.order_id('first')),
  array['avisos-tienda@test.local|Tienda Avisos|Florero|2'],
  'a claimed row carries what its email needs'
);
select is(
  (select count(*)::integer from private.notification_outbox where status = 'sending' and attempts = 1 and locked_until > now()),
  4,
  'claimed rows are leased'
);

set local role service_role;
select is((select count(*)::integer from public.claim_notification_batch(50)), 0, 'a leased row is not claimed twice');
reset role;

-- 5. Completion: sent, retried later, or given up on.
create temp table picked as
select (select id from claimed where kind = 'purchase_request') as sent_id,
       (select min(id) from claimed where kind = 'buyer_message') as retry_id,
       (select max(id) from claimed where kind = 'buyer_message') as doomed_id;
grant select on picked to service_role;

set local role service_role;
select public.complete_notification((select sent_id from picked), true, null);
select public.complete_notification((select retry_id from picked), false, 'Resend 500');
reset role;
update private.notification_outbox set attempts = 5 where id = (select doomed_id from picked);
set local role service_role;
select public.complete_notification((select doomed_id from picked), false, 'Resend 422');
reset role;

select is((select status from private.notification_outbox where id = (select sent_id from picked)), 'sent', 'a delivered email is marked sent');
select results_eq(
  $$select status || '|' || (available_at = now() + interval '2 minutes')::text || '|' || last_error
    from private.notification_outbox where id = (select retry_id from picked)$$,
  array['pending|true|Resend 500'],
  'a failed send is retried after a growing delay'
);
select is((select status from private.notification_outbox where id = (select doomed_id from picked)), 'failed', 'a send that keeps failing is given up after five attempts');

-- A run that died mid-batch leaves leases that expire.
update private.notification_outbox set locked_until = now() - interval '1 second'
where status = 'sending';
set local role service_role;
select is((select count(*)::integer from public.claim_notification_batch(50)), 1, 'an expired lease is claimed again');
reset role;

-- 6. Only the service role may claim or complete.
select is(has_function_privilege('authenticated', 'public.claim_notification_batch(integer)', 'execute'), false, 'signed-in users cannot claim emails');
select is(has_function_privilege('authenticated', 'public.complete_notification(bigint, boolean, text)', 'execute'), false, 'nor complete them');
select is(has_function_privilege('service_role', 'public.claim_notification_batch(integer)', 'execute'), true, 'the sender can claim');

-- 7. Each person reads and writes only their own switch.
select pg_temp.act_as('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8');
select lives_ok(
  $$insert into public.notification_preferences (user_id, email_enabled) values ('b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b8b8', false)$$,
  'a person can switch their own emails off'
);
select is((select count(*)::integer from public.notification_preferences), 1, 'and sees no one else''s switch');
reset role;

-- 8. The dispatcher stays quiet until it is configured.
update private.notification_outbox set status = 'pending', available_at = now() - interval '1 second'
where id = (select retry_id from picked);
select is(private.dispatch_notifications(), null, 'without its secrets the dispatcher sends nothing');

select vault.create_secret('http://127.0.0.1:54321/functions/v1/send-notifications', 'notifications_function_url');
select vault.create_secret('token-de-prueba', 'notifications_dispatch_token');
select isnt(private.dispatch_notifications(), null, 'with its secrets and due emails it calls the sender');

select is(
  (select count(*)::integer from cron.job where jobname in ('plaza-dispatch-notifications', 'plaza-warn-expiring-requests')),
  2,
  'sending and warning both run on a schedule'
);

select * from finish();
rollback;
