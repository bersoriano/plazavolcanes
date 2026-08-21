-- The public activity badge should reflect whether the seller themselves has used
-- the plaza recently, which order events alone never captured: a seller who signs
-- in daily but has nothing to ship looked inactive.
create table if not exists public.user_activity (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

grant select on table public.user_activity to authenticated;
grant select, insert, update, delete on table public.user_activity to service_role;

alter table public.user_activity enable row level security;

-- Presence is personal data. Only the owner reads the timestamp; everyone else
-- sees at most a day count, through the public metrics function below.
create policy "own_activity_is_readable"
  on public.user_activity for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.touch_user_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;

  insert into public.user_activity (user_id, last_seen_at)
  values (v_user, now())
  on conflict (user_id) do update
    -- One write per hour is enough to place somebody inside a three-day window.
    set last_seen_at = now()
    where public.user_activity.last_seen_at < now() - interval '1 hour';
end;
$$;

revoke execute on function public.touch_user_activity() from public, anon;
grant execute on function public.touch_user_activity() to authenticated;

-- Every new account starts with a presence row, the same way trust profiles and
-- contact details do, so a seller is never missing from the badge.
create function private.handle_new_user_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_activity (user_id, last_seen_at)
  values (new.id, coalesce(new.last_sign_in_at, new.created_at, now()))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_new_user_activity() from public, anon, authenticated;

create trigger on_auth_user_created_activity
  after insert on auth.users
  for each row
  execute function private.handle_new_user_activity();

-- Existing accounts start from whatever the auth system already knows.
insert into public.user_activity (user_id, last_seen_at)
select id, coalesce(last_sign_in_at, created_at)
from auth.users
on conflict (user_id) do nothing;

-- Republish the metrics with the seller's own presence alongside shop activity.
drop function if exists public.shop_public_trust_metrics(bigint);

create function public.shop_public_trust_metrics(p_shop_id bigint)
returns table(
  average_reply_time_minutes numeric,
  response_rate numeric,
  description_accuracy numeric,
  on_time_shipping_rate numeric,
  order_completion_rate numeric,
  dispute_rate numeric,
  total_orders bigint,
  average_rating numeric,
  review_count bigint,
  last_active_days_ago integer,
  seller_active_days_ago integer,
  evaluated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    evaluations.average_reply_time_minutes,
    evaluations.response_rate,
    evaluations.description_accuracy,
    evaluations.on_time_shipping_rate,
    evaluations.order_completion_rate,
    evaluations.dispute_rate,
    evaluations.total_orders,
    evaluations.average_rating,
    evaluations.review_count,
    evaluations.last_active_days_ago,
    seller_presence.days_ago,
    evaluations.evaluated_at
  from public.shops
  left join lateral (
    select (extract(epoch from (now() - activity.last_seen_at)) / 86400)::integer as days_ago
    from public.user_activity as activity
    where activity.user_id = shops.owner_id
  ) as seller_presence on true
  left join lateral (
    select *
    from public.shop_trust_evaluations as evaluation
    where evaluation.shop_id = shops.id
    order by evaluation.evaluated_at desc, evaluation.id desc
    limit 1
  ) as evaluations on true
  where shops.id = p_shop_id;
$$;

revoke execute on function public.shop_public_trust_metrics(bigint) from public;
grant execute on function public.shop_public_trust_metrics(bigint) to anon, authenticated;

-- Rollback:
-- drop trigger on_auth_user_created_activity on auth.users;
-- drop function private.handle_new_user_activity();
-- restore shop_public_trust_metrics from 20260821160000_public_shop_trust_metrics.sql;
-- drop function public.touch_user_activity();
-- drop table public.user_activity;
