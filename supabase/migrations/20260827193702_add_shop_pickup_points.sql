-- A shop that offers collection needs a real address, and that address is a
-- seller's home or workshop. It lives in its own table rather than in columns on
-- `shops` for two reasons: `shops` is read with `select *` in getPublicShop and on
-- the seller's manage page, and Postgres checks column privileges through the
-- star, so withholding a column there would break both queries for every shop.
-- And the sensitivity is per row — one shop, one pickup point — which is exactly
-- what row-level security is for.
create table public.shop_pickup_points (
  shop_id bigint primary key references public.shops (id) on delete cascade,
  address_line1 text not null,
  locality text not null,
  administrative_area_code text not null,
  postal_code text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The row's existence is the flag: a shop offers collection exactly when it has
-- one. Every field but the notes is required, so a half-filled address cannot be
-- stored and no cross-table completeness check is needed.
alter table public.shop_pickup_points
  add constraint shop_pickup_points_area_format_check
    check (administrative_area_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'),
  add constraint shop_pickup_points_postal_code_check
    check (postal_code ~ '^[0-9]{5}$'),
  add constraint shop_pickup_points_notes_length_check
    check (notes is null or length(notes) <= 500),
  add constraint shop_pickup_points_address_line1_length_check
    check (length(btrim(address_line1)) between 3 and 200),
  add constraint shop_pickup_points_locality_length_check
    check (length(btrim(locality)) between 2 and 120);

-- A check constraint cannot read another table, so the country agreement is a
-- trigger. Without it a shop in Jalisco could advertise collection in MX-YUC or,
-- worse, in another country entirely.
create function private.check_pickup_point_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country text;
begin
  select country_code into v_country from public.shops where id = new.shop_id;
  if v_country is null then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;
  if new.administrative_area_code not like v_country || '-%' then
    raise exception using errcode = 'P0001',
      message = 'El estado de recolección debe pertenecer al país de la tienda.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.check_pickup_point_country() from public, anon, authenticated;

create trigger shop_pickup_points_country_check
before insert or update on public.shop_pickup_points
for each row execute function private.check_pickup_point_country();

alter table public.shop_pickup_points enable row level security;

grant select, insert, update, delete on table public.shop_pickup_points to authenticated;
grant select, insert, update, delete on table public.shop_pickup_points to service_role;

-- The only policy. Buyers never read this table directly; they go through
-- shop_pickup_point below, which is what keeps the reveal gate in one place.
create policy "owners_manage_pickup_point"
  on public.shop_pickup_points for all
  to authenticated
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_pickup_points.shop_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.shops s
      where s.id = shop_pickup_points.shop_id and s.owner_id = (select auth.uid())
    )
  );

-- That a shop offers collection in Zapopan, Jalisco is storefront information.
-- The street is not, until the seller has accepted the order that will be
-- collected. A buyer whose request is still pending gets the coarse form, and so
-- does everybody else.
create function public.shop_pickup_point(p_shop_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_point public.shop_pickup_points%rowtype;
  v_user uuid := auth.uid();
  v_full boolean := false;
begin
  select * into v_point from public.shop_pickup_points where shop_id = p_shop_id;
  if v_point.shop_id is null then return null; end if;

  if v_user is not null then
    v_full := exists (
      select 1 from public.shops s
      where s.id = p_shop_id and s.owner_id = v_user
    ) or exists (
      select 1 from public.orders o
      where o.shop_id = p_shop_id
        and o.buyer_id = v_user
        and o.status in ('accepted', 'shipped', 'delivered', 'completed')
    );
  end if;

  if v_full then
    return jsonb_build_object(
      'locality', v_point.locality,
      'administrative_area_code', v_point.administrative_area_code,
      'address_line1', v_point.address_line1,
      'postal_code', v_point.postal_code,
      'notes', v_point.notes
    );
  end if;

  return jsonb_build_object(
    'locality', v_point.locality,
    'administrative_area_code', v_point.administrative_area_code
  );
end;
$$;

revoke all on function public.shop_pickup_point(bigint) from public;
grant execute on function public.shop_pickup_point(bigint) to anon, authenticated;

-- Rollback:
-- drop function public.shop_pickup_point(bigint);
-- drop trigger shop_pickup_points_country_check on public.shop_pickup_points;
-- drop function private.check_pickup_point_country();
-- drop table public.shop_pickup_points;
