create table public.shop_trust_evaluation_queue (
  shop_id bigint primary key references public.shops (id) on delete cascade,
  dirty_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  locked_at timestamptz,
  last_success_at timestamptz
);

create table public.shop_trust_evaluations (
  id bigint generated always as identity primary key,
  shop_id bigint not null references public.shops (id) on delete cascade,
  average_reply_time_minutes numeric,
  response_rate numeric,
  description_accuracy numeric,
  on_time_shipping_rate numeric,
  order_completion_rate numeric,
  dispute_rate numeric,
  total_orders bigint,
  average_rating numeric,
  review_count bigint,
  last_active_days_ago integer,
  open_dispute_count bigint not null,
  metric_qualified_tier text not null check (metric_qualified_tier in ('standard', 'reliable', 'top_rated')),
  effective_tier text not null check (effective_tier in ('standard', 'reliable', 'top_rated')),
  free_listing_limit integer not null check (free_listing_limit in (15, 40, 100)),
  reasons jsonb not null check (jsonb_typeof(reasons) = 'array'),
  next_tier_requirements jsonb not null check (jsonb_typeof(next_tier_requirements) = 'array'),
  summary text not null,
  evaluator_policy_version text not null default '2026-08-20-v1',
  evaluated_at timestamptz not null default now()
);

create index shop_trust_queue_ready_idx on public.shop_trust_evaluation_queue (next_attempt_at, dirty_at);
create index shop_trust_evaluations_shop_time_idx on public.shop_trust_evaluations (shop_id, evaluated_at desc);

revoke all on table public.shop_trust_evaluation_queue from public, anon, authenticated;
grant select on table public.shop_trust_evaluations to authenticated;
grant usage, select on sequence public.shop_trust_evaluations_id_seq to authenticated;
alter table public.shop_trust_evaluation_queue enable row level security;
alter table public.shop_trust_evaluations enable row level security;

create policy trust_evaluations_owner_select on public.shop_trust_evaluations for select to authenticated
using (exists (select 1 from public.shops where shops.id = shop_trust_evaluations.shop_id and shops.owner_id = (select auth.uid())));

create function private.evaluate_trust_tier(
  p_average_reply_time_minutes numeric,
  p_response_rate numeric,
  p_description_accuracy numeric,
  p_on_time_shipping_rate numeric,
  p_order_completion_rate numeric,
  p_dispute_rate numeric,
  p_total_orders bigint,
  p_average_rating numeric,
  p_review_count bigint,
  p_last_active_days_ago integer
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_top boolean;
  v_reliable boolean;
  v_tier text;
  v_limit integer;
  v_reasons text[] := array[]::text[];
  v_next text[] := array[]::text[];
  v_summary text;
begin
  v_top := coalesce(
    p_total_orders >= 80
    and p_description_accuracy >= 97
    and p_dispute_rate <= 1.3
    and p_response_rate >= 96
    and p_on_time_shipping_rate >= 96
    and p_average_reply_time_minutes <= 120
    and p_order_completion_rate >= 98
    and p_review_count is not null
    and (p_review_count < 25 or (p_average_rating is not null and p_average_rating >= 4.8))
    and p_last_active_days_ago <= 14,
    false
  );

  v_reliable := coalesce(
    p_total_orders >= 25
    and p_description_accuracy >= 95
    and p_dispute_rate <= 2.5
    and p_response_rate >= 90
    and p_on_time_shipping_rate >= 92
    and p_average_reply_time_minutes <= 360
    and p_order_completion_rate >= 95
    and p_review_count is not null
    and (p_review_count < 10 or (p_average_rating is not null and p_average_rating >= 4.6))
    and p_last_active_days_ago <= 21,
    false
  );

  if v_top then
    v_tier := 'Top Rated'; v_limit := 100;
    v_reasons := array[
      format('Pedidos completados: %s; mínimo requerido: 80.', p_total_orders),
      format('Respuesta: %s%%; envíos puntuales: %s%%; disputas: %s%%.', p_response_rate, p_on_time_shipping_rate, p_dispute_rate)
    ];
    v_summary := 'La tienda alcanza Top Rated al cumplir todos los requisitos estrictos de rendimiento, servicio y actividad.';
  elsif v_reliable then
    v_tier := 'Reliable'; v_limit := 40;
    v_reasons := array[
      format('Pedidos completados: %s; mínimo Reliable: 25.', p_total_orders),
      format('Respuesta: %s%%; envíos puntuales: %s%%; disputas: %s%%.', p_response_rate, p_on_time_shipping_rate, p_dispute_rate)
    ];
    if p_total_orders is null or p_total_orders < 80 then v_next := array_append(v_next, format('Completa 80 pedidos; valor actual: %s.', coalesce(p_total_orders::text, 'sin datos'))); end if;
    if p_description_accuracy is null or p_description_accuracy < 97 then v_next := array_append(v_next, format('Alcanza 97%% de precisión; valor actual: %s%%.', coalesce(p_description_accuracy::text, 'sin datos'))); end if;
    if p_dispute_rate is null or p_dispute_rate > 1.3 then v_next := array_append(v_next, format('Reduce disputas a 1.3%% o menos; valor actual: %s%%.', coalesce(p_dispute_rate::text, 'sin datos'))); end if;
    if p_response_rate is null or p_response_rate < 96 then v_next := array_append(v_next, format('Alcanza 96%% de respuesta; valor actual: %s%%.', coalesce(p_response_rate::text, 'sin datos'))); end if;
    if p_on_time_shipping_rate is null or p_on_time_shipping_rate < 96 then v_next := array_append(v_next, format('Alcanza 96%% de envíos puntuales; valor actual: %s%%.', coalesce(p_on_time_shipping_rate::text, 'sin datos'))); end if;
    if p_average_reply_time_minutes is null or p_average_reply_time_minutes > 120 then v_next := array_append(v_next, format('Reduce respuesta promedio a 120 minutos; valor actual: %s.', coalesce(p_average_reply_time_minutes::text, 'sin datos'))); end if;
    if p_order_completion_rate is null or p_order_completion_rate < 98 then v_next := array_append(v_next, format('Alcanza 98%% de pedidos completados; valor actual: %s%%.', coalesce(p_order_completion_rate::text, 'sin datos'))); end if;
    if p_review_count is null then v_next := array_append(v_next, 'Registra un conteo válido de reseñas.');
    elsif p_review_count >= 25 and (p_average_rating is null or p_average_rating < 4.8) then v_next := array_append(v_next, format('Alcanza calificación 4.8; valor actual: %s.', coalesce(p_average_rating::text, 'sin datos'))); end if;
    if p_last_active_days_ago is null or p_last_active_days_ago > 14 then v_next := array_append(v_next, format('Mantén actividad dentro de 14 días; valor actual: %s.', coalesce(p_last_active_days_ago::text, 'sin datos'))); end if;
    v_summary := 'La tienda es Reliable y cumple todos los requisitos intermedios; puede avanzar cerrando las brechas indicadas.';
  else
    v_tier := 'Standard'; v_limit := 15;
    if p_total_orders is null or p_total_orders < 25 then v_next := array_append(v_next, format('Completa 25 pedidos; valor actual: %s.', coalesce(p_total_orders::text, 'sin datos'))); end if;
    if p_description_accuracy is null or p_description_accuracy < 95 then v_next := array_append(v_next, format('Alcanza 95%% de precisión; valor actual: %s%%.', coalesce(p_description_accuracy::text, 'sin datos'))); end if;
    if p_dispute_rate is null or p_dispute_rate > 2.5 then v_next := array_append(v_next, format('Reduce disputas a 2.5%% o menos; valor actual: %s%%.', coalesce(p_dispute_rate::text, 'sin datos'))); end if;
    if p_response_rate is null or p_response_rate < 90 then v_next := array_append(v_next, format('Alcanza 90%% de respuesta; valor actual: %s%%.', coalesce(p_response_rate::text, 'sin datos'))); end if;
    if p_on_time_shipping_rate is null or p_on_time_shipping_rate < 92 then v_next := array_append(v_next, format('Alcanza 92%% de envíos puntuales; valor actual: %s%%.', coalesce(p_on_time_shipping_rate::text, 'sin datos'))); end if;
    if p_average_reply_time_minutes is null or p_average_reply_time_minutes > 360 then v_next := array_append(v_next, format('Reduce respuesta promedio a 360 minutos; valor actual: %s.', coalesce(p_average_reply_time_minutes::text, 'sin datos'))); end if;
    if p_order_completion_rate is null or p_order_completion_rate < 95 then v_next := array_append(v_next, format('Alcanza 95%% de pedidos completados; valor actual: %s%%.', coalesce(p_order_completion_rate::text, 'sin datos'))); end if;
    if p_review_count is null then v_next := array_append(v_next, 'Registra un conteo válido de reseñas.');
    elsif p_review_count >= 10 and (p_average_rating is null or p_average_rating < 4.6) then v_next := array_append(v_next, format('Alcanza calificación 4.6; valor actual: %s.', coalesce(p_average_rating::text, 'sin datos'))); end if;
    if p_last_active_days_ago is null or p_last_active_days_ago > 21 then v_next := array_append(v_next, format('Mantén actividad dentro de 21 días; valor actual: %s.', coalesce(p_last_active_days_ago::text, 'sin datos'))); end if;
    v_reasons := case when cardinality(v_next) > 0 then v_next[1:least(3, cardinality(v_next))] else array['La tienda aún no cumple todos los requisitos de Reliable.'] end;
    v_summary := 'La tienda permanece en Standard mientras reúne evidencia suficiente para cumplir todos los requisitos de rendimiento.';
  end if;

  return jsonb_build_object(
    'trust_tier', v_tier,
    'free_listing_limit', v_limit,
    'reasons', to_jsonb(v_reasons),
    'next_tier_requirements', to_jsonb(v_next),
    'summary', v_summary
  );
end;
$$;

revoke execute on function private.evaluate_trust_tier(numeric,numeric,numeric,numeric,numeric,numeric,bigint,numeric,bigint,integer) from public, anon, authenticated;

create function private.enqueue_shop_trust_evaluation(p_shop_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.shop_trust_evaluation_queue (shop_id, dirty_at, next_attempt_at, attempt_count, last_error, locked_at)
  values (p_shop_id, now(), now(), 0, null, null)
  on conflict (shop_id) do update
  set dirty_at = excluded.dirty_at,
      next_attempt_at = least(public.shop_trust_evaluation_queue.next_attempt_at, excluded.next_attempt_at),
      last_error = null,
      locked_at = null
$$;

revoke execute on function private.enqueue_shop_trust_evaluation(bigint) from public, anon, authenticated;

create function private.mark_shop_trust_dirty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_shop_id bigint;
begin
  if tg_table_name = 'shops' then
    v_shop_id := new.id;
  else
    v_shop_id := coalesce(new.shop_id, old.shop_id);
  end if;
  if v_shop_id is not null then perform private.enqueue_shop_trust_evaluation(v_shop_id); end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function private.mark_shop_trust_dirty() from public, anon, authenticated;

create trigger dirty_trust_from_orders after insert or update on public.orders for each row execute function private.mark_shop_trust_dirty();
create trigger dirty_trust_from_shops after insert on public.shops for each row execute function private.mark_shop_trust_dirty();
create trigger dirty_trust_from_responses after insert or update on public.seller_response_events for each row execute function private.mark_shop_trust_dirty();
create trigger dirty_trust_from_reviews after insert or update or delete on public.order_reviews for each row execute function private.mark_shop_trust_dirty();
create trigger dirty_trust_from_disputes after insert or update on public.order_disputes for each row execute function private.mark_shop_trust_dirty();
create trigger dirty_trust_from_activity after insert on public.seller_activity_events for each row execute function private.mark_shop_trust_dirty();

create function private.evaluate_shop_trust(p_shop_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_average_reply numeric;
  v_response_rate numeric;
  v_description_accuracy numeric;
  v_shipping_rate numeric;
  v_completion_rate numeric;
  v_dispute_rate numeric;
  v_total_orders bigint;
  v_average_rating numeric;
  v_review_count bigint;
  v_last_active integer;
  v_open_disputes bigint;
  v_result jsonb;
  v_metric_key text;
  v_current_key text;
  v_effective_key text;
  v_effective_limit integer;
  v_reasons jsonb;
  v_next jsonb;
  v_summary text;
  v_id bigint;
  v_window timestamptz := now() - interval '90 days';
begin
  if not exists (select 1 from public.shops where id = p_shop_id) then raise exception using errcode = 'P0002', message = 'Tienda no encontrada.'; end if;

  select count(*) filter (where status = 'completed') into v_total_orders from public.orders where shop_id = p_shop_id;
  select count(*), avg(rating) into v_review_count, v_average_rating from public.order_reviews where shop_id = p_shop_id;

  select
    avg(elapsed_minutes) filter (where replied_at is not null and clock_started_at >= v_window),
    100.0 * count(*) filter (where replied_at is not null and answered_within_24_hours and clock_started_at >= v_window)
      / nullif(count(*) filter (where clock_started_at >= v_window and (replied_at is not null or clock_started_at <= now() - interval '24 hours')), 0)
  into v_average_reply, v_response_rate
  from public.seller_response_events where shop_id = p_shop_id;

  select 100.0 * count(*) filter (where matched_description) / nullif(count(*), 0)
  into v_description_accuracy from public.order_reviews where shop_id = p_shop_id and created_at >= v_window;

  select 100.0 * count(*) filter (where shipped_at is not null and shipped_at <= ship_by_at) / nullif(count(*), 0)
  into v_shipping_rate from public.orders
  where shop_id = p_shop_id and accepted_at >= v_window and ship_by_at is not null
    and (shipped_at is not null or (ship_by_at <= now() and status not in ('canceled_by_seller', 'canceled_by_admin')));

  select 100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0)
  into v_completion_rate from public.orders
  where shop_id = p_shop_id and accepted_at >= v_window
    and status in ('completed', 'canceled_by_seller', 'canceled_by_admin');

  select 100.0 * count(distinct d.order_id) filter (where d.seller_fault)
    / nullif(count(distinct o.id), 0)
  into v_dispute_rate
  from public.orders o left join public.order_disputes d on d.order_id = o.id and d.status = 'resolved'
  where o.shop_id = p_shop_id and coalesce(o.completed_at, o.canceled_at) >= v_window
    and (o.status = 'completed' or o.status in ('canceled_by_seller', 'canceled_by_admin'));

  select floor(extract(epoch from (now() - max(created_at))) / 86400)::integer
  into v_last_active from public.seller_activity_events where shop_id = p_shop_id;
  select count(*) into v_open_disputes from public.order_disputes where shop_id = p_shop_id and status <> 'resolved';

  v_result := private.evaluate_trust_tier(v_average_reply, v_response_rate, v_description_accuracy, v_shipping_rate, v_completion_rate, v_dispute_rate, v_total_orders, v_average_rating, v_review_count, v_last_active);
  v_metric_key := case v_result->>'trust_tier' when 'Top Rated' then 'top_rated' when 'Reliable' then 'reliable' else 'standard' end;
  select trust_tier into v_current_key from public.shops where id = p_shop_id for update;
  v_effective_key := v_metric_key;
  v_reasons := v_result->'reasons';
  v_next := v_result->'next_tier_requirements';
  v_summary := v_result->>'summary';

  if v_open_disputes > 0
    and (case v_metric_key when 'top_rated' then 3 when 'reliable' then 2 else 1 end)
      > (case v_current_key when 'top_rated' then 3 when 'reliable' then 2 else 1 end) then
    v_effective_key := v_current_key;
    v_reasons := v_reasons || jsonb_build_array(format('Promoción pausada por %s disputa(s) abierta(s).', v_open_disputes));
    v_next := v_next || jsonb_build_array('Resuelve todas las disputas abiertas para habilitar la promoción.');
    v_summary := 'La promoción de nivel está pausada mientras administración revisa una disputa abierta.';
  end if;
  v_effective_limit := case v_effective_key when 'top_rated' then 100 when 'reliable' then 40 else 15 end;

  insert into public.shop_trust_evaluations (
    shop_id, average_reply_time_minutes, response_rate, description_accuracy,
    on_time_shipping_rate, order_completion_rate, dispute_rate, total_orders,
    average_rating, review_count, last_active_days_ago, open_dispute_count,
    metric_qualified_tier, effective_tier, free_listing_limit, reasons,
    next_tier_requirements, summary
  ) values (
    p_shop_id, v_average_reply, v_response_rate, v_description_accuracy,
    v_shipping_rate, v_completion_rate, v_dispute_rate, v_total_orders,
    v_average_rating, v_review_count, v_last_active, v_open_disputes,
    v_metric_key, v_effective_key, v_effective_limit, v_reasons, v_next, v_summary
  ) returning id into v_id;

  update public.shops set trust_tier = v_effective_key, listing_limit = v_effective_limit,
    trust_evaluated_at = now() where id = p_shop_id;
  return v_id;
end;
$$;

revoke execute on function private.evaluate_shop_trust(bigint) from public, anon, authenticated;

create function private.process_shop_trust_queue(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_item record; v_processed integer := 0;
begin
  for v_item in
    select shop_id from public.shop_trust_evaluation_queue
    where next_attempt_at <= now()
    order by dirty_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  loop
    begin
      update public.shop_trust_evaluation_queue set locked_at = now() where shop_id = v_item.shop_id;
      perform private.evaluate_shop_trust(v_item.shop_id);
      delete from public.shop_trust_evaluation_queue where shop_id = v_item.shop_id;
      v_processed := v_processed + 1;
    exception when others then
      update public.shop_trust_evaluation_queue
      set attempt_count = attempt_count + 1,
          next_attempt_at = now() + make_interval(mins => least(60, (power(2, least(attempt_count + 1, 5)))::integer)),
          last_error = left(sqlerrm, 1000), locked_at = null
      where shop_id = v_item.shop_id;
    end;
  end loop;
  return v_processed;
end;
$$;

create function private.enqueue_all_shops()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  insert into public.shop_trust_evaluation_queue (shop_id, dirty_at, next_attempt_at, attempt_count, last_error, locked_at)
  select id, now(), now(), 0, null, null from public.shops
  on conflict (shop_id) do update set dirty_at = excluded.dirty_at, next_attempt_at = excluded.next_attempt_at, attempt_count = 0, last_error = null, locked_at = null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.process_shop_trust_queue(integer) from public, anon, authenticated;
revoke execute on function private.enqueue_all_shops() from public, anon, authenticated;

select private.enqueue_all_shops();

select cron.schedule(
  'plaza-process-trust-queue',
  '*/5 * * * *',
  'select private.process_shop_trust_queue()'
);

select cron.schedule(
  'plaza-refresh-all-shop-trust',
  '15 0 * * *',
  'select private.enqueue_all_shops()'
);
