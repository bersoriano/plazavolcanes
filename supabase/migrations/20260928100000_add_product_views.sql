-- Shop analytics, first of the seller tools founders get early
-- (docs/launch-package.md): how often each product is opened, and what those
-- visits turn into.
--
-- A view is a count per product per day. Nothing about the visitor is kept:
-- no user id, no address, no cookie. The shop's owner looking at their own
-- product does not count.

create table private.product_view_days (
  product_id bigint not null references public.products (id) on delete cascade,
  day date not null default ((now() at time zone 'America/Mexico_City')::date),
  views integer not null default 0 check (views >= 0),
  primary key (product_id, day)
);

revoke all on table private.product_view_days from public, anon, authenticated;
alter table private.product_view_days enable row level security;

-- Counts one visit to a public product page. Silently ignores anything that
-- is not publicly visible, and the owner's own visits.
create function public.record_product_view(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = p_product_id
      and p.status = 'published'
      and p.is_admin_enabled
      and s.is_publishing_approved
      and s.owner_id is distinct from auth.uid()
  ) then
    return;
  end if;

  insert into private.product_view_days as v (product_id, views)
  values (p_product_id, 1)
  on conflict (product_id, day) do update set views = v.views + 1;
end;
$$;

revoke all on function public.record_product_view(bigint) from public;
grant execute on function public.record_product_view(bigint) to anon, authenticated;

-- A shop's products over the last p_days: visits, questions (pre-sale
-- conversations started about the product) and orders that included it.
-- Only the shop's owner may read it.
create function public.shop_product_stats(p_shop_id bigint, p_days integer default 30)
returns table (product_id bigint, name text, slug text, status text, views bigint, questions bigint, orders bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 90)));
begin
  if auth.uid() is null or not exists (
    select 1 from public.shops s where s.id = p_shop_id and s.owner_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Solo quien administra la tienda puede ver sus estadísticas.';
  end if;

  return query
  select p.id,
         p.name,
         p.slug,
         p.status,
         coalesce((
           select sum(v.views)::bigint from private.product_view_days v
           where v.product_id = p.id and v.day >= (v_since at time zone 'America/Mexico_City')::date
         ), 0),
         (
           select count(*) from public.conversations c
           where c.product_id = p.id and c.type = 'pre_sale' and c.created_at >= v_since
         ),
         (
           select count(distinct i.order_id) from public.order_items i
           where i.product_id = p.id and i.created_at >= v_since
         )
  from public.products p
  where p.shop_id = p_shop_id and p.status <> 'deleted';
end;
$$;

revoke all on function public.shop_product_stats(bigint, integer) from public, anon;
grant execute on function public.shop_product_stats(bigint, integer) to authenticated;
