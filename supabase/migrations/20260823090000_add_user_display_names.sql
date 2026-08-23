-- A seller talking to a buyer before any order exists has no name to address.
-- Order addresses carry a recipient, but a pre-sale conversation has no order,
-- so a name of its own is needed. It is deliberately not public: it is read
-- only inside a conversation both people are already part of.
create table public.user_display_names (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 40),
  updated_at timestamptz not null default now()
);

-- No grant to authenticated. Names reach a browser only through the
-- conversation functions, which have already established participation.
revoke all on table public.user_display_names from public, anon, authenticated;
grant select, insert, update, delete on table public.user_display_names to service_role;

alter table public.user_display_names enable row level security;

-- Every read path needs the same fallback, so it lives in one place.
create function private.display_label(p_user_id uuid, p_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(p_name), ''),
    'Comprador #' || upper(left(replace(p_user_id::text, '-', ''), 4))
  )
$$;

revoke execute on function private.display_label(uuid, text) from public, anon, authenticated;

create function private.handle_new_user_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted text;
begin
  submitted := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  -- Sign-up metadata is client supplied: store it only when it satisfies the
  -- constraint, so a crafted payload cannot block account creation.
  if char_length(submitted) between 2 and 40 then
    insert into public.user_display_names (user_id, display_name)
    values (new.id, submitted)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function private.handle_new_user_display_name()
from public, anon, authenticated;

create trigger on_auth_user_created_display_name
  after insert on auth.users
  for each row
  execute function private.handle_new_user_display_name();

create function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if char_length(v_name) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'Tu nombre debe tener entre 2 y 40 caracteres.';
  end if;

  insert into public.user_display_names (user_id, display_name)
  values (v_user, v_name)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = now();
end;
$$;

revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

create function public.my_display_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select display_name from public.user_display_names where user_id = auth.uid()
$$;

revoke all on function public.my_display_name() from public, anon;
grant execute on function public.my_display_name() to authenticated;

-- Existing accounts get no row on purpose. They read as the fallback handle
-- until the person sets a name from their account page, so nobody is nagged
-- and no backfill invents a name for them.

-- Rollback:
-- drop trigger on_auth_user_created_display_name on auth.users;
-- drop function private.handle_new_user_display_name();
-- drop function public.my_display_name();
-- drop function public.set_display_name(text);
-- drop function private.display_label(uuid, text);
-- drop table public.user_display_names;
