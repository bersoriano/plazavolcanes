-- A purchase request now holds the units it asks for. Checkout locks, checks and
-- subtracts them in the same transaction that creates the order, and an order
-- that ends without a sale puts them back exactly once. Until now the column was
-- a claim checked only when adding to a cart, so one unit could be ordered by
-- any number of buyers.

-- Zero is how a published listing says it sold out; 999 leaves room for a shop
-- with real inventory. Drafts may still leave the field empty.
alter table public.products drop constraint products_units_available_check;
alter table public.products
  add constraint products_units_available_check check (units_available between 0 and 999);

-- Only an order that took units can give them back. Orders placed before this
-- migration never did, so they keep the default and never release anything.
alter table public.orders
  add column stock_reserved boolean not null default false;

create or replace function public.add_cart_item(p_product_id bigint, p_quantity integer default 1)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_shop_id bigint;
  v_owner_id uuid;
  v_cart_id bigint;
  v_units smallint;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_quantity not between 1 and 99 then raise exception using errcode = '22023', message = 'La cantidad debe estar entre 1 y 99.'; end if;

  select p.shop_id, s.owner_id, p.units_available into v_shop_id, v_owner_id, v_units
  from public.products p
  join public.shops s on s.id = p.shop_id
  where p.id = p_product_id
    and p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now();
  if v_shop_id is null then raise exception using errcode = 'P0002', message = 'Producto no disponible.'; end if;
  if v_owner_id = v_user then raise exception using errcode = 'P0001', message = 'No puedes comprar en tu propia tienda.'; end if;
  if coalesce(v_units, 0) < 1 then
    raise exception using errcode = '22023', message = 'Este producto se agotó.';
  end if;
  if p_quantity > v_units then
    raise exception using errcode = '22023', message = format('Solo hay %s unidades disponibles.', v_units);
  end if;

  insert into public.carts (buyer_id, shop_id) values (v_user, v_shop_id)
  on conflict (buyer_id, shop_id) do update set updated_at = now()
  returning id into v_cart_id;

  insert into public.cart_items (cart_id, product_id, quantity)
  values (v_cart_id, p_product_id, p_quantity)
  on conflict (cart_id, product_id) do update
  set quantity = least(v_units, public.cart_items.quantity + excluded.quantity), updated_at = now();
  return v_cart_id;
end;
$$;

create or replace function public.set_cart_item_quantity(p_cart_item_id bigint, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_units smallint;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_quantity not between 1 and 99 then raise exception using errcode = '22023', message = 'La cantidad debe estar entre 1 y 99.'; end if;

  select p.units_available into v_units
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id
  join public.products p on p.id = ci.product_id
  join public.shops s on s.id = p.shop_id
  where ci.id = p_cart_item_id
    and c.buyer_id = auth.uid()
    and p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now();
  if not found then raise exception using errcode = 'P0002', message = 'Producto no encontrado en tu carrito.'; end if;
  if coalesce(v_units, 0) < 1 then
    raise exception using errcode = '22023', message = 'Este producto se agotó.';
  end if;
  if p_quantity > v_units then
    raise exception using errcode = '22023',
      message = format('Solo hay %s unidades disponibles.', v_units);
  end if;

  update public.cart_items ci set quantity = p_quantity, updated_at = now()
  from public.carts c
  where ci.id = p_cart_item_id and c.id = ci.cart_id and c.buyer_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Producto no encontrado en tu carrito.'; end if;
end;
$$;

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
  v_short_name text;
  v_short_units integer;
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

  -- Hold every listing in the cart, lowest id first: two checkouts that share
  -- products queue in the same order instead of deadlocking, and the second one
  -- reads the units the first one left.
  perform 1
  from public.products p
  where p.id in (select ci.product_id from public.cart_items ci where ci.cart_id = v_cart_id)
  order by p.id
  for update;

  select count(*), sum(p.price_mxn * ci.quantity), max(p.handling_days)
  into v_item_count, v_subtotal, v_handling_days
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  join public.shops s on s.id = p.shop_id
  where ci.cart_id = v_cart_id
    and p.shop_id = p_shop_id
    and p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now();
  if v_item_count = 0 or v_item_count <> (select count(*) from public.cart_items where cart_id = v_cart_id) then
    raise exception using errcode = 'P0001', message = 'Uno o más productos ya no están disponibles.';
  end if;

  select p.name, coalesce(p.units_available, 0)
  into v_short_name, v_short_units
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id
    and ci.quantity > coalesce(p.units_available, 0)
  order by p.id
  limit 1;
  if v_short_name is not null then
    raise exception using errcode = 'P0001', message = case
      when v_short_units = 0 then format('«%s» se agotó.', v_short_name)
      when v_short_units = 1 then format('Solo queda 1 unidad de «%s».', v_short_name)
      else format('Solo quedan %s unidades de «%s».', v_short_units, v_short_name)
    end;
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

  if v_contact_name is null and (v_contact_phone is not null or v_contact_note is not null) then
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
    fulfillment_method, alt_contact_name, alt_contact_phone, alt_contact_note,
    stock_reserved
  ) values (
    v_user, p_shop_id, p_idempotency_key, 'MXN', v_subtotal,
    nullif(btrim(p_buyer_note), ''), v_handling_days, v_time_zone,
    p_payment_confirmation_required,
    p_fulfillment_method, v_contact_name, v_contact_phone, v_contact_note,
    true
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, currency_code,
    quantity, line_total, handling_days
  )
  select v_order_id, p.id, p.name, p.price_mxn, p.currency_code,
    ci.quantity, p.price_mxn * ci.quantity, p.handling_days
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id;

  update public.products p
  set units_available = p.units_available - ci.quantity
  from public.cart_items ci
  where ci.cart_id = v_cart_id and p.id = ci.product_id;

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

-- Every way an order can end without a sale passes through a status update, so
-- the units go back here rather than in each function that ends an order. The
-- flag is cleared in the same row write, which is what makes a second release
-- impossible. A seller who cancels because the stock is gone keeps it gone.
create or replace function private.release_order_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (new.status = 'canceled_by_seller' and new.seller_cancellation_reason is not distinct from 'inventory_unavailable') then
    -- Same lowest-id-first order as checkout, so the two never wait on each other in a cycle.
    perform 1
    from public.products p
    where p.id in (select oi.product_id from public.order_items oi where oi.order_id = new.id)
    order by p.id
    for update;

    update public.products p
    set units_available = least(999, coalesce(p.units_available, 0) + returned.quantity)
    from (
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id = new.id and oi.product_id is not null
      group by oi.product_id
    ) returned
    where p.id = returned.product_id;
  end if;

  new.stock_reserved := false;
  return new;
end;
$$;

revoke execute on function private.release_order_stock() from public, anon, authenticated;

create trigger release_order_stock
before update of status on public.orders
for each row
when (
  old.stock_reserved
  and new.status in ('rejected', 'canceled_by_buyer', 'canceled_by_seller', 'canceled_by_admin')
)
execute function private.release_order_stock();

revoke all on function public.add_cart_item(bigint, integer) from public, anon;
grant execute on function public.add_cart_item(bigint, integer) to authenticated;
revoke all on function public.set_cart_item_quantity(bigint, integer) from public, anon;
grant execute on function public.set_cart_item_quantity(bigint, integer) to authenticated;
revoke execute on function private.checkout_cart_internal_v2(bigint,text,jsonb,jsonb,text,uuid,boolean)
from public, anon, authenticated;

-- Rollback:
-- drop trigger release_order_stock on public.orders;
-- drop function private.release_order_stock();
-- restore add_cart_item, set_cart_item_quantity and checkout_cart_internal_v2
--   from 20260829055734_shop_publication_moderation.sql;
-- alter table public.orders drop column stock_reserved;
-- update public.products set units_available = least(greatest(units_available, 1), 10);
-- alter table public.products drop constraint products_units_available_check;
-- alter table public.products add constraint products_units_available_check check (units_available between 1 and 10);
