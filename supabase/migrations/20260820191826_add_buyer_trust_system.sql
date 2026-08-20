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

create function private.buyer_trust_marker(p_primary_text text, p_tooltip text, p_signal text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('primary_text', p_primary_text, 'tooltip', p_tooltip, 'signal', p_signal)
$$;

revoke execute on function private.buyer_trust_marker(text,text,text) from public, anon, authenticated;

create function private.evaluate_buyer_trust(
  p_member_since date,
  p_verification_level text,
  p_total_completed_purchases bigint,
  p_buyer_completion_rate numeric,
  p_claim_rate numeric,
  p_seller_fault_claim_rate numeric,
  p_cancellation_rate numeric,
  p_payment_reliability numeric,
  p_average_time_to_close_hours numeric,
  p_fast_closer_rate numeric,
  p_response_rate numeric,
  p_average_reply_time_minutes numeric,
  p_review_rate numeric,
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
  v_month text;
  v_verification jsonb;
  v_markers jsonb;
  v_reasons text[] := array[]::text[];
  v_next text[] := array[]::text[];
  v_summary text;
  v_purchase_signal text;
  v_completion_signal text;
  v_claim_signal text;
  v_cancellation_signal text;
  v_payment_signal text;
  v_close_signal text;
  v_fast_signal text;
  v_response_signal text;
  v_review_signal text;
  v_activity_signal text;
begin
  if p_member_since is null then raise exception using errcode = '22023', message = 'Falta la fecha de registro.'; end if;
  if p_verification_level not in ('unverified', 'basic', 'verified', 'highly_verified') then
    raise exception using errcode = '22023', message = 'Nivel de verificación inválido.';
  end if;

  v_top := coalesce(
    p_total_completed_purchases >= 25
    and p_buyer_completion_rate >= 97
    and p_claim_rate <= 2
    and p_cancellation_rate <= 3
    and p_payment_reliability >= 98
    and p_average_time_to_close_hours <= 36
    and p_fast_closer_rate >= 80
    and p_response_rate >= 90
    and p_last_active_days_ago <= 14,
    false
  );
  v_reliable := coalesce(
    p_total_completed_purchases >= 8
    and p_buyer_completion_rate >= 93
    and p_claim_rate <= 4
    and p_cancellation_rate <= 6
    and p_payment_reliability >= 95
    and p_average_time_to_close_hours <= 72
    and p_fast_closer_rate >= 60
    and p_last_active_days_ago <= 30,
    false
  );
  v_tier := case when v_top then 'Top Buyer' when v_reliable then 'Reliable' else 'New' end;

  v_month := case extract(month from p_member_since)::integer
    when 1 then 'enero' when 2 then 'febrero' when 3 then 'marzo' when 4 then 'abril'
    when 5 then 'mayo' when 6 then 'junio' when 7 then 'julio' when 8 then 'agosto'
    when 9 then 'septiembre' when 10 then 'octubre' when 11 then 'noviembre' else 'diciembre'
  end;

  v_verification := case p_verification_level
    when 'unverified' then jsonb_build_object(
      'primary_text', 'Sin verificar', 'badge_label', 'Sin verificar',
      'tooltip', 'Este comprador aún no completa la verificación de identidad. Se recomienda precaución adicional.'
    )
    when 'basic' then jsonb_build_object(
      'primary_text', 'Verificación básica', 'badge_label', 'Básica',
      'tooltip', 'Este comprador verificó teléfono y correo. Sus documentos de identidad aún no fueron revisados por completo.'
    )
    when 'verified' then jsonb_build_object(
      'primary_text', 'Comprador verificado', 'badge_label', 'Verificado',
      'tooltip', 'Este comprador completó la verificación de identidad. Sus datos personales fueron revisados y confirmados.'
    )
    else jsonb_build_object(
      'primary_text', 'Altamente verificado', 'badge_label', 'Alta verificación',
      'tooltip', 'Este comprador completó verificación avanzada con documentos oficiales y controles adicionales de seguridad.'
    )
  end;

  v_purchase_signal := case when p_total_completed_purchases is null then 'No data' when p_total_completed_purchases >= 25 then 'Excellent' when p_total_completed_purchases >= 8 then 'Good' when p_total_completed_purchases >= 5 then 'Average' else 'New' end;
  v_completion_signal := case when p_buyer_completion_rate is null then 'No data' when p_buyer_completion_rate >= 97 then 'Excellent' when p_buyer_completion_rate >= 93 then 'Good' when p_buyer_completion_rate >= 85 then 'Average' else 'Needs improvement' end;
  v_claim_signal := case when p_claim_rate is null then 'No data' when p_claim_rate <= 2 then 'Excellent' when p_claim_rate <= 4 then 'Good' when p_claim_rate <= 8 then 'Average' else 'Needs improvement' end;
  v_cancellation_signal := case when p_cancellation_rate is null then 'No data' when p_cancellation_rate <= 3 then 'Excellent' when p_cancellation_rate <= 6 then 'Good' when p_cancellation_rate <= 10 then 'Average' else 'Needs improvement' end;
  v_payment_signal := case when p_payment_reliability is null then 'No data' when p_payment_reliability >= 98 then 'Excellent' when p_payment_reliability >= 95 then 'Good' when p_payment_reliability >= 85 then 'Average' else 'Needs improvement' end;
  v_close_signal := case when p_average_time_to_close_hours is null then 'No data' when p_average_time_to_close_hours <= 24 then 'Excellent' when p_average_time_to_close_hours <= 48 then 'Good' when p_average_time_to_close_hours <= 72 then 'Average' else 'Needs improvement' end;
  v_fast_signal := case when p_fast_closer_rate is null then 'No data' when p_fast_closer_rate >= 80 then 'Excellent' when p_fast_closer_rate >= 60 then 'Good' when p_fast_closer_rate >= 40 then 'Average' else 'Needs improvement' end;
  v_response_signal := case when p_response_rate is null then 'No data' when p_response_rate >= 90 then 'Excellent' when p_response_rate >= 75 then 'Good' when p_response_rate >= 50 then 'Average' else 'Needs improvement' end;
  v_review_signal := case when p_review_rate is null then 'No data' when p_review_rate >= 75 then 'Excellent' when p_review_rate >= 50 then 'Good' when p_review_rate >= 25 then 'Average' else 'Needs improvement' end;
  v_activity_signal := case when p_last_active_days_ago is null then 'No data' when p_last_active_days_ago <= 14 then 'Excellent' when p_last_active_days_ago <= 30 then 'Good' when p_last_active_days_ago <= 60 then 'Average' else 'Needs improvement' end;

  v_markers := jsonb_build_object(
    'total_completed_purchases', private.buyer_trust_marker(
      case when p_total_completed_purchases is null then 'Sin datos' else format('%s compras completadas', p_total_completed_purchases) end,
      'Muestra cuántas compras terminó este comprador en la plataforma.', v_purchase_signal
    ),
    'buyer_completion_rate', private.buyer_trust_marker(
      case when p_buyer_completion_rate is null then 'Sin datos' else format('%s%% de compras completadas', p_buyer_completion_rate) end,
      'Porcentaje de pedidos aceptados que terminaron correctamente.', v_completion_signal
    ),
    'claim_rate', private.buyer_trust_marker(
      case when p_claim_rate is null then 'Sin datos' else format('%s%% de reclamos', p_claim_rate) end,
      'Proporción de pedidos enviados que generaron un reclamo.', v_claim_signal
    ),
    'cancellation_rate', private.buyer_trust_marker(
      case when p_cancellation_rate is null then 'Sin datos' else format('%s%% de cancelaciones', p_cancellation_rate) end,
      'Proporción de pedidos cancelados por el comprador después de la aceptación.', v_cancellation_signal
    ),
    'payment_reliability', private.buyer_trust_marker(
      case when p_payment_reliability is null then 'Sin datos' else format('%s%% de pagos confiables', p_payment_reliability) end,
      'Compara pagos confirmados con cancelaciones confirmadas por falta de pago.', v_payment_signal
    ),
    'average_time_to_close', private.buyer_trust_marker(
      case when p_average_time_to_close_hours is null then 'Sin datos' else format('%s h para pagar', p_average_time_to_close_hours) end,
      'Tiempo promedio desde la aceptación hasta la confirmación del pago.', v_close_signal
    ),
    'fast_closer_rate', private.buyer_trust_marker(
      case when p_fast_closer_rate is null then 'Sin datos' else format('%s%% paga en 48 h', p_fast_closer_rate) end,
      'Porcentaje de pedidos pagados dentro de las primeras 48 horas.', v_fast_signal
    ),
    'response_rate', private.buyer_trust_marker(
      case when p_response_rate is null then 'Sin datos' else format('%s%% de respuesta', p_response_rate) end,
      'Porcentaje de mensajes del vendedor respondidos por el comprador en 24 horas.', v_response_signal
    ),
    'review_rate', private.buyer_trust_marker(
      case when p_review_rate is null then 'Sin datos' else format('%s%% deja reseña', p_review_rate) end,
      'Porcentaje de compras completadas que recibieron una reseña del comprador.', v_review_signal
    ),
    'recent_activity', private.buyer_trust_marker(
      case when p_last_active_days_ago is null then 'Sin datos' when p_last_active_days_ago = 0 then 'Activo hoy' else format('Activo hace %s días', p_last_active_days_ago) end,
      'Indica cuándo realizó su última acción significativa en la plataforma.', v_activity_signal
    )
  );

  if v_top then
    v_reasons := array[
      format('%s compras completadas y %s%% de finalización.', p_total_completed_purchases, p_buyer_completion_rate),
      format('%s%% de pagos confiables; %s%% pagados dentro de 48 horas.', p_payment_reliability, p_fast_closer_rate),
      format('%s%% de reclamos y actividad hace %s días.', p_claim_rate, p_last_active_days_ago)
    ];
    v_summary := 'Comprador destacado con historial sólido de pagos, cierres, comunicación y baja incidencia de reclamos.';
  elsif v_reliable then
    v_reasons := array[
      format('%s compras completadas con %s%% de finalización.', p_total_completed_purchases, p_buyer_completion_rate),
      format('%s%% de pagos confiables y %s%% de cancelaciones.', p_payment_reliability, p_cancellation_rate)
    ];
    if p_total_completed_purchases is null or p_total_completed_purchases < 25 then v_next := array_append(v_next, format('Completa 25 compras; valor actual: %s.', coalesce(p_total_completed_purchases::text, 'sin datos'))); end if;
    if p_buyer_completion_rate is null or p_buyer_completion_rate < 97 then v_next := array_append(v_next, format('Alcanza 97%% de finalización; valor actual: %s%%.', coalesce(p_buyer_completion_rate::text, 'sin datos'))); end if;
    if p_claim_rate is null or p_claim_rate > 2 then v_next := array_append(v_next, format('Reduce reclamos a 2%% o menos; valor actual: %s%%.', coalesce(p_claim_rate::text, 'sin datos'))); end if;
    if p_cancellation_rate is null or p_cancellation_rate > 3 then v_next := array_append(v_next, format('Reduce cancelaciones a 3%% o menos; valor actual: %s%%.', coalesce(p_cancellation_rate::text, 'sin datos'))); end if;
    if p_payment_reliability is null or p_payment_reliability < 98 then v_next := array_append(v_next, format('Alcanza 98%% de pagos confiables; valor actual: %s%%.', coalesce(p_payment_reliability::text, 'sin datos'))); end if;
    if p_average_time_to_close_hours is null or p_average_time_to_close_hours > 36 then v_next := array_append(v_next, format('Reduce el cierre a 36 horas; valor actual: %s.', coalesce(p_average_time_to_close_hours::text, 'sin datos'))); end if;
    if p_fast_closer_rate is null or p_fast_closer_rate < 80 then v_next := array_append(v_next, format('Paga 80%% dentro de 48 horas; valor actual: %s%%.', coalesce(p_fast_closer_rate::text, 'sin datos'))); end if;
    if p_response_rate is null or p_response_rate < 90 then v_next := array_append(v_next, format('Alcanza 90%% de respuesta; valor actual: %s%%.', coalesce(p_response_rate::text, 'sin datos'))); end if;
    if p_last_active_days_ago is null or p_last_active_days_ago > 14 then v_next := array_append(v_next, format('Mantén actividad dentro de 14 días; valor actual: %s.', coalesce(p_last_active_days_ago::text, 'sin datos'))); end if;
    v_summary := 'Comprador confiable con buen historial; puede avanzar al cumplir todas las metas indicadas.';
  else
    if p_total_completed_purchases is null or p_total_completed_purchases < 8 then v_next := array_append(v_next, format('Completa 8 compras; valor actual: %s.', coalesce(p_total_completed_purchases::text, 'sin datos'))); end if;
    if p_buyer_completion_rate is null or p_buyer_completion_rate < 93 then v_next := array_append(v_next, format('Alcanza 93%% de finalización; valor actual: %s%%.', coalesce(p_buyer_completion_rate::text, 'sin datos'))); end if;
    if p_claim_rate is null or p_claim_rate > 4 then v_next := array_append(v_next, format('Reduce reclamos a 4%% o menos; valor actual: %s%%.', coalesce(p_claim_rate::text, 'sin datos'))); end if;
    if p_cancellation_rate is null or p_cancellation_rate > 6 then v_next := array_append(v_next, format('Reduce cancelaciones a 6%% o menos; valor actual: %s%%.', coalesce(p_cancellation_rate::text, 'sin datos'))); end if;
    if p_payment_reliability is null or p_payment_reliability < 95 then v_next := array_append(v_next, format('Alcanza 95%% de pagos confiables; valor actual: %s%%.', coalesce(p_payment_reliability::text, 'sin datos'))); end if;
    if p_average_time_to_close_hours is null or p_average_time_to_close_hours > 72 then v_next := array_append(v_next, format('Reduce el cierre a 72 horas; valor actual: %s.', coalesce(p_average_time_to_close_hours::text, 'sin datos'))); end if;
    if p_fast_closer_rate is null or p_fast_closer_rate < 60 then v_next := array_append(v_next, format('Paga 60%% dentro de 48 horas; valor actual: %s%%.', coalesce(p_fast_closer_rate::text, 'sin datos'))); end if;
    if p_last_active_days_ago is null or p_last_active_days_ago > 30 then v_next := array_append(v_next, format('Mantén actividad dentro de 30 días; valor actual: %s.', coalesce(p_last_active_days_ago::text, 'sin datos'))); end if;
    v_reasons := case when cardinality(v_next) > 0 then v_next[1:least(3, cardinality(v_next))] else array['Aún no reúne evidencia suficiente para un nivel superior.'] end;
    v_summary := 'Comprador nuevo o con evidencia insuficiente para cumplir todos los requisitos del nivel Confiable.';
  end if;

  if p_seller_fault_claim_rate is not null then
    v_reasons := array_append(v_reasons, format('%s%% de reclamos atribuidos al vendedor.', p_seller_fault_claim_rate));
  end if;
  if p_average_reply_time_minutes is not null then
    v_reasons := array_append(v_reasons, format('Tiempo promedio de respuesta: %s minutos.', p_average_reply_time_minutes));
  end if;

  return jsonb_build_object(
    'member_since', jsonb_build_object(
      'primary_text', format('Miembro desde %s de %s', v_month, extract(year from p_member_since)::integer),
      'tooltip', 'La antigüedad muestra cuánto tiempo lleva esta cuenta activa en la plataforma.'
    ),
    'verification_level', v_verification,
    'buyer_trust_tier', v_tier,
    'markers', v_markers,
    'summary', v_summary,
    'reasons', to_jsonb(v_reasons),
    'next_tier_requirements', to_jsonb(v_next)
  );
end;
$$;

revoke execute on function private.evaluate_buyer_trust(date,text,bigint,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer) from public, anon, authenticated;

create table public.buyer_trust_profiles (
  buyer_id uuid primary key references auth.users (id) on delete cascade,
  buyer_trust_tier text not null default 'new' check (buyer_trust_tier in ('new', 'reliable', 'top_buyer')),
  output jsonb,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buyer_trust_evaluations (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  output jsonb not null check (jsonb_typeof(output) = 'object'),
  evaluator_policy_version text not null default '2026-08-20-v1',
  evaluated_at timestamptz not null default now()
);

create table private.buyer_trust_evaluation_queue (
  buyer_id uuid primary key references auth.users (id) on delete cascade,
  dirty_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  locked_at timestamptz,
  last_success_at timestamptz
);

create index buyer_trust_evaluations_buyer_time_idx on public.buyer_trust_evaluations (buyer_id, evaluated_at desc);
create index buyer_trust_queue_ready_idx on private.buyer_trust_evaluation_queue (next_attempt_at, dirty_at);

revoke all on table public.buyer_trust_profiles, public.buyer_trust_evaluations from public, anon, authenticated;
revoke all on table private.buyer_trust_evaluation_queue from public, anon, authenticated;
grant select on table public.buyer_trust_profiles, public.buyer_trust_evaluations to authenticated;

alter table public.buyer_trust_profiles enable row level security;
alter table public.buyer_trust_evaluations enable row level security;
alter table private.buyer_trust_evaluation_queue enable row level security;

create policy buyer_trust_profiles_participants_select on public.buyer_trust_profiles
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.orders o join public.shops s on s.id = o.shop_id
    where o.buyer_id = buyer_trust_profiles.buyer_id and s.owner_id = (select auth.uid())
  )
  or (select public.is_current_user_admin())
);

create policy buyer_trust_evaluations_participants_select on public.buyer_trust_evaluations
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.orders o join public.shops s on s.id = o.shop_id
    where o.buyer_id = buyer_trust_evaluations.buyer_id and s.owner_id = (select auth.uid())
  )
  or (select public.is_current_user_admin())
);

create function private.enqueue_buyer_trust_evaluation(p_buyer_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.buyer_trust_evaluation_queue (
    buyer_id, dirty_at, next_attempt_at, attempt_count, last_error, locked_at
  ) values (p_buyer_id, now(), now(), 0, null, null)
  on conflict (buyer_id) do update
  set dirty_at = excluded.dirty_at,
      next_attempt_at = least(private.buyer_trust_evaluation_queue.next_attempt_at, excluded.next_attempt_at),
      attempt_count = 0,
      last_error = null,
      locked_at = null
$$;

revoke execute on function private.enqueue_buyer_trust_evaluation(uuid) from public, anon, authenticated;

create function private.create_buyer_trust_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.buyer_trust_profiles (buyer_id) values (new.user_id)
  on conflict (buyer_id) do nothing;
  perform private.enqueue_buyer_trust_evaluation(new.user_id);
  return new;
end;
$$;

revoke execute on function private.create_buyer_trust_profile() from public, anon, authenticated;

create trigger create_buyer_trust_profile
after insert on public.user_trust_profiles
for each row execute function private.create_buyer_trust_profile();

insert into public.buyer_trust_profiles (buyer_id)
select user_id from public.user_trust_profiles
on conflict (buyer_id) do nothing;

insert into private.buyer_trust_evaluation_queue (buyer_id)
select buyer_id from public.buyer_trust_profiles
on conflict (buyer_id) do nothing;

create function private.mark_buyer_trust_dirty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
begin
  if tg_table_name = 'user_trust_profiles' then
    v_buyer_id := coalesce(new.user_id, old.user_id);
  else
    v_buyer_id := coalesce(new.buyer_id, old.buyer_id);
  end if;
  if v_buyer_id is not null then perform private.enqueue_buyer_trust_evaluation(v_buyer_id); end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function private.mark_buyer_trust_dirty() from public, anon, authenticated;

create trigger dirty_buyer_trust_from_user_profile after update of verification_level on public.user_trust_profiles for each row execute function private.mark_buyer_trust_dirty();
create trigger dirty_buyer_trust_from_orders after insert or update on public.orders for each row execute function private.mark_buyer_trust_dirty();
create trigger dirty_buyer_trust_from_responses after insert or update on public.buyer_response_events for each row execute function private.mark_buyer_trust_dirty();
create trigger dirty_buyer_trust_from_activity after insert on public.buyer_activity_events for each row execute function private.mark_buyer_trust_dirty();
create trigger dirty_buyer_trust_from_reviews after insert or update or delete on public.order_reviews for each row execute function private.mark_buyer_trust_dirty();
create trigger dirty_buyer_trust_from_disputes after insert or update or delete on public.order_disputes for each row execute function private.mark_buyer_trust_dirty();

create function private.evaluate_buyer_trust_profile(p_buyer_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_since date;
  v_verification_level text;
  v_total_completed bigint;
  v_completed_90 bigint;
  v_buyer_canceled_90 bigint;
  v_non_payment_90 bigint;
  v_outcome_denominator bigint;
  v_completion_rate numeric;
  v_cancellation_rate numeric;
  v_paid_90 bigint;
  v_payment_reliability numeric;
  v_average_close numeric;
  v_fast_closer numeric;
  v_shipment_cohort bigint;
  v_claimed_orders bigint;
  v_seller_fault_claimed bigint;
  v_claim_rate numeric;
  v_seller_fault_claim_rate numeric;
  v_response_rate numeric;
  v_average_reply numeric;
  v_completed_review_cohort bigint;
  v_reviewed_completed bigint;
  v_review_rate numeric;
  v_last_active integer;
  v_input jsonb;
  v_output jsonb;
  v_tier_key text;
  v_id bigint;
  v_window timestamptz := now() - interval '90 days';
begin
  select joined_on, verification_level into v_member_since, v_verification_level
  from public.user_trust_profiles where user_id = p_buyer_id;
  if v_member_since is null then raise exception using errcode = 'P0002', message = 'Perfil de comprador no encontrado.'; end if;

  select count(*) filter (where status = 'completed') into v_total_completed
  from public.orders where buyer_id = p_buyer_id;

  select
    count(*) filter (where status = 'completed' and completed_at >= v_window),
    count(*) filter (where status = 'canceled_by_buyer' and accepted_at is not null and canceled_at >= v_window),
    count(*) filter (where status = 'canceled_by_seller' and seller_cancellation_reason = 'buyer_non_payment' and canceled_at >= v_window)
  into v_completed_90, v_buyer_canceled_90, v_non_payment_90
  from public.orders where buyer_id = p_buyer_id;
  v_outcome_denominator := v_completed_90 + v_buyer_canceled_90 + v_non_payment_90;
  v_completion_rate := 100.0 * v_completed_90 / nullif(v_outcome_denominator, 0);
  v_cancellation_rate := 100.0 * v_buyer_canceled_90 / nullif(v_outcome_denominator, 0);

  select count(*) into v_paid_90 from public.orders
  where buyer_id = p_buyer_id and payment_completed_at >= v_window;
  v_payment_reliability := 100.0 * v_paid_90 / nullif(v_paid_90 + v_non_payment_90, 0);

  select
    avg(extract(epoch from (payment_completed_at - accepted_at)) / 3600.0),
    100.0 * count(*) filter (where payment_completed_at <= accepted_at + interval '48 hours') / nullif(count(*), 0)
  into v_average_close, v_fast_closer
  from public.orders
  where buyer_id = p_buyer_id and payment_completed_at >= v_window and accepted_at is not null
    and status not in ('rejected', 'canceled_by_buyer', 'canceled_by_seller', 'canceled_by_admin');

  with shipped as (
    select order_id, min(created_at) as first_shipped_at
    from public.order_events where event_type = 'shipped' group by order_id
  ), cohort as (
    select o.id from public.orders o join shipped s on s.order_id = o.id
    where o.buyer_id = p_buyer_id and s.first_shipped_at >= v_window
  )
  select count(*), count(*) filter (where exists (select 1 from public.order_disputes d where d.order_id = cohort.id)),
    count(*) filter (where exists (select 1 from public.order_disputes d where d.order_id = cohort.id and d.status = 'resolved' and d.seller_fault))
  into v_shipment_cohort, v_claimed_orders, v_seller_fault_claimed from cohort;
  v_claim_rate := 100.0 * v_claimed_orders / nullif(v_shipment_cohort, 0);
  v_seller_fault_claim_rate := 100.0 * v_seller_fault_claimed / nullif(v_shipment_cohort, 0);

  select
    100.0 * count(*) filter (where replied_at is not null and answered_within_24_hours)
      / nullif(count(*) filter (where replied_at is not null or clock_started_at <= now() - interval '24 hours'), 0),
    avg(elapsed_minutes) filter (where replied_at is not null)
  into v_response_rate, v_average_reply
  from public.buyer_response_events
  where buyer_id = p_buyer_id and clock_started_at >= v_window;

  select count(*), count(*) filter (where exists (select 1 from public.order_reviews r where r.order_id = o.id))
  into v_completed_review_cohort, v_reviewed_completed
  from public.orders o where o.buyer_id = p_buyer_id and o.status = 'completed' and o.completed_at >= v_window;
  v_review_rate := 100.0 * v_reviewed_completed / nullif(v_completed_review_cohort, 0);

  select floor(extract(epoch from (now() - max(created_at))) / 86400)::integer into v_last_active
  from public.buyer_activity_events where buyer_id = p_buyer_id;

  v_input := jsonb_build_object(
    'member_since', v_member_since,
    'verification_level', v_verification_level,
    'total_completed_purchases', v_total_completed,
    'buyer_completion_rate', v_completion_rate,
    'claim_rate', v_claim_rate,
    'seller_fault_claim_rate', v_seller_fault_claim_rate,
    'cancellation_rate', v_cancellation_rate,
    'payment_reliability', v_payment_reliability,
    'average_time_to_close_hours', v_average_close,
    'fast_closer_rate', v_fast_closer,
    'response_rate', v_response_rate,
    'average_reply_time_minutes', v_average_reply,
    'review_rate', v_review_rate,
    'last_active_days_ago', v_last_active
  );
  v_output := private.evaluate_buyer_trust(
    v_member_since, v_verification_level, v_total_completed, v_completion_rate,
    v_claim_rate, v_seller_fault_claim_rate, v_cancellation_rate, v_payment_reliability,
    v_average_close, v_fast_closer, v_response_rate, v_average_reply, v_review_rate, v_last_active
  );
  v_tier_key := case v_output->>'buyer_trust_tier' when 'Top Buyer' then 'top_buyer' when 'Reliable' then 'reliable' else 'new' end;

  insert into public.buyer_trust_evaluations (buyer_id, input, output)
  values (p_buyer_id, v_input, v_output) returning id into v_id;
  update public.buyer_trust_profiles
  set buyer_trust_tier = v_tier_key, output = v_output, evaluated_at = now(), updated_at = now()
  where buyer_id = p_buyer_id;
  return v_id;
end;
$$;

revoke execute on function private.evaluate_buyer_trust_profile(uuid) from public, anon, authenticated;

create function private.process_buyer_trust_queue(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_processed integer := 0;
begin
  for v_item in
    select buyer_id from private.buyer_trust_evaluation_queue
    where next_attempt_at <= now()
    order by dirty_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  loop
    begin
      update private.buyer_trust_evaluation_queue set locked_at = now() where buyer_id = v_item.buyer_id;
      perform private.evaluate_buyer_trust_profile(v_item.buyer_id);
      delete from private.buyer_trust_evaluation_queue where buyer_id = v_item.buyer_id;
      v_processed := v_processed + 1;
    exception when others then
      update private.buyer_trust_evaluation_queue
      set attempt_count = attempt_count + 1,
          next_attempt_at = now() + make_interval(mins => least(60, power(2, least(attempt_count + 1, 6))::integer)),
          last_error = left(sqlerrm, 1000),
          locked_at = null
      where buyer_id = v_item.buyer_id;
    end;
  end loop;
  return v_processed;
end;
$$;

create function private.enqueue_all_buyer_trust_profiles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into private.buyer_trust_evaluation_queue (
    buyer_id, dirty_at, next_attempt_at, attempt_count, last_error, locked_at
  )
  select buyer_id, now(), now(), 0, null, null from public.buyer_trust_profiles
  on conflict (buyer_id) do update
  set dirty_at = excluded.dirty_at,
      next_attempt_at = excluded.next_attempt_at,
      attempt_count = 0,
      last_error = null,
      locked_at = null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.process_buyer_trust_queue(integer) from public, anon, authenticated;
revoke execute on function private.enqueue_all_buyer_trust_profiles() from public, anon, authenticated;

select cron.schedule(
  'plaza-process-buyer-trust-queue',
  '*/5 * * * *',
  'select private.process_buyer_trust_queue()'
);

select cron.schedule(
  'plaza-refresh-all-buyer-trust',
  '30 0 * * *',
  'select private.enqueue_all_buyer_trust_profiles()'
);
