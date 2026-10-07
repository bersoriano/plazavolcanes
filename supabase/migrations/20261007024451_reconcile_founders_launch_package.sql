-- Brings a database that ran the early draft of 20260927090000_add_founding_shops
-- to the launch package that file now describes (docs/launch-package.md).
--
-- The hosted database applied that migration while it still held the draft:
-- founding spots by registration order, a year of Premium and 50 listings,
-- and a nightly job to expire them. The file was then rewritten in place, so
-- the hosted database never got the launch package, and
-- 20260928090000_founders_window_from_approval installed its seat claim on
-- top of tables that were not there.
--
-- Every step is guarded. On a database that ran the current file there is no
-- draft to remove and the launch package is already in place, so nothing
-- changes beyond re-applying the launch policy to each shop.

-- 1. The draft's triggers go first, so nothing below re-applies its perks.
drop trigger if exists zz_apply_founder_perks on public.shops;
drop trigger if exists record_shop_registration on public.shops;

-- 2. The draft made every founding shop Premium for a year. The launch package
--    grants no Premium, so a shop keeps it only with administration's grant
--    (set_shop_premium always records one). Read before the ledger goes.
do $$
begin
  if to_regclass('private.shop_registrations') is not null then
    update public.shops s
    set is_premium = exists (select 1 from private.shop_premium_grants g where g.shop_id = s.id)
    where s.is_premium
      and s.id in (select r.shop_id from private.shop_registrations r where r.shop_id is not null);
  end if;
end;
$$;

-- 3. The rest of the draft.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'plaza-expire-founder-perks') then
    perform cron.unschedule('plaza-expire-founder-perks');
  end if;
end;
$$;

drop function if exists public.current_user_is_founder();
drop function if exists public.is_founding_shop(bigint);
drop function if exists public.founders_status();
drop function if exists private.expire_founder_perks();
drop function if exists private.record_shop_registration();
drop function if exists private.apply_founder_perks();
drop function if exists private.active_founder_listing_limit(bigint);
drop function if exists private.founding_registrations();
drop table if exists private.shop_registrations;

-- 4. The programme. The draft's row held a registration window and perks;
--    the launch package's holds the opening, the cap and the two limits. A
--    replaced row opens now: the launch package starts when it reaches the
--    database, so the shops already there get their 7 days from today.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'private' and table_name = 'founders_program' and column_name = 'opens_at'
  ) then
    drop table private.founders_program;

    create table private.founders_program (
      id boolean primary key default true check (id),
      opens_at timestamptz not null default now(),
      closes_at timestamptz,
      cap integer not null default 100 check (cap > 0),
      min_live_items integer not null default 8 check (min_live_items > 0),
      qualify_window interval not null default interval '7 days',
      base_listing_limit integer not null default 25 check (base_listing_limit > 0),
      founder_listing_limit integer not null default 50 check (founder_listing_limit > 0)
    );

    insert into private.founders_program default values;
  end if;
end;
$$;

revoke all on table private.founders_program from public, anon, authenticated;
alter table private.founders_program enable row level security;

create table if not exists private.founding_shops (
  seat integer primary key check (seat > 0),
  shop_id bigint unique references public.shops (id) on delete set null,
  owner_id uuid not null,
  claimed_at timestamptz not null default now()
);

revoke all on table private.founding_shops from public, anon, authenticated;
alter table private.founding_shops enable row level security;

-- 5. The shop columns the launch package reads.
alter table public.shops
  add column if not exists founder_since timestamptz;

alter table public.shops
  alter column listing_limit set default 25;

-- 6. The launch package's functions and triggers, as 20260927090000 and
--    20260928090000 now leave them.
create or replace function private.launch_listing_limit(p_is_founder boolean)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when p_is_founder then p.founder_listing_limit else p.base_listing_limit end
  from private.founders_program p
$$;

revoke all on function private.launch_listing_limit(boolean) from public, anon, authenticated;

create or replace function private.apply_launch_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.founder_since := null;
    new.publishing_approved_at := case when new.is_publishing_approved then now() end;
  else
    new.founder_since := (select f.claimed_at from private.founding_shops f where f.shop_id = new.id);
    new.publishing_approved_at := coalesce(
      old.publishing_approved_at,
      case when new.is_publishing_approved then now() end
    );
  end if;
  new.listing_limit := private.launch_listing_limit(new.founder_since is not null);
  return new;
end;
$$;

revoke all on function private.apply_launch_policy() from public, anon, authenticated;

create or replace trigger zz_apply_launch_policy
before insert or update on public.shops
for each row
execute function private.apply_launch_policy();

create or replace function private.claim_founding_seat(p_shop_id bigint)
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
  if not v_shop.is_publishing_approved or v_shop.publishing_approved_at is null then return; end if;
  if now() > greatest(v_shop.publishing_approved_at, v_program.opens_at) + v_program.qualify_window then return; end if;

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

create or replace function private.claim_founding_seat_on_publish()
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

create or replace trigger claim_founding_seat_on_publish
after insert or update of status on public.products
for each row
execute function private.claim_founding_seat_on_publish();

create or replace function private.claim_founding_seat_on_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.claim_founding_seat(new.id);
  return new;
end;
$$;

revoke all on function private.claim_founding_seat_on_approval() from public, anon, authenticated;

create or replace trigger claim_founding_seat_on_approval
after update of is_publishing_approved on public.shops
for each row
when (new.is_publishing_approved and not old.is_publishing_approved)
execute function private.claim_founding_seat_on_approval();

-- 7. The counter, in the launch package's shape (dropped above: a function's
--    result columns cannot change in place).
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

-- 8. Every shop under the launch policy: the founder cache from the seat
--    ledger and the cap from the programme.
update public.shops set updated_at = updated_at;
