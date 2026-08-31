-- A shop states, in its own words, how it ships and how it hands things over in
-- person. Buyers read it on the public profile, so it must not swing from day to
-- day: a shop may rewrite it once a month.
--
-- The cadence is a trigger rather than a check in the server action, because
-- "owners_update_shops" lets a seller update their own row straight through the
-- API with their own token. The trigger also stamps the clock itself, so the
-- timestamp can never arrive from a browser.
alter table public.shops
  add column delivery_policy text
    check (delivery_policy is null or char_length(delivery_policy) <= 1200),
  add column delivery_policy_updated_at timestamptz;

comment on column public.shops.delivery_policy is
  'Seller-written shipping and in-person delivery conditions, changeable once a month.';

create function public.enforce_delivery_policy_cadence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.delivery_policy_updated_at := case
      when new.delivery_policy is null then null
      else now()
    end;
    return new;
  end if;

  -- Every other edit to the shop passes untouched, and the clock stays where it
  -- was: pinning it here is what stops a seller from ageing it with one write
  -- and then rewriting the policy with the next.
  if new.delivery_policy is not distinct from old.delivery_policy then
    new.delivery_policy_updated_at := old.delivery_policy_updated_at;
    return new;
  end if;

  if old.delivery_policy_updated_at is not null
    and old.delivery_policy_updated_at > now() - interval '30 days'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Puedes actualizar la política de entregas una vez al mes.';
  end if;

  new.delivery_policy_updated_at := now();
  return new;
end;
$$;

create trigger shops_delivery_policy_cadence
  before insert or update on public.shops
  for each row
  execute function public.enforce_delivery_policy_cadence();
