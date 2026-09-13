alter table public.shops
  add column is_premium boolean not null default false;

-- Who granted the distinction, and when, is administration's record, not the
-- shop's: public.shops is readable by anyone, so a grantor column there would
-- publish administrator account ids and, through owner_id, which shop owners
-- are administrators. Only set_shop_premium writes here, and no client role
-- can read it.
create table private.shop_premium_grants (
  shop_id bigint primary key references public.shops (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null
);

revoke all on table private.shop_premium_grants from public, anon, authenticated;
alter table private.shop_premium_grants enable row level security;

-- RLS lets a seller insert their own shop row with any column values, so the
-- update-time guard below is not enough: without this, an insert could hand
-- a shop the premium distinction on arrival. Scrub the flag the same way
-- apply_shop_publishing_approval scrubs publication approval on insert.
create function private.apply_shop_premium_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    new.is_premium := false;
  end if;
  return new;
end;
$$;

revoke all on function private.apply_shop_premium_defaults() from public, anon, authenticated;

create trigger apply_shop_premium_defaults
before insert on public.shops
for each row
execute function private.apply_shop_premium_defaults();

-- The distinction is administration's decision, so it joins the trust fields a
-- seller may read but never write.
create or replace function private.guard_shop_trust_cache()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') and (
    new.trust_tier is distinct from old.trust_tier
    or new.listing_limit is distinct from old.listing_limit
    or new.trust_evaluated_at is distinct from old.trust_evaluated_at
    or new.is_publishing_approved is distinct from old.is_publishing_approved
    or new.publishing_reviewed_at is distinct from old.publishing_reviewed_at
    or new.is_premium is distinct from old.is_premium
  ) then
    raise exception using
      errcode = '42501',
      message = 'Los campos de confianza y publicación son administrados por el sistema.';
  end if;
  return new;
end;
$$;

create function public.set_shop_premium(p_shop_id bigint, p_enabled boolean)
returns table (shop_id bigint, shop_slug text, product_slugs text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop_slug text;
  v_was_premium boolean;
  v_product_slugs text[];
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede cambiar la distinción Premium.';
  end if;

  select s.is_premium
  into v_was_premium
  from public.shops s
  where s.id = p_shop_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;

  update public.shops s
  set is_premium = p_enabled,
      updated_at = now()
  where s.id = p_shop_id
  returning s.slug into v_shop_slug;

  if p_enabled then
    -- Granting a shop that already holds the distinction is not a new
    -- decision, so the original grant keeps its moment and its grantor.
    insert into private.shop_premium_grants as g (shop_id, granted_at, granted_by)
    values (p_shop_id, now(), auth.uid())
    -- Named by constraint: a bare shop_id here collides with the output column.
    on conflict on constraint shop_premium_grants_pkey do update
      set granted_at = excluded.granted_at,
          granted_by = excluded.granted_by
      where not v_was_premium;
  else
    delete from private.shop_premium_grants g
    where g.shop_id = p_shop_id;
  end if;

  select coalesce(array_agg(p.slug order by p.id), '{}'::text[])
  into v_product_slugs
  from public.products p
  where p.shop_id = p_shop_id
    and p.status = 'published';

  return query select p_shop_id, v_shop_slug, v_product_slugs;
end;
$$;

revoke all on function public.set_shop_premium(bigint, boolean) from public, anon;
grant execute on function public.set_shop_premium(bigint, boolean) to authenticated;

drop function public.list_admin_marketplace_users();

create function public.list_admin_marketplace_users()
returns table (
  user_id uuid,
  email text,
  user_created_at timestamp with time zone,
  display_name text,
  shop_limit integer,
  shop_id bigint,
  shop_name text,
  shop_slug text,
  shop_created_at timestamp with time zone,
  shop_is_publishing_approved boolean,
  shop_is_premium boolean,
  product_id bigint,
  product_name text,
  product_slug text,
  product_status text,
  product_is_admin_enabled boolean,
  product_expires_at timestamp with time zone,
  product_created_at timestamp with time zone,
  product_updated_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501',
      message = 'Solo administración puede consultar usuarios.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    d.display_name,
    private.shop_limit_for(u.id),
    s.id,
    s.name,
    s.slug,
    s.created_at,
    s.is_publishing_approved,
    s.is_premium,
    p.id,
    p.name,
    p.slug,
    p.status,
    p.is_admin_enabled,
    p.expires_at,
    p.created_at,
    p.updated_at
  from auth.users u
  left join public.user_display_names d on d.user_id = u.id
  left join public.shops s on s.owner_id = u.id
  left join public.products p
    on p.shop_id = s.id and p.status in ('draft', 'published', 'expired')
  order by u.created_at desc, u.id, s.created_at desc nulls last, s.id,
           p.created_at desc nulls last, p.id;
end;
$$;

revoke all on function public.list_admin_marketplace_users() from public, anon;
grant execute on function public.list_admin_marketplace_users() to authenticated;
