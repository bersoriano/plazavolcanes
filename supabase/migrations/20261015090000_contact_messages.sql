-- Anyone can write to the plaza from /quejas-y-aclaraciones: a visitor leaves a
-- name, an email and a phone with their message, and a signed-in person leaves
-- only the message, because the account already says who they are.
--
-- This is the first thing a person without an account can store here, so no
-- browser role touches the table at all. It lives in private, like the record
-- of who sent which notice, and three functions are its whole surface: one to
-- write, open to everyone and counted, and two for administration.

create table private.contact_messages (
  id uuid primary key default gen_random_uuid(),
  -- Cleared if the account is deleted: the message is the plaza's to answer,
  -- so it never stands in the way of deleting an account.
  user_id uuid references auth.users (id) on delete set null,
  -- A copy taken when the message was written, for an account too, so it still
  -- says who to answer once the account is gone. Whether a visitor left a name
  -- and a phone is the writing function's rule and not a constraint here: an
  -- account may have neither, and deleting it leaves a row with no user_id.
  name text check (name is null or char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) <= 254 and position('@' in email) > 1),
  phone text check (phone is null or phone ~ '^\+52[0-9]{10}$'),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at timestamptz not null default now(),
  attended_at timestamptz,
  attended_by uuid references auth.users (id) on delete set null
);

alter table private.contact_messages enable row level security;
revoke all on table private.contact_messages from public, anon, authenticated;

create index contact_messages_waiting_idx
  on private.contact_messages (created_at desc) where attended_at is null;
create index contact_messages_created_idx
  on private.contact_messages (created_at desc);

-- Hourly buckets, the shape private.message_rate_limits already uses. A
-- signed-in person has a bucket of their own. Everyone who is signed out shares
-- one, named 'anon': the database sees no address for them, and a shared cap is
-- what keeps a script from filling the table.
create table private.contact_rate_limits (
  sender text not null,
  window_hour timestamptz not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  primary key (sender, window_hour)
);

alter table private.contact_rate_limits enable row level security;
revoke all on table private.contact_rate_limits from public, anon, authenticated;

create function public.submit_contact_message(
  p_message text,
  p_name text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_message text := btrim(coalesce(p_message, ''));
  v_name text;
  v_email text;
  v_phone text;
  v_id uuid;
begin
  if char_length(v_message) not between 10 and 2000 then
    raise exception using
      errcode = '22023',
      message = 'El mensaje debe tener entre 10 y 2000 caracteres.';
  end if;

  if v_user is not null then
    -- Whatever the form carried, the account is who wrote.
    select
      u.email::text,
      nullif(btrim(d.display_name), ''),
      c.phone
    into v_email, v_name, v_phone
    from auth.users u
    left join public.user_display_names d on d.user_id = u.id
    left join public.user_contact_details c on c.user_id = u.id
    where u.id = v_user;

    if v_email is null then
      raise exception using errcode = '22023', message = 'Tu cuenta no tiene un correo.';
    end if;

    -- A name the account allows but this table would not is left out rather
    -- than turned into a refusal the person can do nothing about.
    if char_length(v_name) not between 2 and 120 then
      v_name := null;
    end if;
  else
    v_name := btrim(coalesce(p_name, ''));
    v_email := btrim(coalesce(p_email, ''));
    v_phone := btrim(coalesce(p_phone, ''));

    if char_length(v_name) not between 2 and 120 then
      raise exception using errcode = '22023', message = 'Escribe tu nombre.';
    end if;

    if char_length(v_email) > 254 or position('@' in v_email) < 2 then
      raise exception using errcode = '22023', message = 'Escribe un correo válido.';
    end if;

    if v_phone !~ '^\+52[0-9]{10}$' then
      raise exception using
        errcode = '22023',
        message = 'Escribe tu teléfono móvil a 10 dígitos.';
    end if;
  end if;

  -- Counted only once the message is known to be storable, so a refusal costs
  -- the sender nothing.
  insert into private.contact_rate_limits (sender, window_hour, sent_count)
  values (coalesce(v_user::text, 'anon'), date_trunc('hour', now()), 1)
  on conflict (sender, window_hour) do update
    set sent_count = private.contact_rate_limits.sent_count + 1
    where private.contact_rate_limits.sent_count
      < case when v_user is null then 30 else 5 end;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Recibimos demasiados mensajes. Intenta de nuevo en un rato.';
  end if;

  delete from private.contact_rate_limits r
  where r.window_hour < now() - interval '24 hours';

  insert into private.contact_messages (user_id, name, email, phone, message)
  values (v_user, v_name, v_email, v_phone, v_message)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text)
  to anon, authenticated;

-- What has arrived: what still waits first, then newest first.
create function public.list_contact_messages()
returns table (
  id uuid,
  has_account boolean,
  name text,
  email text,
  phone text,
  message text,
  created_at timestamptz,
  attended_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.admin_users a where a.user_id = auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede leer los mensajes de contacto.';
  end if;

  return query
  select
    m.id,
    m.user_id is not null,
    m.name,
    m.email,
    m.phone,
    m.message,
    m.created_at,
    m.attended_at
  from private.contact_messages m
  order by (m.attended_at is not null), m.created_at desc, m.id
  limit 200;
end;
$$;

revoke all on function public.list_contact_messages() from public, anon;
grant execute on function public.list_contact_messages() to authenticated;

-- Marking takes nothing from anyone, so it is not audited apart: the row itself
-- says who attended it and when.
create function public.mark_contact_message_attended(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null or not exists (
    select 1 from private.admin_users a where a.user_id = v_actor_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede atender mensajes de contacto.';
  end if;

  if not exists (select 1 from private.contact_messages m where m.id = p_message_id) then
    raise exception using errcode = 'P0002', message = 'No encontramos ese mensaje.';
  end if;

  -- Already attended: whoever attended it first stays on record.
  update private.contact_messages m
  set attended_at = now(),
      attended_by = v_actor_id
  where m.id = p_message_id
    and m.attended_at is null;
end;
$$;

revoke all on function public.mark_contact_message_attended(uuid) from public, anon;
grant execute on function public.mark_contact_message_attended(uuid) to authenticated;

-- Rollback:
-- drop function public.mark_contact_message_attended(uuid);
-- drop function public.list_contact_messages();
-- drop function public.submit_contact_message(text, text, text, text);
-- drop table private.contact_rate_limits;
-- drop table private.contact_messages;
