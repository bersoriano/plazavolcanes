-- Import help (docs/launch-package.md): a seller who already sells on Mercado
-- Libre or Facebook pastes the links to those listings, and the team turns
-- them into drafts in the shop by hand. The seller then checks each draft and
-- publishes it. Automating the copy can come later; the request queue is the
-- same either way.

create table private.listing_import_requests (
  id bigint generated always as identity primary key,
  shop_id bigint not null references public.shops (id) on delete cascade,
  requested_by uuid not null,
  links text[] not null check (cardinality(links) between 1 and 50),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create index listing_import_requests_pending_idx
  on private.listing_import_requests (created_at)
  where status = 'pending';

revoke all on table private.listing_import_requests from public, anon, authenticated;
alter table private.listing_import_requests enable row level security;

create function private.assert_shop_owner(p_shop_id bigint)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.shops s where s.id = p_shop_id and s.owner_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Solo quien administra la tienda puede hacer esto.';
  end if;
end;
$$;

revoke all on function private.assert_shop_owner(bigint) from public, anon, authenticated;

-- A shop asks for its listings to be brought over. Up to 50 links, each an
-- http(s) address, and at most 3 requests waiting at once.
create function public.request_listing_import(p_shop_id bigint, p_links text[], p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_links text[];
  v_id bigint;
begin
  perform private.assert_shop_owner(p_shop_id);

  select coalesce(array_agg(distinct btrim(link)), '{}') into v_links
  from unnest(p_links) as link
  where btrim(link) <> '';

  if cardinality(v_links) = 0 or cardinality(v_links) > 50 then
    raise exception using errcode = '22023', message = 'Pega entre 1 y 50 enlaces.';
  end if;
  if exists (select 1 from unnest(v_links) as link where link !~* '^https?://[^\s]+$' or char_length(link) > 500) then
    raise exception using errcode = '22023', message = 'Cada línea debe ser un enlace que empiece con https://.';
  end if;
  if (select count(*) from private.listing_import_requests r where r.shop_id = p_shop_id and r.status = 'pending') >= 3 then
    raise exception using errcode = 'P0001', message = 'Ya tienes 3 solicitudes en espera. Te avisamos cuando estén listas.';
  end if;

  insert into private.listing_import_requests (shop_id, requested_by, links, note)
  values (p_shop_id, auth.uid(), v_links, nullif(btrim(p_note), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_listing_import(bigint, text[], text) from public, anon;
grant execute on function public.request_listing_import(bigint, text[], text) to authenticated;

-- The shop's own requests, newest first.
create function public.shop_import_requests(p_shop_id bigint)
returns table (id bigint, link_count integer, status text, created_at timestamptz, handled_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_shop_owner(p_shop_id);

  return query
  select r.id, cardinality(r.links), r.status, r.created_at, r.handled_at
  from private.listing_import_requests r
  where r.shop_id = p_shop_id
  order by r.created_at desc
  limit 10;
end;
$$;

revoke all on function public.shop_import_requests(bigint) from public, anon;
grant execute on function public.shop_import_requests(bigint) to authenticated;

-- Administration's queue: waiting requests first, oldest first.
create function public.admin_import_requests()
returns table (
  id bigint, shop_id bigint, shop_name text, shop_slug text, links text[], note text,
  status text, created_at timestamptz, handled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501', message = 'Solo administración puede ver las solicitudes.';
  end if;

  return query
  select r.id, r.shop_id, s.name, s.slug, r.links, r.note, r.status, r.created_at, r.handled_at
  from private.listing_import_requests r
  join public.shops s on s.id = r.shop_id
  where r.status = 'pending' or r.handled_at > now() - interval '14 days'
  order by (r.status = 'pending') desc, r.created_at
  limit 100;
end;
$$;

revoke all on function public.admin_import_requests() from public, anon;
grant execute on function public.admin_import_requests() to authenticated;

create function public.complete_import_request(p_request_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501', message = 'Solo administración puede cerrar solicitudes.';
  end if;

  update private.listing_import_requests
  set status = 'done', handled_at = now()
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception using errcode = 'P0002', message = 'La solicitud no existe o ya estaba lista.';
  end if;
end;
$$;

revoke all on function public.complete_import_request(bigint) from public, anon;
grant execute on function public.complete_import_request(bigint) to authenticated;
