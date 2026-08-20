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
