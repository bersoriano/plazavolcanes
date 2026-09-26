-- Founding stores: the first 100 stores registered during the first three
-- months get 1 free store, up to 50 published articles and Premium status
-- for their first year, plus the "Tienda fundadora" badge.
--
-- Registration order is a ledger, not a flag on the shop: an owner's first
-- store is recorded once and never removed, so deleting a store does not hand
-- its spot to somebody else, and moving the window re-ranks nothing by hand.
-- Who is a founder is computed from that ledger, the window and the cap.

create table private.founders_program (
  id boolean primary key default true check (id),
  starts_at timestamptz not null,
  -- Three months from the start unless administration sets another end.
  ends_at timestamptz not null,
  cap integer not null default 100 check (cap > 0),
  perk_listing_limit integer not null default 50 check (perk_listing_limit > 0),
  perk_period interval not null default interval '1 year',
  check (ends_at > starts_at)
);

revoke all on table private.founders_program from public, anon, authenticated;
alter table private.founders_program enable row level security;

create table private.shop_registrations (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  -- Kept when the store is deleted: the spot stays taken.
  shop_id bigint unique references public.shops (id) on delete set null,
  registered_at timestamptz not null
);

revoke all on table private.shop_registrations from public, anon, authenticated;
alter table private.shop_registrations enable row level security;

create index shop_registrations_registered_at_idx
  on private.shop_registrations (registered_at, owner_id);

-- Every owner's first store, ranked inside the window. Ties on the same
-- instant fall back to the owner id so the order never changes between reads.
create function private.founding_registrations()
returns table (owner_id uuid, shop_id bigint, registered_at timestamptz, founder_rank bigint, perks_until timestamptz)
language sql
stable
set search_path = ''
as $$
  select r.owner_id,
         r.shop_id,
         r.registered_at,
         row_number() over (order by r.registered_at, r.owner_id) as founder_rank,
         r.registered_at + p.perk_period as perks_until
  from private.shop_registrations r
  cross join private.founders_program p
  where r.registered_at >= p.starts_at
    and r.registered_at < p.ends_at
  order by r.registered_at, r.owner_id
  limit (select cap from private.founders_program)
$$;

revoke all on function private.founding_registrations() from public, anon, authenticated;

-- The perks a shop holds right now: null when it is not a founder or its
-- first year is over.
create function private.active_founder_listing_limit(p_shop_id bigint)
returns integer
language sql
stable
set search_path = ''
as $$
  select p.perk_listing_limit
  from private.founding_registrations() f
  cross join private.founders_program p
  where f.shop_id = p_shop_id
    and now() < f.perks_until
$$;

revoke all on function private.active_founder_listing_limit(bigint) from public, anon, authenticated;

-- Floors a founder's limits while its perks last. It runs on every update,
-- including evaluate_shop_trust writing the tier's limit, so a founder at
-- Estándar keeps 50 and one at Mejor valorada keeps 100. Premium stays on;
-- an administrator's own grant (private.shop_premium_grants) outlives it.
create function private.apply_founder_perks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.active_founder_listing_limit(new.id);
begin
  if v_limit is not null then
    new.listing_limit := greatest(new.listing_limit, v_limit);
    new.is_premium := true;
  end if;
  return new;
end;
$$;

revoke all on function private.apply_founder_perks() from public, anon, authenticated;

-- Named to fire last: before-triggers run in name order, and
-- guard_shop_trust_cache must judge what the seller sent, not the floor this
-- adds on top of it.
create trigger zz_apply_founder_perks
before update on public.shops
for each row
execute function private.apply_founder_perks();

-- Records an owner's first store and, if it lands a founding spot, applies
-- the perks at once rather than at the next trust evaluation.
create function private.record_shop_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.shop_registrations (owner_id, shop_id, registered_at)
  values (new.owner_id, new.id, new.created_at)
  on conflict (owner_id) do nothing;

  if private.active_founder_listing_limit(new.id) is not null then
    -- A no-op update: apply_founder_perks does the rest.
    update public.shops set updated_at = updated_at where id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function private.record_shop_registration() from public, anon, authenticated;

create trigger record_shop_registration
after insert on public.shops
for each row
execute function private.record_shop_registration();

-- Once a founder's first year is over its limits return to its tier and its
-- Premium status to whatever administration granted.
create function private.expire_founder_perks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with ended as (
    select f.shop_id
    from private.founding_registrations() f
    where f.shop_id is not null
      and f.perks_until <= now()
  )
  update public.shops s
  set listing_limit = case s.trust_tier when 'top_rated' then 100 when 'reliable' then 40 else 15 end,
      is_premium = exists (select 1 from private.shop_premium_grants g where g.shop_id = s.id)
  from ended
  where s.id = ended.shop_id
    and (
      s.listing_limit <> case s.trust_tier when 'top_rated' then 100 when 'reliable' then 40 else 15 end
      or s.is_premium <> exists (select 1 from private.shop_premium_grants g where g.shop_id = s.id)
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.expire_founder_perks() from public, anon, authenticated;

select cron.schedule(
  'plaza-expire-founder-perks',
  '30 0 * * *',
  'select private.expire_founder_perks()'
);

-- What the site shows: the cap, the spots taken, the window, and whether a
-- new store can still land a spot. Counts only, so anyone may read it.
create function public.founders_status()
returns table (cap integer, taken integer, starts_at timestamptz, ends_at timestamptz, is_open boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.cap,
         (select count(*)::integer from private.founding_registrations()) as taken,
         p.starts_at,
         p.ends_at,
         now() >= p.starts_at
           and now() < p.ends_at
           and (select count(*) from private.founding_registrations()) < p.cap as is_open
  from private.founders_program p
$$;

revoke all on function public.founders_status() from public;
grant execute on function public.founders_status() to anon, authenticated;

-- Whether a store is a founder. The badge is public, like the store itself.
create function public.is_founding_shop(p_shop_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.founding_registrations() f where f.shop_id = p_shop_id)
$$;

revoke all on function public.is_founding_shop(bigint) from public;
grant execute on function public.is_founding_shop(bigint) to anon, authenticated;

-- Whether the signed-in owner runs a founding store, for /vender.
create function public.current_user_is_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.founding_registrations() f
    where f.owner_id = (select auth.uid()) and f.shop_id is not null
  )
$$;

revoke all on function public.current_user_is_founder() from public, anon;
grant execute on function public.current_user_is_founder() to authenticated;

-- Backfill: every existing owner's first store, in registration order. The
-- window opens with the plaza's first store; administration moves it with
--   update private.founders_program set starts_at = …, ends_at = …;
insert into private.shop_registrations (owner_id, shop_id, registered_at)
select distinct on (s.owner_id) s.owner_id, s.id, s.created_at
from public.shops s
order by s.owner_id, s.created_at, s.id;

insert into private.founders_program (starts_at, ends_at)
select coalesce(min(s.created_at), now()), coalesce(min(s.created_at), now()) + interval '3 months'
from public.shops s;

update public.shops s
set updated_at = s.updated_at
where exists (select 1 from private.founding_registrations() f where f.shop_id = s.id);
