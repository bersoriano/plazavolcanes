-- Sellers state how many units a listing covers. The cart is clamped in SQL rather than
-- only in the form, so a crafted request cannot order more than exist.
alter table public.products
  add column if not exists units_available smallint not null default 1
    check (units_available between 1 and 10);

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
  from public.products p join public.shops s on s.id = p.shop_id
  where p.id = p_product_id and p.status = 'published';
  if v_shop_id is null then raise exception using errcode = 'P0002', message = 'Producto no disponible.'; end if;
  if v_owner_id = v_user then raise exception using errcode = 'P0001', message = 'No puedes comprar en tu propia tienda.'; end if;
  if p_quantity > v_units then
    raise exception using errcode = '22023',
      message = format('Solo hay %s unidades disponibles.', v_units);
  end if;

  insert into public.carts (buyer_id, shop_id) values (v_user, v_shop_id)
  on conflict (buyer_id, shop_id) do update set updated_at = now()
  returning id into v_cart_id;

  insert into public.cart_items (cart_id, product_id, quantity)
  values (v_cart_id, p_product_id, p_quantity)
  on conflict (cart_id, product_id) do update
  -- Adding to an existing line must not walk past the available units either.
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
  where ci.id = p_cart_item_id and c.buyer_id = auth.uid();
  if v_units is null then raise exception using errcode = 'P0002', message = 'Producto no encontrado en tu carrito.'; end if;
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

-- Rollback:
-- restore both functions from 20260820173550_add_commerce_foundation.sql;
-- alter table public.products drop column units_available;
