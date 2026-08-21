-- Registration now collects a mobile number. It is private contact data, so it gets
-- its own table rather than joining the publicly readable trust profile.
create table if not exists public.user_contact_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+52[0-9]{10}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, update on table public.user_contact_details to authenticated;
grant select, insert, update, delete on table public.user_contact_details to service_role;

alter table public.user_contact_details enable row level security;

create policy "contact_details_are_private"
  on public.user_contact_details for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "owners_update_contact_details"
  on public.user_contact_details for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function private.handle_new_user_contact_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted text;
  digits text;
  national text;
begin
  submitted := new.raw_user_meta_data ->> 'phone';
  digits := regexp_replace(coalesce(submitted, ''), '[^0-9]', '', 'g');

  if length(digits) = 12 and left(digits, 2) = '52' then
    national := right(digits, 10);
  else
    national := digits;
  end if;

  insert into public.user_contact_details (user_id, phone)
  values (
    new.id,
    -- Sign-up metadata is client supplied: store it only when it is a real number,
    -- so a crafted payload cannot fail the constraint and block account creation.
    case when national ~ '^[0-9]{10}$' then '+52' || national else null end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_new_user_contact_details()
from public, anon, authenticated;

create trigger on_auth_user_created_contact_details
  after insert on auth.users
  for each row
  execute function private.handle_new_user_contact_details();

-- Existing accounts get an empty row they can fill from their account page.
insert into public.user_contact_details (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Rollback:
-- drop trigger on_auth_user_created_contact_details on auth.users;
-- drop function private.handle_new_user_contact_details();
-- drop table public.user_contact_details;
