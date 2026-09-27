-- A founding seat is earned by a shop the plaza has approved, and its 7 days
-- run from that approval.
--
-- A new shop's products stay hidden until administration approves the shop.
-- Counting the 7 days from opening made a slow review cost a seller part of
-- the window; letting an unapproved shop claim let a shop that would be
-- rejected take one of the 100 seats for good. Now:
--   * only an approved shop can claim a seat;
--   * its window starts at its first approval (or the plaza's opening, if
--     later);
--   * approving a shop that already has 8 published products claims at once.

alter table public.shops
  add column publishing_approved_at timestamptz;

-- Shops approved before this change: their last review is the best record of
-- when that happened.
update public.shops
set publishing_approved_at = publishing_reviewed_at
where is_publishing_approved;

-- The first approval is kept for good, like the seat: suspending and
-- re-approving a shop does not reopen its window. Only this trigger writes
-- the column, so a seller cannot move it.
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

create function private.claim_founding_seat_on_approval()
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

-- The claim's own no-op update leaves is_publishing_approved unchanged, so it
-- cannot fire this trigger again.
create trigger claim_founding_seat_on_approval
after update of is_publishing_approved on public.shops
for each row
when (new.is_publishing_approved and not old.is_publishing_approved)
execute function private.claim_founding_seat_on_approval();
