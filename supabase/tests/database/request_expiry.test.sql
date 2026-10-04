begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_column('public', 'orders', 'decide_by_at', 'orders keep the deadline a request must be decided by');

insert into auth.users (id, email, created_at) values
  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'expiry-seller@test.local', now()),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', 'expiry-buyer@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code, time_zone)
overriding system value
values (940, 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4', 'Tienda Plazos', 'tienda-plazos',
  'Descripción completa de la tienda para probar los plazos.', 'MX', 'America/Mexico_City');

update public.shops set is_publishing_approved = true where id = 940;

insert into public.products (id, shop_id, name, description, price_mxn, status, units_available, category_id, image_path)
overriding system value
values (840, 940, 'Jarra', 'Descripción completa de la jarra de barro.', 300, 'published', 10,
  (select id from public.categories where slug = 'celulares-y-accesorios'), 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4/jarra.webp');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- One request of one unit, placed by the buyer.
create function pg_temp.request() returns bigint language plpgsql as $$
declare v_id bigint;
begin
  perform pg_temp.act_as('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5');
  perform public.add_cart_item(840, 1);
  v_id := public.checkout_cart_v3(940, 'pickup', null, null, null, gen_random_uuid());
  execute 'reset role';
  return v_id;
end;
$$;

create temp table placed (label text primary key, id bigint);
-- Read while acting as the seller below.
grant select on placed to authenticated;
insert into placed values ('overdue', pg_temp.request());
insert into placed values ('fresh', pg_temp.request());
insert into placed values ('accepted', pg_temp.request());
insert into placed values ('late_accept', pg_temp.request());
insert into placed values ('late_reject', pg_temp.request());

create function pg_temp.order_id(p_label text) returns bigint language sql as $$
  select id from placed where label = p_label
$$;

-- 1. Every request gets 72 hours from the moment it is placed.
select is(
  (select decide_by_at from public.orders where id = pg_temp.order_id('fresh')),
  now() + interval '72 hours',
  'a new request must be decided within 72 hours'
);

select is(
  (select units_available from public.products where id = 840),
  5::smallint,
  'five requests hold five units'
);

-- 2. Accepting fixes the request's fate; its old deadline no longer applies.
select pg_temp.act_as('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4');
select public.accept_order(pg_temp.order_id('accepted'), gen_random_uuid());
reset role;

update public.orders set decide_by_at = now() - interval '1 minute'
where id in (pg_temp.order_id('overdue'), pg_temp.order_id('accepted'), pg_temp.order_id('late_accept'), pg_temp.order_id('late_reject'));

-- 3. A seller cannot accept once the deadline has passed, but may still say no.
select pg_temp.act_as('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4');

select throws_ok(
  format('select public.accept_order(%s, gen_random_uuid())', pg_temp.order_id('late_accept')),
  'P0001',
  'Esta solicitud ya venció.',
  'an overdue request cannot be accepted'
);

select lives_ok(
  format('select public.reject_order(%s, gen_random_uuid())', pg_temp.order_id('late_reject')),
  'an overdue request can still be rejected'
);
reset role;

-- 4. The sweep closes what is overdue and nothing else.
select is(private.expire_due_requests(), 2, 'the sweep expires every overdue request');

select is((select status from public.orders where id = pg_temp.order_id('overdue')), 'expired', 'an overdue request expires');
select is((select status from public.orders where id = pg_temp.order_id('late_accept')), 'expired', 'a refused late acceptance leaves the request to expire');
select is((select status from public.orders where id = pg_temp.order_id('fresh')), 'requested', 'a request within its window is left alone');
select is((select status from public.orders where id = pg_temp.order_id('accepted')), 'accepted', 'an accepted order never expires as a request');
select is((select status from public.orders where id = pg_temp.order_id('late_reject')), 'rejected', 'a rejected request stays rejected');

-- 5. An expired request gives its units back and says who closed it.
select is(
  (select units_available from public.products where id = 840),
  8::smallint,
  'expired and rejected requests return their units'
);

select is(
  (select stock_reserved from public.orders where id = pg_temp.order_id('overdue')),
  false,
  'an expired request no longer holds stock'
);

select results_eq(
  format($$select actor_type || '|' || previous_status || '|' || next_status from public.order_events
    where order_id = %s and event_type = 'expired'$$, pg_temp.order_id('overdue')),
  array['system|requested|expired'],
  'the timeline records that the plaza closed the request'
);

-- 6. Running again finds nothing new.
select is(private.expire_due_requests(), 0, 'the sweep is safe to run again');

-- 7. The sweep is scheduled, and nobody can call it from the app.
select is(
  (select count(*)::integer from cron.job where jobname = 'plaza-expire-requests'),
  1,
  'the sweep runs on a schedule'
);

select is(
  has_function_privilege('authenticated', 'private.expire_due_requests()', 'execute'),
  false,
  'signed-in users cannot run the sweep'
);

select * from finish();
rollback;
