-- A purchase request waits 72 hours for the seller. After that it expires on its
-- own, its reserved units go back on the shelf, and the buyer is free to ask
-- again. Until now a request stayed pending until somebody acted, so a seller
-- who never looked kept the buyer, and the units, waiting indefinitely.

alter table public.orders drop constraint orders_status_check;
alter table public.orders
  add constraint orders_status_check check (status in (
    'requested', 'accepted', 'shipped', 'delivered', 'completed',
    'rejected', 'canceled_by_buyer', 'canceled_by_seller', 'canceled_by_admin',
    'expired'
  ));

alter table public.order_events drop constraint order_events_event_type_check;
alter table public.order_events
  add constraint order_events_event_type_check check (event_type in (
    'requested', 'accepted', 'rejected', 'payment_confirmed', 'shipped', 'delivered',
    'completed', 'auto_completed', 'canceled_by_buyer', 'canceled_by_seller',
    'canceled_by_admin', 'admin_delivery_confirmed', 'admin_repair', 'expired'
  ));

-- Requests already waiting get a full window from now rather than expiring the
-- moment this ships. The default then dates every new order from its checkout,
-- which is why checkout itself does not change.
alter table public.orders add column decide_by_at timestamptz;
update public.orders set decide_by_at = now() + interval '72 hours' where status = 'requested';
alter table public.orders alter column decide_by_at set default now() + interval '72 hours';

create index orders_decide_by_idx on public.orders (decide_by_at) where status = 'requested';

-- The plaza closes the request, so the event has no actor. Locked rows are
-- skipped: a seller deciding right now wins, and the next run sees the rest.
create or replace function private.expire_due_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  with due as (
    select o.id
    from public.orders o
    where o.status = 'requested' and o.decide_by_at <= now()
    order by o.id
    for update skip locked
  ), expired as (
    update public.orders o
    set status = 'expired', updated_at = now()
    from due
    where o.id = due.id
    returning o.id
  )
  insert into public.order_events (order_id, actor_type, event_type, previous_status, next_status)
  select expired.id, 'system', 'expired', 'requested', 'expired' from expired;

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function private.expire_due_requests() from public, anon, authenticated;

select cron.schedule(
  'plaza-expire-requests',
  '*/5 * * * *',
  'select private.expire_due_requests()'
);

-- An expired request gives its units back like any other order that ends
-- without a sale.
drop trigger release_order_stock on public.orders;
create trigger release_order_stock
before update of status on public.orders
for each row
when (
  old.stock_reserved
  and new.status in ('rejected', 'canceled_by_buyer', 'canceled_by_seller', 'canceled_by_admin', 'expired')
)
execute function private.release_order_stock();

-- The sweep runs every five minutes, so a deadline is enforced here too: a
-- request past its window cannot be accepted in the minutes before it closes.
-- Rejecting it is still allowed; that ends it the same way.
create or replace function public.accept_order(p_order_id bigint, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_user uuid := auth.uid();
begin
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  select o.* into v_order from public.orders o join public.shops s on s.id = o.shop_id
  where o.id = p_order_id and s.owner_id = v_user for update of o;
  if v_order.id is null then raise exception using errcode = '42501', message = 'No puedes aceptar este pedido.'; end if;
  if v_order.status <> 'requested' then raise exception using errcode = 'P0001', message = 'El pedido ya no está pendiente.'; end if;
  if v_order.decide_by_at is not null and v_order.decide_by_at <= now() then
    raise exception using errcode = 'P0001', message = 'Esta solicitud ya venció.';
  end if;
  update public.orders set status = 'accepted', accepted_at = now(),
    ship_by_at = private.add_business_days(now(), v_order.handling_days, v_order.handling_time_zone), updated_at = now()
  where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, idempotency_key)
  values (p_order_id, v_user, 'seller', 'accepted', 'requested', 'accepted', p_idempotency_key);
  perform private.record_seller_activity(v_order.shop_id, v_user, 'order_accepted', 'order', p_order_id);
end;
$$;

revoke all on function public.accept_order(bigint, uuid) from public, anon;
grant execute on function public.accept_order(bigint, uuid) to authenticated;

-- Rollback:
-- select cron.unschedule('plaza-expire-requests');
-- drop function private.expire_due_requests();
-- restore accept_order from 20260820173552_add_fulfillment_communication.sql;
-- recreate release_order_stock without 'expired' (20261003120000_reserve_stock_at_checkout.sql);
-- update public.orders set status = 'canceled_by_admin' where status = 'expired';
-- drop index public.orders_decide_by_idx;
-- alter table public.orders drop column decide_by_at;
-- restore orders_status_check and order_events_event_type_check without 'expired'.
