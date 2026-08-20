create extension if not exists pg_cron;

create table public.conversations (
  id bigint generated always as identity primary key,
  shop_id bigint not null references public.shops (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  order_id bigint references public.orders (id) on delete restrict,
  type text not null check (type in ('pre_sale', 'order')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'order' and order_id is not null) or (type = 'pre_sale' and order_id is null)),
  unique (order_id)
);

create unique index conversations_pre_sale_buyer_shop_idx
on public.conversations (buyer_id, shop_id)
where type = 'pre_sale';

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  sender_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, idempotency_key)
);

create table public.seller_response_events (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  shop_id bigint not null references public.shops (id) on delete restrict,
  triggering_buyer_message_id bigint not null references public.messages (id) on delete restrict,
  closing_seller_message_id bigint references public.messages (id) on delete restrict,
  clock_started_at timestamptz not null,
  replied_at timestamptz,
  elapsed_minutes integer check (elapsed_minutes is null or elapsed_minutes >= 0),
  answered_within_24_hours boolean,
  created_at timestamptz not null default now()
);

create unique index seller_response_events_one_open_clock_idx
on public.seller_response_events (conversation_id)
where replied_at is null;

create table public.seller_activity_events (
  id bigint generated always as identity primary key,
  shop_id bigint not null references public.shops (id) on delete restrict,
  actor_id uuid not null references auth.users (id) on delete restrict,
  activity_type text not null check (activity_type in (
    'product_published', 'material_listing_updated', 'order_accepted',
    'order_rejected', 'order_shipped', 'seller_message', 'evidence_submitted'
  )),
  related_entity_type text check (related_entity_type is null or related_entity_type in ('product', 'order', 'message', 'dispute')),
  related_entity_id bigint,
  created_at timestamptz not null default now()
);

create index conversations_shop_updated_idx on public.conversations (shop_id, updated_at desc);
create index conversations_buyer_updated_idx on public.conversations (buyer_id, updated_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index seller_response_events_shop_started_idx on public.seller_response_events (shop_id, clock_started_at desc);
create index seller_activity_events_shop_created_idx on public.seller_activity_events (shop_id, created_at desc);

grant select on table public.conversations, public.messages, public.seller_response_events to authenticated;
grant select on table public.seller_activity_events to authenticated;
grant usage, select on sequence public.conversations_id_seq, public.messages_id_seq, public.seller_response_events_id_seq, public.seller_activity_events_id_seq to authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.seller_response_events enable row level security;
alter table public.seller_activity_events enable row level security;

create policy conversation_participants_select on public.conversations for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (select 1 from public.shops where shops.id = conversations.shop_id and shops.owner_id = (select auth.uid()))
);

create policy message_participants_select on public.messages for select to authenticated
using (exists (
  select 1 from public.conversations c
  join public.shops s on s.id = c.shop_id
  where c.id = messages.conversation_id
    and (c.buyer_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
));

create policy response_event_participants_select on public.seller_response_events for select to authenticated
using (exists (
  select 1 from public.conversations c
  join public.shops s on s.id = c.shop_id
  where c.id = seller_response_events.conversation_id
    and (c.buyer_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
));

create policy seller_activity_owner_select on public.seller_activity_events for select to authenticated
using (exists (select 1 from public.shops where shops.id = seller_activity_events.shop_id and shops.owner_id = (select auth.uid())));

create function private.add_business_days(p_started_at timestamptz, p_days integer, p_time_zone text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_local timestamp := p_started_at at time zone p_time_zone;
  v_date date := v_local::date;
  v_added integer := 0;
begin
  if p_days < 1 then raise exception using errcode = '22023', message = 'Los días de preparación deben ser positivos.'; end if;
  while v_added < p_days loop
    v_date := v_date + 1;
    if extract(isodow from v_date) between 1 and 5 then v_added := v_added + 1; end if;
  end loop;
  return (v_date + v_local::time) at time zone p_time_zone;
end;
$$;

create function private.record_seller_activity(
  p_shop_id bigint,
  p_actor_id uuid,
  p_activity_type text,
  p_related_entity_type text default null,
  p_related_entity_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.seller_activity_events (shop_id, actor_id, activity_type, related_entity_type, related_entity_id)
  values (p_shop_id, p_actor_id, p_activity_type, p_related_entity_type, p_related_entity_id);
end;
$$;

revoke execute on function private.add_business_days(timestamptz, integer, text) from public, anon, authenticated;
revoke execute on function private.record_seller_activity(bigint, uuid, text, text, bigint) from public, anon, authenticated;

create function private.create_order_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversations (shop_id, buyer_id, order_id, type)
  values (new.shop_id, new.buyer_id, new.id, 'order');
  return new;
end;
$$;

revoke execute on function private.create_order_conversation() from public, anon, authenticated;

create trigger create_order_conversation
after insert on public.orders
for each row execute function private.create_order_conversation();

insert into public.conversations (shop_id, buyer_id, order_id, type, created_at, updated_at)
select shop_id, buyer_id, id, 'order', created_at, updated_at from public.orders
on conflict (order_id) do nothing;

create function private.record_message_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_owner_id uuid;
  v_event_id bigint;
  v_elapsed integer;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  select owner_id into v_owner_id from public.shops where id = v_conversation.shop_id;

  if new.sender_id = v_conversation.buyer_id and new.sender_id <> v_owner_id then
    insert into public.seller_response_events (
      conversation_id, shop_id, triggering_buyer_message_id, clock_started_at
    ) values (new.conversation_id, v_conversation.shop_id, new.id, new.created_at)
    on conflict (conversation_id) where replied_at is null do nothing;
  elsif new.sender_id = v_owner_id then
    select id, greatest(0, floor(extract(epoch from (new.created_at - clock_started_at)) / 60)::integer)
    into v_event_id, v_elapsed
    from public.seller_response_events
    where conversation_id = new.conversation_id and replied_at is null
    order by clock_started_at
    limit 1
    for update;

    if v_event_id is not null then
      update public.seller_response_events
      set closing_seller_message_id = new.id,
          replied_at = new.created_at,
          elapsed_minutes = v_elapsed,
          answered_within_24_hours = v_elapsed <= 1440
      where id = v_event_id;
    end if;
    perform private.record_seller_activity(v_conversation.shop_id, new.sender_id, 'seller_message', 'message', new.id);
  end if;
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function private.record_message_evidence() from public, anon, authenticated;

create trigger record_message_evidence
after insert on public.messages
for each row execute function private.record_message_evidence();

create function private.record_product_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then return new; end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    perform private.record_seller_activity(new.shop_id, v_actor, 'product_published', 'product', new.id);
  elsif tg_op = 'UPDATE' and new.status = 'published' and (
    new.name is distinct from old.name or new.description is distinct from old.description
    or new.price_mxn is distinct from old.price_mxn or new.handling_days is distinct from old.handling_days
    or new.condition is distinct from old.condition or new.used_condition is distinct from old.used_condition
  ) then
    perform private.record_seller_activity(new.shop_id, v_actor, 'material_listing_updated', 'product', new.id);
  end if;
  return new;
end;
$$;

revoke execute on function private.record_product_activity() from public, anon, authenticated;

create trigger record_product_activity
after insert or update on public.products
for each row execute function private.record_product_activity();

create function public.start_pre_sale_conversation(p_shop_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_id bigint;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  select owner_id into v_owner from public.shops where id = p_shop_id;
  if v_owner is null then raise exception using errcode = 'P0002', message = 'Tienda no encontrada.'; end if;
  if v_owner = v_user then raise exception using errcode = 'P0001', message = 'No puedes abrir una conversación contigo.'; end if;
  insert into public.conversations (shop_id, buyer_id, type)
  values (p_shop_id, v_user, 'pre_sale')
  on conflict (buyer_id, shop_id) where type = 'pre_sale' do update set updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create function public.send_conversation_message(p_conversation_id bigint, p_body text, p_idempotency_key uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id bigint;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if not exists (
    select 1 from public.conversations c join public.shops s on s.id = c.shop_id
    where c.id = p_conversation_id and (c.buyer_id = v_user or s.owner_id = v_user)
  ) then raise exception using errcode = '42501', message = 'No puedes escribir en esta conversación.'; end if;
  if char_length(btrim(p_body)) not between 1 and 2000 then raise exception using errcode = '22023', message = 'El mensaje debe tener entre 1 y 2000 caracteres.'; end if;
  select id into v_id from public.messages where conversation_id = p_conversation_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  insert into public.messages (conversation_id, sender_id, body, idempotency_key)
  values (p_conversation_id, v_user, btrim(p_body), p_idempotency_key)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.accept_order(p_order_id bigint, p_idempotency_key uuid)
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
  update public.orders set status = 'accepted', accepted_at = now(),
    ship_by_at = private.add_business_days(now(), v_order.handling_days, v_order.handling_time_zone), updated_at = now()
  where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, idempotency_key)
  values (p_order_id, v_user, 'seller', 'accepted', 'requested', 'accepted', p_idempotency_key);
  perform private.record_seller_activity(v_order.shop_id, v_user, 'order_accepted', 'order', p_order_id);
end;
$$;

create function public.reject_order(p_order_id bigint, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_user uuid := auth.uid();
begin
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  select o.* into v_order from public.orders o join public.shops s on s.id = o.shop_id where o.id = p_order_id and s.owner_id = v_user for update of o;
  if v_order.id is null or v_order.status <> 'requested' then raise exception using errcode = 'P0001', message = 'No puedes rechazar este pedido.'; end if;
  update public.orders set status = 'rejected', canceled_at = now(), canceled_by = v_user, updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, idempotency_key) values (p_order_id, v_user, 'seller', 'rejected', 'requested', 'rejected', p_idempotency_key);
  perform private.record_seller_activity(v_order.shop_id, v_user, 'order_rejected', 'order', p_order_id);
end;
$$;

create function public.mark_order_shipped(p_order_id bigint, p_tracking_text text, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_user uuid := auth.uid();
begin
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  select o.* into v_order from public.orders o join public.shops s on s.id = o.shop_id where o.id = p_order_id and s.owner_id = v_user for update of o;
  if v_order.id is null or v_order.status <> 'accepted' then raise exception using errcode = 'P0001', message = 'El pedido no está listo para marcarse enviado.'; end if;
  update public.orders set status = 'shipped', shipped_at = now(), tracking_text = nullif(btrim(p_tracking_text), ''), updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, metadata, idempotency_key) values (p_order_id, v_user, 'seller', 'shipped', 'accepted', 'shipped', jsonb_build_object('has_tracking', nullif(btrim(p_tracking_text), '') is not null), p_idempotency_key);
  perform private.record_seller_activity(v_order.shop_id, v_user, 'order_shipped', 'order', p_order_id);
end;
$$;

create function public.confirm_order_received(p_order_id bigint, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_user uuid := auth.uid();
begin
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  select * into v_order from public.orders where id = p_order_id and buyer_id = v_user for update;
  if v_order.id is null or v_order.status <> 'shipped' then raise exception using errcode = 'P0001', message = 'Este pedido no puede marcarse recibido.'; end if;
  update public.orders set status = 'delivered', delivered_at = now(), updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, idempotency_key) values (p_order_id, v_user, 'buyer', 'delivered', 'shipped', 'delivered', p_idempotency_key);
end;
$$;

create function public.confirm_order_satisfied(p_order_id bigint, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_user uuid := auth.uid();
begin
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  select * into v_order from public.orders where id = p_order_id and buyer_id = v_user for update;
  if v_order.id is null or v_order.status <> 'delivered' then raise exception using errcode = 'P0001', message = 'Este pedido no puede completarse.'; end if;
  update public.orders set status = 'completed', buyer_confirmed_at = now(), completed_at = now(), updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, idempotency_key) values (p_order_id, v_user, 'buyer', 'completed', 'delivered', 'completed', p_idempotency_key);
end;
$$;

create function private.auto_complete_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_order record; v_count integer := 0;
begin
  for v_order in
    select id from public.orders
    where status = 'delivered' and delivered_at <= now() - interval '7 days'
    for update skip locked
  loop
    update public.orders set status = 'completed', auto_completed_at = now(), completed_at = now(), updated_at = now() where id = v_order.id and status = 'delivered';
    if found then
      insert into public.order_events (order_id, actor_type, event_type, previous_status, next_status) values (v_order.id, 'system', 'auto_completed', 'delivered', 'completed');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.auto_complete_orders() from public, anon, authenticated;

revoke all on function public.start_pre_sale_conversation(bigint) from public, anon;
revoke all on function public.send_conversation_message(bigint, text, uuid) from public, anon;
revoke all on function public.accept_order(bigint, uuid) from public, anon;
revoke all on function public.reject_order(bigint, uuid) from public, anon;
revoke all on function public.mark_order_shipped(bigint, text, uuid) from public, anon;
revoke all on function public.confirm_order_received(bigint, uuid) from public, anon;
revoke all on function public.confirm_order_satisfied(bigint, uuid) from public, anon;
grant execute on function public.start_pre_sale_conversation(bigint) to authenticated;
grant execute on function public.send_conversation_message(bigint, text, uuid) to authenticated;
grant execute on function public.accept_order(bigint, uuid) to authenticated;
grant execute on function public.reject_order(bigint, uuid) to authenticated;
grant execute on function public.mark_order_shipped(bigint, text, uuid) to authenticated;
grant execute on function public.confirm_order_received(bigint, uuid) to authenticated;
grant execute on function public.confirm_order_satisfied(bigint, uuid) to authenticated;

select cron.schedule(
  'plaza-auto-complete-orders',
  '0 * * * *',
  'select private.auto_complete_orders()'
);
