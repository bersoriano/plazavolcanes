create table public.user_trust_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  joined_on date not null,
  verification_level text not null default 'unverified'
    check (verification_level in ('unverified', 'basic', 'verified', 'highly_verified'))
);

grant select on table public.user_trust_profiles to anon, authenticated;
grant select, insert, update, delete on table public.user_trust_profiles to service_role;

alter table public.user_trust_profiles enable row level security;

create policy "trust_profiles_are_public"
  on public.user_trust_profiles for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.shops
      where shops.owner_id = user_trust_profiles.user_id
    )
  );

create function private.handle_new_user_trust_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_trust_profiles (
    user_id,
    joined_on,
    verification_level
  )
  values (
    new.id,
    new.created_at::date,
    'unverified'
  );

  return new;
end;
$$;

revoke execute on function private.handle_new_user_trust_profile()
from public, anon, authenticated;

insert into public.user_trust_profiles (
  user_id,
  joined_on,
  verification_level
)
select
  id,
  created_at::date,
  'unverified'
from auth.users
on conflict (user_id) do nothing;

create trigger on_auth_user_created_trust_profile
  after insert on auth.users
  for each row execute function private.handle_new_user_trust_profile();
