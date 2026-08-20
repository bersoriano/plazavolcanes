alter table public.orders
  add column payment_confirmation_required boolean not null default false,
  add column payment_completed_at timestamptz,
  add column payment_confirmed_by uuid references auth.users (id) on delete set null,
  add column seller_cancellation_reason text
    check (seller_cancellation_reason is null or seller_cancellation_reason in (
      'buyer_non_payment', 'inventory_unavailable', 'seller_unavailable', 'other'
    )),
  add constraint orders_payment_evidence_complete check (
    (payment_completed_at is null and payment_confirmed_by is null)
    or (payment_completed_at is not null and payment_confirmed_by is not null)
  ),
  add constraint orders_seller_cancellation_reason_status check (
    seller_cancellation_reason is null or status = 'canceled_by_seller'
  );

alter table public.order_events drop constraint order_events_event_type_check;
alter table public.order_events add constraint order_events_event_type_check check (event_type in (
  'requested', 'accepted', 'rejected', 'payment_confirmed', 'shipped', 'delivered', 'completed',
  'auto_completed', 'canceled_by_buyer', 'canceled_by_seller',
  'canceled_by_admin', 'admin_delivery_confirmed', 'admin_repair'
));

create index orders_buyer_payment_evidence_idx
on public.orders (buyer_id, payment_completed_at desc)
where payment_completed_at is not null;

create function private.checkout_cart_internal(
  p_shop_id bigint,
  p_address jsonb,
  p_buyer_note text,
  p_idempotency_key uuid,
  p_payment_confirmation_required boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_cart_id bigint;
  v_order_id bigint;
  v_owner_id uuid;
  v_time_zone text;
  v_subtotal numeric(14,2);
  v_handling_days integer;
  v_item_count bigint;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Falta la clave de confirmación.'; end if;

  select id into v_order_id from public.orders
  where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if v_order_id is not null then return v_order_id; end if;

  select owner_id, time_zone into v_owner_id, v_time_zone from public.shops where id = p_shop_id;
  if v_owner_id is null then raise exception using errcode = 'P0002', message = 'Tienda no encontrada.'; end if;
  if v_owner_id = v_user then raise exception using errcode = 'P0001', message = 'No puedes comprar en tu propia tienda.'; end if;

  select id into v_cart_id from public.carts
  where buyer_id = v_user and shop_id = p_shop_id for update;
  if v_cart_id is null then raise exception using errcode = 'P0002', message = 'Tu carrito está vacío.'; end if;

  select count(*), sum(p.price_mxn * ci.quantity), max(p.handling_days)
  into v_item_count, v_subtotal, v_handling_days
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id and p.shop_id = p_shop_id and p.status = 'published';
  if v_item_count = 0 or v_item_count <> (select count(*) from public.cart_items where cart_id = v_cart_id) then
    raise exception using errcode = 'P0001', message = 'Uno o más productos ya no están disponibles.';
  end if;

  if nullif(btrim(p_address->>'recipient'), '') is null
    or nullif(btrim(p_address->>'address_line1'), '') is null
    or nullif(btrim(p_address->>'locality'), '') is null
    or nullif(btrim(p_address->>'administrative_area'), '') is null
    or nullif(btrim(p_address->>'postal_code'), '') is null
    or coalesce(p_address->>'country_code', '') !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'Completa la dirección de entrega.';
  end if;

  insert into public.orders (
    buyer_id, shop_id, idempotency_key, currency_code, subtotal, buyer_note,
    handling_days, handling_time_zone, payment_confirmation_required
  ) values (
    v_user, p_shop_id, p_idempotency_key, 'MXN', v_subtotal,
    nullif(btrim(p_buyer_note), ''), v_handling_days, v_time_zone,
    p_payment_confirmation_required
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, currency_code,
    quantity, line_total, handling_days
  )
  select v_order_id, p.id, p.name, p.price_mxn, p.currency_code,
    ci.quantity, p.price_mxn * ci.quantity, p.handling_days
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id;

  insert into public.order_addresses (
    order_id, recipient, address_line1, address_line2, locality,
    administrative_area, postal_code, country_code, delivery_instructions
  ) values (
    v_order_id, btrim(p_address->>'recipient'), btrim(p_address->>'address_line1'),
    nullif(btrim(p_address->>'address_line2'), ''), btrim(p_address->>'locality'),
    btrim(p_address->>'administrative_area'), btrim(p_address->>'postal_code'),
    p_address->>'country_code', nullif(btrim(p_address->>'delivery_instructions'), '')
  );

  insert into public.order_events (order_id, actor_id, actor_type, event_type, next_status, metadata, idempotency_key)
  values (
    v_order_id, v_user, 'buyer', 'requested', 'requested',
    jsonb_build_object('payment_confirmation_required', p_payment_confirmation_required),
    p_idempotency_key
  );

  delete from public.carts where id = v_cart_id;
  return v_order_id;
end;
$$;

revoke execute on function private.checkout_cart_internal(bigint,jsonb,text,uuid,boolean) from public, anon, authenticated;

create or replace function public.checkout_cart(
  p_shop_id bigint,
  p_address jsonb,
  p_buyer_note text,
  p_idempotency_key uuid
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.checkout_cart_internal(p_shop_id, p_address, p_buyer_note, p_idempotency_key, false)
$$;

create function public.checkout_cart_v2(
  p_shop_id bigint,
  p_address jsonb,
  p_buyer_note text,
  p_idempotency_key uuid
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.checkout_cart_internal(p_shop_id, p_address, p_buyer_note, p_idempotency_key, true)
$$;

create function public.confirm_order_payment(p_order_id bigint, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_user uuid := auth.uid();
begin
  select o.* into v_order
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.id = p_order_id and s.owner_id = v_user
  for update of o;
  if v_order.id is null then
    raise exception using errcode = '42501', message = 'Solo el vendedor puede confirmar el pago.';
  end if;
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  if v_order.status <> 'accepted' then
    raise exception using errcode = 'P0001', message = 'Este pedido no admite confirmación de pago.';
  end if;
  if v_order.payment_completed_at is not null then return; end if;

  update public.orders
  set payment_completed_at = now(), payment_confirmed_by = v_user, updated_at = now()
  where id = p_order_id;
  insert into public.order_events (
    order_id, actor_id, actor_type, event_type, previous_status, next_status, idempotency_key
  ) values (
    p_order_id, v_user, 'seller', 'payment_confirmed', 'accepted', 'accepted', p_idempotency_key
  );
end;
$$;

create function public.cancel_order_by_buyer(p_order_id bigint, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_user uuid := auth.uid();
begin
  select * into v_order from public.orders
  where id = p_order_id and buyer_id = v_user for update;
  if v_order.id is null then raise exception using errcode = '42501', message = 'No puedes cancelar este pedido.'; end if;
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  if v_order.status not in ('requested', 'accepted') or v_order.payment_completed_at is not null then
    raise exception using errcode = 'P0001', message = 'Este pedido ya no puede cancelarse.';
  end if;

  update public.orders set status = 'canceled_by_buyer', canceled_at = now(), canceled_by = v_user, updated_at = now()
  where id = p_order_id;
  insert into public.order_events (
    order_id, actor_id, actor_type, event_type, previous_status, next_status, idempotency_key
  ) values (
    p_order_id, v_user, 'buyer', 'canceled_by_buyer', v_order.status, 'canceled_by_buyer', p_idempotency_key
  );
end;
$$;

create function public.cancel_order_by_seller(p_order_id bigint, p_reason text, p_idempotency_key uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_user uuid := auth.uid();
begin
  if p_reason not in ('buyer_non_payment', 'inventory_unavailable', 'seller_unavailable', 'other') then
    raise exception using errcode = '22023', message = 'Razón de cancelación inválida.';
  end if;
  select o.* into v_order
  from public.orders o join public.shops s on s.id = o.shop_id
  where o.id = p_order_id and s.owner_id = v_user
  for update of o;
  if v_order.id is null then raise exception using errcode = '42501', message = 'No puedes cancelar este pedido.'; end if;
  if exists (select 1 from public.order_events where order_id = p_order_id and idempotency_key = p_idempotency_key) then return; end if;
  if v_order.status <> 'accepted' or v_order.payment_completed_at is not null then
    raise exception using errcode = 'P0001', message = 'Este pedido ya no puede cancelarse.';
  end if;

  update public.orders
  set status = 'canceled_by_seller', seller_cancellation_reason = p_reason,
      canceled_at = now(), canceled_by = v_user, updated_at = now()
  where id = p_order_id;
  insert into public.order_events (
    order_id, actor_id, actor_type, event_type, previous_status, next_status, metadata, idempotency_key
  ) values (
    p_order_id, v_user, 'seller', 'canceled_by_seller', 'accepted', 'canceled_by_seller',
    jsonb_build_object('reason', p_reason), p_idempotency_key
  );
end;
$$;

create or replace function public.mark_order_shipped(p_order_id bigint, p_tracking_text text, p_idempotency_key uuid)
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
  if v_order.payment_confirmation_required and v_order.payment_completed_at is null then
    raise exception using errcode = 'P0001', message = 'Confirma el pago antes de enviar.';
  end if;
  update public.orders set status = 'shipped', shipped_at = now(), tracking_text = nullif(btrim(p_tracking_text), ''), updated_at = now() where id = p_order_id;
  insert into public.order_events (order_id, actor_id, actor_type, event_type, previous_status, next_status, metadata, idempotency_key) values (p_order_id, v_user, 'seller', 'shipped', 'accepted', 'shipped', jsonb_build_object('has_tracking', nullif(btrim(p_tracking_text), '') is not null), p_idempotency_key);
  perform private.record_seller_activity(v_order.shop_id, v_user, 'order_shipped', 'order', p_order_id);
end;
$$;

revoke all on function public.checkout_cart_v2(bigint,jsonb,text,uuid) from public, anon;
revoke all on function public.confirm_order_payment(bigint,uuid) from public, anon;
revoke all on function public.cancel_order_by_buyer(bigint,uuid) from public, anon;
revoke all on function public.cancel_order_by_seller(bigint,text,uuid) from public, anon;
grant execute on function public.checkout_cart_v2(bigint,jsonb,text,uuid) to authenticated;
grant execute on function public.confirm_order_payment(bigint,uuid) to authenticated;
grant execute on function public.cancel_order_by_buyer(bigint,uuid) to authenticated;
grant execute on function public.cancel_order_by_seller(bigint,text,uuid) to authenticated;

create table public.buyer_response_events (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  order_id bigint not null references public.orders (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  triggering_seller_message_id bigint not null references public.messages (id) on delete restrict,
  closing_buyer_message_id bigint references public.messages (id) on delete restrict,
  clock_started_at timestamptz not null,
  replied_at timestamptz,
  elapsed_minutes integer check (elapsed_minutes is null or elapsed_minutes >= 0),
  answered_within_24_hours boolean,
  created_at timestamptz not null default now()
);

create unique index buyer_response_events_one_open_clock_idx
on public.buyer_response_events (conversation_id)
where replied_at is null;

create index buyer_response_events_buyer_started_idx
on public.buyer_response_events (buyer_id, clock_started_at desc);

create table public.buyer_activity_events (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  order_id bigint not null references public.orders (id) on delete restrict,
  activity_type text not null check (activity_type in (
    'checkout', 'payment_completed', 'buyer_message', 'receipt_confirmed',
    'order_completed', 'review_submitted', 'claim_submitted', 'accepted_order_canceled'
  )),
  related_entity_type text not null check (related_entity_type in ('order', 'message', 'review', 'dispute')),
  related_entity_id bigint not null,
  created_at timestamptz not null default now(),
  unique (buyer_id, activity_type, related_entity_type, related_entity_id)
);

create index buyer_activity_events_buyer_created_idx
on public.buyer_activity_events (buyer_id, created_at desc);

revoke all on table public.buyer_response_events, public.buyer_activity_events from public, anon, authenticated;
grant select on table public.buyer_response_events, public.buyer_activity_events to authenticated;

alter table public.buyer_response_events enable row level security;
alter table public.buyer_activity_events enable row level security;

create policy buyer_response_participants_select on public.buyer_response_events
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.orders o
    join public.shops s on s.id = o.shop_id
    where o.id = buyer_response_events.order_id and s.owner_id = (select auth.uid())
  )
  or (select public.is_current_user_admin())
);

create policy buyer_activity_participants_select on public.buyer_activity_events
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.orders o
    join public.shops s on s.id = o.shop_id
    where o.id = buyer_activity_events.order_id and s.owner_id = (select auth.uid())
  )
  or (select public.is_current_user_admin())
);

create function private.record_buyer_activity(
  p_buyer_id uuid,
  p_order_id bigint,
  p_activity_type text,
  p_related_entity_type text,
  p_related_entity_id bigint,
  p_created_at timestamptz default now()
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.buyer_activity_events (
    buyer_id, order_id, activity_type, related_entity_type, related_entity_id, created_at
  ) values (
    p_buyer_id, p_order_id, p_activity_type, p_related_entity_type, p_related_entity_id, p_created_at
  )
  on conflict (buyer_id, activity_type, related_entity_type, related_entity_id) do nothing
$$;

revoke execute on function private.record_buyer_activity(uuid,bigint,text,text,bigint,timestamptz) from public, anon, authenticated;

create function private.record_buyer_checkout_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_buyer_activity(new.buyer_id, new.id, 'checkout', 'order', new.id, new.created_at);
  return new;
end;
$$;

revoke execute on function private.record_buyer_checkout_activity() from public, anon, authenticated;

create trigger record_buyer_checkout_activity
after insert on public.orders
for each row execute function private.record_buyer_checkout_activity();

create function private.record_buyer_order_event_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_activity_type text;
begin
  if new.event_type = 'payment_confirmed' then
    v_activity_type := 'payment_completed';
  elsif new.event_type = 'delivered' and new.actor_type = 'buyer' then
    v_activity_type := 'receipt_confirmed';
  elsif new.event_type = 'completed' and new.actor_type = 'buyer' then
    v_activity_type := 'order_completed';
  elsif new.event_type = 'canceled_by_buyer' and new.previous_status = 'accepted' then
    v_activity_type := 'accepted_order_canceled';
  else
    return new;
  end if;

  select buyer_id into v_buyer_id from public.orders where id = new.order_id;
  perform private.record_buyer_activity(v_buyer_id, new.order_id, v_activity_type, 'order', new.order_id, new.created_at);
  return new;
end;
$$;

revoke execute on function private.record_buyer_order_event_activity() from public, anon, authenticated;

create trigger record_buyer_order_event_activity
after insert on public.order_events
for each row execute function private.record_buyer_order_event_activity();

create function private.record_buyer_review_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_buyer_activity(new.buyer_id, new.order_id, 'review_submitted', 'review', new.id, new.created_at);
  return new;
end;
$$;

create function private.record_buyer_claim_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_buyer_activity(new.buyer_id, new.order_id, 'claim_submitted', 'dispute', new.id, new.opened_at);
  return new;
end;
$$;

revoke execute on function private.record_buyer_review_activity() from public, anon, authenticated;
revoke execute on function private.record_buyer_claim_activity() from public, anon, authenticated;

create trigger record_buyer_review_activity
after insert on public.order_reviews
for each row execute function private.record_buyer_review_activity();

create trigger record_buyer_claim_activity
after insert on public.order_disputes
for each row execute function private.record_buyer_claim_activity();

create or replace function private.record_message_evidence()
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

    if v_conversation.type = 'order' then
      select id, greatest(0, floor(extract(epoch from (new.created_at - clock_started_at)) / 60)::integer)
      into v_event_id, v_elapsed
      from public.buyer_response_events
      where conversation_id = new.conversation_id and replied_at is null
      order by clock_started_at
      limit 1
      for update;

      if v_event_id is not null then
        update public.buyer_response_events
        set closing_buyer_message_id = new.id,
            replied_at = new.created_at,
            elapsed_minutes = v_elapsed,
            answered_within_24_hours = v_elapsed <= 1440
        where id = v_event_id;
      end if;
      perform private.record_buyer_activity(
        v_conversation.buyer_id, v_conversation.order_id, 'buyer_message', 'message', new.id, new.created_at
      );
    end if;
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

    if v_conversation.type = 'order' then
      insert into public.buyer_response_events (
        conversation_id, order_id, buyer_id, triggering_seller_message_id, clock_started_at
      ) values (
        new.conversation_id, v_conversation.order_id, v_conversation.buyer_id, new.id, new.created_at
      )
      on conflict (conversation_id) where replied_at is null do nothing;
    end if;
    perform private.record_seller_activity(v_conversation.shop_id, new.sender_id, 'seller_message', 'message', new.id);
  end if;

  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function private.record_message_evidence() from public, anon, authenticated;
