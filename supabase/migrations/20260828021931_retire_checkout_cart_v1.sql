-- Checkout v1 silently chose shipping and skipped the payment-confirmation
-- contract. There are no application callers, so contract it now rather than
-- leave an authenticated bypass beside the fulfillment-aware APIs.
drop function public.checkout_cart(bigint, jsonb, text, uuid);
drop function private.checkout_cart_internal(bigint, jsonb, text, uuid, boolean);

-- v2 and v3 share this single implementation. The transaction-level advisory
-- lock is deliberately acquired before the first idempotency lookup: concurrent
-- retries for the same buyer/key cannot both miss the row and race to empty the
-- same cart. A transaction owns only this one lock, so there is no lock-order
-- cycle to introduce.
create or replace function private.checkout_cart_internal_v2(
  p_shop_id bigint,
  p_fulfillment_method text,
  p_address jsonb,
  p_alt_contact jsonb,
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
  v_contact_name text := nullif(btrim(p_alt_contact->>'name'), '');
  v_contact_phone text := nullif(btrim(p_alt_contact->>'phone'), '');
  v_contact_note text := nullif(btrim(p_alt_contact->>'note'), '');
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Falta la clave de confirmación.'; end if;
  if p_fulfillment_method is null or p_fulfillment_method not in ('pickup', 'shipping') then
    raise exception using errcode = '22023', message = 'Elige recolección o envío.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user::text),
    pg_catalog.hashtext(p_idempotency_key::text)
  );

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

  if p_fulfillment_method = 'shipping' then
    if nullif(btrim(p_address->>'recipient'), '') is null
      or nullif(btrim(p_address->>'address_line1'), '') is null
      or nullif(btrim(p_address->>'locality'), '') is null
      or nullif(btrim(p_address->>'administrative_area'), '') is null
      or nullif(btrim(p_address->>'postal_code'), '') is null
      or coalesce(p_address->>'country_code', '') !~ '^[A-Z]{2}$' then
      raise exception using errcode = '22023', message = 'Completa la dirección de entrega.';
    end if;
  elsif p_address is not null then
    raise exception using errcode = 'P0001', message = 'Una recolección no lleva dirección de entrega.';
  end if;

  if v_contact_name is null
    and (v_contact_phone is not null or v_contact_note is not null) then
    raise exception using errcode = '22023', message = 'Escribe el nombre de la otra persona.';
  end if;

  if v_contact_name is not null and length(v_contact_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'El nombre de la otra persona debe tener entre 2 y 80 caracteres.';
  end if;

  if v_contact_phone is not null and v_contact_phone !~ '^\+52[0-9]{10}$' then
    raise exception using errcode = '22023', message = 'El teléfono debe tener 10 dígitos.';
  end if;

  if v_contact_note is not null and length(v_contact_note) > 200 then
    raise exception using errcode = '22023', message = 'La nota no puede pasar de 200 caracteres.';
  end if;

  insert into public.orders (
    buyer_id, shop_id, idempotency_key, currency_code, subtotal, buyer_note,
    handling_days, handling_time_zone, payment_confirmation_required,
    fulfillment_method, alt_contact_name, alt_contact_phone, alt_contact_note
  ) values (
    v_user, p_shop_id, p_idempotency_key, 'MXN', v_subtotal,
    nullif(btrim(p_buyer_note), ''), v_handling_days, v_time_zone,
    p_payment_confirmation_required,
    p_fulfillment_method, v_contact_name, v_contact_phone, v_contact_note
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, currency_code,
    quantity, line_total, handling_days
  )
  select v_order_id, p.id, p.name, p.price_mxn, p.currency_code,
    ci.quantity, p.price_mxn * ci.quantity, p.handling_days
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id;

  if p_fulfillment_method = 'shipping' then
    insert into public.order_addresses (
      order_id, recipient, address_line1, address_line2, locality,
      administrative_area, postal_code, country_code, delivery_instructions
    ) values (
      v_order_id, btrim(p_address->>'recipient'), btrim(p_address->>'address_line1'),
      nullif(btrim(p_address->>'address_line2'), ''), btrim(p_address->>'locality'),
      btrim(p_address->>'administrative_area'), btrim(p_address->>'postal_code'),
      p_address->>'country_code', nullif(btrim(p_address->>'delivery_instructions'), '')
    );
  end if;

  insert into public.order_events (order_id, actor_id, actor_type, event_type, next_status, metadata, idempotency_key)
  values (
    v_order_id, v_user, 'buyer', 'requested', 'requested',
    jsonb_build_object(
      'payment_confirmation_required', p_payment_confirmation_required,
      'fulfillment_method', p_fulfillment_method
    ),
    p_idempotency_key
  );

  delete from public.carts where id = v_cart_id;
  return v_order_id;
end;
$$;

revoke execute on function private.checkout_cart_internal_v2(bigint,text,jsonb,jsonb,text,uuid,boolean)
from public, anon, authenticated;

-- Reassert both compatibility wrappers and their exact privilege boundary.
create or replace function public.checkout_cart_v2(
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
  select private.checkout_cart_internal_v2(
    p_shop_id, 'shipping', p_address, null, p_buyer_note, p_idempotency_key, true
  )
$$;

create or replace function public.checkout_cart_v3(
  p_shop_id bigint,
  p_fulfillment_method text,
  p_address jsonb,
  p_alt_contact jsonb,
  p_buyer_note text,
  p_idempotency_key uuid
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.checkout_cart_internal_v2(
    p_shop_id, p_fulfillment_method, p_address, p_alt_contact,
    p_buyer_note, p_idempotency_key, true
  )
$$;

revoke all on function public.checkout_cart_v2(bigint,jsonb,text,uuid)
from public, anon, authenticated;
revoke all on function public.checkout_cart_v3(bigint,text,jsonb,jsonb,text,uuid)
from public, anon, authenticated;
grant execute on function public.checkout_cart_v2(bigint,jsonb,text,uuid) to authenticated;
grant execute on function public.checkout_cart_v3(bigint,text,jsonb,jsonb,text,uuid) to authenticated;

-- The pickup table is seller-only. Every public/buyer read must cross the
-- existing shop_pickup_point reveal gate instead of depending on RLS accident.
revoke all on table public.shop_pickup_points from public, anon;

-- A shop card now promises the seller's chosen display name. Keep the private
-- names table closed and expose only the name attached to a public shop.
create function public.shop_seller_display_name(p_shop_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(names.display_name), ''),
    'Vendedor #' || upper(left(replace(shops.owner_id::text, '-', ''), 4))
  )
  from public.shops shops
  left join public.user_display_names names on names.user_id = shops.owner_id
  where shops.id = p_shop_id
$$;

revoke all on function public.shop_seller_display_name(bigint)
from public, anon, authenticated;
grant execute on function public.shop_seller_display_name(bigint) to anon, authenticated;

-- Forward rollback path:
-- 1. Drop public.shop_seller_display_name(bigint).
-- 2. Restore private.checkout_cart_internal_v2 and the wrapper grants from
--    20260827194356_add_order_fulfillment_method.sql.
-- 3. Recreate public.checkout_cart and the five-argument private implementation
--    from 20260820191826_add_buyer_trust_system.sql, then reapply the explicit
--    fulfillment_method insert from 20260827194356_add_order_fulfillment_method.sql.
-- The application/types intentionally have no v1 caller after this contract.
