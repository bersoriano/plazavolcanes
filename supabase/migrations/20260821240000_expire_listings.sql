-- A listing stays in the plaza for 30 days. After that it expires, leaves the
-- catalogue, frees its listing slot, and waits for the seller to bring it back.
alter table public.products
  add column if not exists expires_at timestamptz;

do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.products'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%draft%published%';

  if v_constraint is not null then
    execute format('alter table public.products drop constraint %I', v_constraint);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_status_check' and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_status_check
        check (status in ('draft', 'published', 'expired'));
  end if;
end $$;

-- The clock starts at publication, not at creation: a draft never expires, and a
-- product brought back gets a full window. Editing a live listing does not extend it.
create or replace function private.set_product_expiry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.expires_at := now() + interval '30 days';
  elsif new.status = 'draft' then
    new.expires_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function private.set_product_expiry() from public, anon, authenticated;

drop trigger if exists set_product_expiry on public.products;
create trigger set_product_expiry
  before insert or update on public.products
  for each row
  execute function private.set_product_expiry();

-- Existing published listings start their window now rather than expiring at once.
update public.products
  set expires_at = now() + interval '30 days'
  where status = 'published' and expires_at is null;

create index if not exists products_expiring_idx
  on public.products (expires_at)
  where status = 'published';

create or replace function private.expire_due_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  update public.products
    set status = 'expired', updated_at = now()
    where status = 'published'
      and expires_at is not null
      and expires_at <= now();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke execute on function private.expire_due_products() from public, anon, authenticated;

select cron.schedule(
  'plaza-expire-listings',
  '0 * * * *',
  'select private.expire_due_products()'
);

-- Rollback:
-- select cron.unschedule('plaza-expire-listings');
-- drop function private.expire_due_products();
-- drop trigger set_product_expiry on public.products;
-- drop function private.set_product_expiry();
-- update public.products set status = 'published' where status = 'expired';
-- alter table public.products drop constraint products_status_check,
--   add constraint products_status_check check (status in ('draft', 'published')),
--   drop column expires_at;
