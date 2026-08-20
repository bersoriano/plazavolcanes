alter table public.shops
  add column trust_tier text not null default 'standard'
    check (trust_tier in ('standard', 'reliable', 'top_rated')),
  add column listing_limit integer not null default 15 check (listing_limit > 0),
  add column trust_evaluated_at timestamptz,
  add column time_zone text not null default 'America/Mexico_City'
    check (time_zone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+\-]+)+$');

alter table public.products
  add column handling_days integer not null default 3
    check (handling_days between 1 and 30);

create table public.carts (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  shop_id bigint not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, shop_id)
);

create table public.cart_items (
  id bigint generated always as identity primary key,
  cart_id bigint not null references public.carts (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table public.orders (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  shop_id bigint not null references public.shops (id) on delete restrict,
  status text not null default 'requested' check (status in (
    'requested', 'accepted', 'shipped', 'delivered', 'completed',
    'rejected', 'canceled_by_buyer', 'canceled_by_seller', 'canceled_by_admin'
  )),
  idempotency_key uuid not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  buyer_note text check (buyer_note is null or char_length(buyer_note) between 1 and 1000),
  handling_days integer not null check (handling_days between 1 and 30),
  handling_time_zone text not null,
  accepted_at timestamptz,
  ship_by_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  buyer_confirmed_at timestamptz,
  auto_completed_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  canceled_by uuid references auth.users (id) on delete set null,
  tracking_text text check (tracking_text is null or char_length(tracking_text) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, idempotency_key)
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete restrict,
  product_id bigint references public.products (id) on delete set null,
  product_name text not null,
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  quantity integer not null check (quantity between 1 and 99),
  line_total numeric(14, 2) not null check (line_total >= 0),
  handling_days integer not null check (handling_days between 1 and 30),
  created_at timestamptz not null default now()
);

create table public.order_addresses (
  order_id bigint primary key references public.orders (id) on delete restrict,
  recipient text,
  address_line1 text,
  address_line2 text,
  locality text,
  administrative_area text,
  postal_code text,
  country_code text,
  delivery_instructions text,
  redacted_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient is null or char_length(recipient) between 2 and 120),
  check (address_line1 is null or char_length(address_line1) between 3 and 200),
  check (address_line2 is null or char_length(address_line2) <= 200),
  check (locality is null or char_length(locality) between 2 and 120),
  check (administrative_area is null or char_length(administrative_area) between 2 and 120),
  check (postal_code is null or char_length(postal_code) between 3 and 20),
  check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  check (delivery_instructions is null or char_length(delivery_instructions) <= 500)
);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete restrict,
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null check (actor_type in ('buyer', 'seller', 'admin', 'system')),
  event_type text not null check (event_type in (
    'requested', 'accepted', 'rejected', 'shipped', 'delivered', 'completed',
    'auto_completed', 'canceled_by_buyer', 'canceled_by_seller',
    'canceled_by_admin', 'admin_delivery_confirmed', 'admin_repair'
  )),
  previous_status text,
  next_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  unique (order_id, idempotency_key)
);

create index carts_shop_id_idx on public.carts (shop_id);
create index cart_items_product_id_idx on public.cart_items (product_id);
create index orders_buyer_created_idx on public.orders (buyer_id, created_at desc);
create index orders_shop_created_idx on public.orders (shop_id, created_at desc);
create index orders_status_idx on public.orders (status) where status not in ('completed', 'rejected', 'canceled_by_buyer', 'canceled_by_seller', 'canceled_by_admin');
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id) where product_id is not null;
create index order_events_order_created_idx on public.order_events (order_id, created_at);

create function private.shop_owner_id(p_shop_id bigint)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select owner_id from public.shops where id = p_shop_id
$$;

revoke execute on function private.shop_owner_id(bigint) from public, anon, authenticated;

create function private.guard_shop_trust_cache()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') and (
    new.trust_tier is distinct from old.trust_tier
    or new.listing_limit is distinct from old.listing_limit
    or new.trust_evaluated_at is distinct from old.trust_evaluated_at
  ) then
    raise exception using errcode = '42501', message = 'Los campos de confianza son administrados por el sistema.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_shop_trust_cache() from public, anon, authenticated;

create trigger guard_shop_trust_cache
before update on public.shops
for each row execute function private.guard_shop_trust_cache();

create function private.guard_product_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count bigint;
begin
  if tg_op = 'UPDATE' and new.shop_id <> old.shop_id then
    raise exception using errcode = '23514', message = 'No puedes mover un producto entre tiendas.';
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    select listing_limit into v_limit
    from public.shops
    where id = new.shop_id
    for update;

    select count(*) into v_count
    from public.products
    where shop_id = new.shop_id and status = 'published';

    if v_count >= v_limit then
      raise exception using errcode = 'P0001', message = 'Límite de publicaciones alcanzado.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_product_publication() from public, anon, authenticated;

create trigger guard_product_publication
before insert or update on public.products
for each row execute function private.guard_product_publication();

grant select on table public.carts, public.cart_items, public.orders, public.order_items, public.order_addresses, public.order_events to authenticated;
grant usage, select on sequence public.carts_id_seq, public.cart_items_id_seq, public.orders_id_seq, public.order_items_id_seq, public.order_events_id_seq to authenticated;

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_addresses enable row level security;
alter table public.order_events enable row level security;

create policy carts_buyer_select on public.carts for select to authenticated
using ((select auth.uid()) = buyer_id);

create policy cart_items_buyer_select on public.cart_items for select to authenticated
using (exists (select 1 from public.carts where carts.id = cart_items.cart_id and carts.buyer_id = (select auth.uid())));

create policy order_participants_select on public.orders for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.shops
    where shops.id = orders.shop_id and shops.owner_id = (select auth.uid())
  )
);

create policy order_items_participants_select on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
    and (
      orders.buyer_id = (select auth.uid())
      or exists (select 1 from public.shops where shops.id = orders.shop_id and shops.owner_id = (select auth.uid()))
    )
));

create policy order_addresses_participants_select on public.order_addresses for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_addresses.order_id
    and (
      orders.buyer_id = (select auth.uid())
      or exists (select 1 from public.shops where shops.id = orders.shop_id and shops.owner_id = (select auth.uid()))
    )
));

create policy order_events_participants_select on public.order_events for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_events.order_id
    and (
      orders.buyer_id = (select auth.uid())
      or exists (select 1 from public.shops where shops.id = orders.shop_id and shops.owner_id = (select auth.uid()))
    )
));

create function public.add_cart_item(p_product_id bigint, p_quantity integer default 1)
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
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_quantity not between 1 and 99 then raise exception using errcode = '22023', message = 'La cantidad debe estar entre 1 y 99.'; end if;

  select p.shop_id, s.owner_id into v_shop_id, v_owner_id
  from public.products p join public.shops s on s.id = p.shop_id
  where p.id = p_product_id and p.status = 'published';
  if v_shop_id is null then raise exception using errcode = 'P0002', message = 'Producto no disponible.'; end if;
  if v_owner_id = v_user then raise exception using errcode = 'P0001', message = 'No puedes comprar en tu propia tienda.'; end if;

  insert into public.carts (buyer_id, shop_id) values (v_user, v_shop_id)
  on conflict (buyer_id, shop_id) do update set updated_at = now()
  returning id into v_cart_id;

  insert into public.cart_items (cart_id, product_id, quantity)
  values (v_cart_id, p_product_id, p_quantity)
  on conflict (cart_id, product_id) do update
  set quantity = least(99, public.cart_items.quantity + excluded.quantity), updated_at = now();
  return v_cart_id;
end;
$$;

create function public.set_cart_item_quantity(p_cart_item_id bigint, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_quantity not between 1 and 99 then raise exception using errcode = '22023', message = 'La cantidad debe estar entre 1 y 99.'; end if;
  update public.cart_items ci set quantity = p_quantity, updated_at = now()
  from public.carts c
  where ci.id = p_cart_item_id and c.id = ci.cart_id and c.buyer_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Producto no encontrado en tu carrito.'; end if;
end;
$$;

create function public.remove_cart_item(p_cart_item_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  delete from public.cart_items ci using public.carts c
  where ci.id = p_cart_item_id and c.id = ci.cart_id and c.buyer_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Producto no encontrado en tu carrito.'; end if;
end;
$$;

create function public.checkout_cart(
  p_shop_id bigint,
  p_address jsonb,
  p_buyer_note text,
  p_idempotency_key uuid
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
    handling_days, handling_time_zone
  ) values (
    v_user, p_shop_id, p_idempotency_key, 'MXN', v_subtotal,
    nullif(btrim(p_buyer_note), ''), v_handling_days, v_time_zone
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

  insert into public.order_events (order_id, actor_id, actor_type, event_type, next_status, idempotency_key)
  values (v_order_id, v_user, 'buyer', 'requested', 'requested', p_idempotency_key);

  delete from public.carts where id = v_cart_id;
  return v_order_id;
end;
$$;

revoke all on function public.add_cart_item(bigint, integer) from public, anon;
revoke all on function public.set_cart_item_quantity(bigint, integer) from public, anon;
revoke all on function public.remove_cart_item(bigint) from public, anon;
revoke all on function public.checkout_cart(bigint, jsonb, text, uuid) from public, anon;
grant execute on function public.add_cart_item(bigint, integer) to authenticated;
grant execute on function public.set_cart_item_quantity(bigint, integer) to authenticated;
grant execute on function public.remove_cart_item(bigint) to authenticated;
grant execute on function public.checkout_cart(bigint, jsonb, text, uuid) to authenticated;
