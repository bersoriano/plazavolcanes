-- The launch package (docs/launch-package.md).
--
-- Every shop publishes up to 25 live listings for free. The first 100 shops
-- that publish at least 8 items within 7 days earn a founding seat: 50 live
-- listings, locked, and a permanent badge. The seat is earned with inventory,
-- not by registering, and it is kept forever: deleting the shop does not hand
-- it to somebody else.
--
-- Listing caps no longer follow the trust tier. The evaluator still writes a
-- tier's limit; a trigger replaces it with the launch policy.

create table private.founders_program (
  id boolean primary key default true check (id),
  -- When the plaza opened to sellers. A shop opened earlier gets its 7 days
  -- from here, so the seed shops have the same chance as everybody else.
  opens_at timestamptz not null default now(),
  -- Optional: stop assigning seats before the 100 run out.
  closes_at timestamptz,
  cap integer not null default 100 check (cap > 0),
  min_live_items integer not null default 8 check (min_live_items > 0),
  qualify_window interval not null default interval '7 days',
  base_listing_limit integer not null default 25 check (base_listing_limit > 0),
  founder_listing_limit integer not null default 50 check (founder_listing_limit > 0)
);

revoke all on table private.founders_program from public, anon, authenticated;
alter table private.founders_program enable row level security;

insert into private.founders_program default values;

create table private.founding_shops (
  seat integer primary key check (seat > 0),
  -- Kept when the shop is deleted: the seat stays taken.
  shop_id bigint unique references public.shops (id) on delete set null,
  owner_id uuid not null,
  claimed_at timestamptz not null default now()
);

revoke all on table private.founding_shops from public, anon, authenticated;
alter table private.founding_shops enable row level security;

-- Public cache of the seat, like trust_tier: the badge, the founder theme
-- and the 90-day homepage rotation read it with the shop. Only the triggers
-- below write it.
alter table public.shops
  add column founder_since timestamptz;

alter table public.shops
  alter column listing_limit set default 25;

-- The cap a shop has under the launch policy.
create function private.launch_listing_limit(p_is_founder boolean)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when p_is_founder then p.founder_listing_limit else p.base_listing_limit end
  from private.founders_program p
$$;

revoke all on function private.launch_listing_limit(boolean) from public, anon, authenticated;

-- Applies the launch policy on every write to a shop. Named to fire after
-- guard_shop_trust_cache (before-triggers run in name order), which must
-- judge what the seller sent, not what this sets on top of it.
create function private.apply_launch_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.founder_since := null;
  else
    new.founder_since := (select f.claimed_at from private.founding_shops f where f.shop_id = new.id);
  end if;
  new.listing_limit := private.launch_listing_limit(new.founder_since is not null);
  return new;
end;
$$;

revoke all on function private.apply_launch_policy() from public, anon, authenticated;

create trigger zz_apply_launch_policy
before insert or update on public.shops
for each row
execute function private.apply_launch_policy();

-- Gives a shop a seat if it has just earned one: at least min_live_items
-- published within qualify_window of opening (or of the plaza's opening),
-- while seats remain and the programme is open. The programme row is locked
-- so two shops reaching 8 at once cannot both take seat 100.
create function private.claim_founding_seat(p_shop_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program private.founders_program%rowtype;
  v_shop public.shops%rowtype;
  v_published integer;
  v_taken integer;
begin
  select * into v_program from private.founders_program for update;
  if not found then return; end if;
  if v_program.closes_at is not null and now() >= v_program.closes_at then return; end if;
  if exists (select 1 from private.founding_shops f where f.shop_id = p_shop_id) then return; end if;

  select * into v_shop from public.shops s where s.id = p_shop_id;
  if not found then return; end if;
  if now() > greatest(v_shop.created_at, v_program.opens_at) + v_program.qualify_window then return; end if;

  select count(*) into v_published
  from public.products p
  where p.shop_id = p_shop_id and p.status = 'published';
  if v_published < v_program.min_live_items then return; end if;

  select count(*) into v_taken from private.founding_shops;
  if v_taken >= v_program.cap then return; end if;

  insert into private.founding_shops (seat, shop_id, owner_id)
  values (v_taken + 1, p_shop_id, v_shop.owner_id);

  -- A no-op write: apply_launch_policy caches the seat and raises the cap.
  update public.shops set updated_at = updated_at where id = p_shop_id;
end;
$$;

revoke all on function private.claim_founding_seat(bigint) from public, anon, authenticated;

create function private.claim_founding_seat_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    perform private.claim_founding_seat(new.shop_id);
  end if;
  return new;
end;
$$;

revoke all on function private.claim_founding_seat_on_publish() from public, anon, authenticated;

create trigger claim_founding_seat_on_publish
after insert or update of status on public.products
for each row
execute function private.claim_founding_seat_on_publish();

-- What the site shows: the cap, the seats taken and whether one can still
-- be earned. Counts only, so anyone may read it.
create function public.founders_status()
returns table (cap integer, taken integer, is_open boolean, min_live_items integer, qualify_days integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.cap,
         (select count(*)::integer from private.founding_shops) as taken,
         (p.closes_at is null or now() < p.closes_at)
           and (select count(*) from private.founding_shops) < p.cap as is_open,
         p.min_live_items,
         extract(day from p.qualify_window)::integer as qualify_days
  from private.founders_program p
$$;

revoke all on function public.founders_status() from public;
grant execute on function public.founders_status() to anon, authenticated;

-- Every existing shop moves to the launch cap now; none holds a seat yet.
update public.shops set updated_at = updated_at;
