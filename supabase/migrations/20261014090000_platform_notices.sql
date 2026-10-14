-- Administration writes to the people who use the plaza: one person at a time,
-- or an audience at once.
--
-- These are not conversations. A conversation has a shop and a buyer, every
-- message in it has a sending account, and every message starts the seller's
-- response clock, queues an email and counts against a rate limit. A notice has
-- no shop, no counterpart and no reply, so it gets a table of its own and meets
-- conversations only in the inbox.
--
-- Like every other administrator power, sending stays inside the database: the
-- application holds no service-role key, and a signed-in person holds no write
-- privilege on notices at all.

alter table private.admin_audit_events
  drop constraint admin_audit_events_action_check;

alter table private.admin_audit_events
  add constraint admin_audit_events_action_check
  check (action in ('admin_granted', 'admin_revoked', 'dispute_resolved',
                    'legal_version_published', 'shop_limit_changed',
                    'user_disabled', 'user_enabled', 'user_deleted',
                    'notice_sent', 'notice_retracted'));

-- One act of sending. It keeps its own copy of what was sent, so the history
-- still says what it was after a retraction removes the notices, and it is the
-- only place that knows which administrator sent it.
create table private.platform_notice_batches (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('person', 'everyone', 'sellers', 'buyers')),
  -- Set for 'person' only, and cleared if that account is deleted.
  recipient_id uuid references auth.users (id) on delete set null,
  title text not null,
  body text not null,
  action_href text,
  action_label text,
  sent_by uuid references auth.users (id) on delete set null,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  created_at timestamptz not null default now(),
  retracted_at timestamptz,
  retracted_by uuid references auth.users (id) on delete set null
);

alter table private.platform_notice_batches enable row level security;
revoke all on table private.platform_notice_batches from public, anon, authenticated;

create index platform_notice_batches_created_idx
  on private.platform_notice_batches (created_at desc);

-- One notice in one person's inbox. An announcement to two hundred people is
-- two hundred rows, each read on its own.
create table public.platform_notices (
  id bigint generated always as identity primary key,
  -- Cascade, unlike orders and conversations: a notice is nobody else's history,
  -- so it never stands in the way of deleting an account.
  recipient_id uuid not null references auth.users (id) on delete cascade,
  batch_id uuid not null references private.platform_notice_batches (id) on delete cascade,
  kind text not null check (kind in ('direct', 'announcement')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- A path inside the site and nothing else. The character set is closed on
  -- purpose: a browser drops tabs and line breaks from a URL, which would turn
  -- "/<tab>/other.site" into a link to another site.
  action_href text check (
    action_href is null
    or (char_length(action_href) <= 300
        and action_href ~ '^/([A-Za-z0-9_.~%-][A-Za-z0-9/_.~%?=&#-]*)?$')
  ),
  action_label text check (action_label is null or char_length(btrim(action_label)) between 1 and 40),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check ((action_href is null) = (action_label is null))
);

create index platform_notices_recipient_created_idx
  on public.platform_notices (recipient_id, created_at desc);
create index platform_notices_recipient_unread_idx
  on public.platform_notices (recipient_id) where read_at is null;
create index platform_notices_batch_idx
  on public.platform_notices (batch_id);

alter table public.platform_notices enable row level security;

create policy "people read their own platform notices"
  on public.platform_notices for select to authenticated
  using ((select auth.uid()) = recipient_id);

-- Read only. Reading state changes through mark_platform_notice_read, so a
-- recipient can never alter what a notice says.
revoke all on table public.platform_notices from public, anon, authenticated;
grant select on table public.platform_notices to authenticated;

-- Live arrival. Change events are filtered by the policy above, so publishing
-- the table adds no read surface.
alter publication supabase_realtime add table public.platform_notices;

-- Who an announcement reaches. One definition, used both to count an audience
-- before sending and to deliver to it, so the two can never disagree.
create function private.platform_notice_audience(p_audience text)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where not coalesce(u.banned_until > now(), false)
    and case p_audience
          when 'everyone' then true
          when 'sellers' then exists (select 1 from public.shops s where s.owner_id = u.id)
          when 'buyers' then not exists (select 1 from public.shops s where s.owner_id = u.id)
          else false
        end
$$;

revoke execute on function private.platform_notice_audience(text) from public, anon, authenticated;

create function public.send_platform_notice(
  p_audience text,
  p_recipient_id uuid,
  p_title text,
  p_body text,
  p_action_href text,
  p_action_label text
)
returns table (batch_id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_href text := nullif(btrim(coalesce(p_action_href, '')), '');
  v_label text := nullif(btrim(coalesce(p_action_label, '')), '');
  v_batch_id uuid := gen_random_uuid();
  v_count integer;
begin
  if v_actor_id is null or not exists (
    select 1 from private.admin_users a where a.user_id = v_actor_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede enviar avisos.';
  end if;

  if p_audience is null or p_audience not in ('person', 'everyone', 'sellers', 'buyers') then
    raise exception using errcode = '22023', message = 'Audiencia inválida.';
  end if;

  if p_audience = 'person' then
    if p_recipient_id is null then
      raise exception using errcode = '22023', message = 'Indica a quién va el aviso.';
    end if;

    if not exists (select 1 from auth.users u where u.id = p_recipient_id) then
      raise exception using errcode = 'P0002', message = 'No encontramos esa cuenta.';
    end if;
  elsif p_recipient_id is not null then
    raise exception using
      errcode = '22023',
      message = 'Un anuncio no lleva una persona destinataria.';
  end if;

  if char_length(v_title) not between 1 and 120 then
    raise exception using
      errcode = '22023',
      message = 'El título debe tener entre 1 y 120 caracteres.';
  end if;

  if char_length(v_body) not between 1 and 2000 then
    raise exception using
      errcode = '22023',
      message = 'El mensaje debe tener entre 1 y 2000 caracteres.';
  end if;

  if (v_href is null) <> (v_label is null) then
    raise exception using
      errcode = '22023',
      message = 'El enlace y el texto del botón van juntos.';
  end if;

  if v_href is not null and (
    char_length(v_href) > 300
    or v_href !~ '^/([A-Za-z0-9_.~%-][A-Za-z0-9/_.~%?=&#-]*)?$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'El enlace debe quedarse dentro de la plaza.';
  end if;

  if v_label is not null and char_length(v_label) > 40 then
    raise exception using
      errcode = '22023',
      message = 'El texto del botón debe tener 40 caracteres o menos.';
  end if;

  insert into private.platform_notice_batches (
    id, audience, recipient_id, title, body, action_href, action_label, sent_by
  ) values (
    v_batch_id,
    p_audience,
    case when p_audience = 'person' then p_recipient_id end,
    v_title, v_body, v_href, v_label, v_actor_id
  );

  if p_audience = 'person' then
    insert into public.platform_notices (
      recipient_id, batch_id, kind, title, body, action_href, action_label
    ) values (
      p_recipient_id, v_batch_id, 'direct', v_title, v_body, v_href, v_label
    );
  else
    -- One statement, so an announcement reaches its whole audience or nobody.
    insert into public.platform_notices (
      recipient_id, batch_id, kind, title, body, action_href, action_label
    )
    select a.user_id, v_batch_id, 'announcement', v_title, v_body, v_href, v_label
    from private.platform_notice_audience(p_audience) a;
  end if;

  get diagnostics v_count = row_count;

  -- Raising undoes the record of the send too: nothing is kept for a notice
  -- that reached nobody.
  if v_count = 0 then
    raise exception using errcode = 'P0002', message = 'No hay personas en esa audiencia.';
  end if;

  update private.platform_notice_batches b
  set recipient_count = v_count
  where b.id = v_batch_id;

  insert into private.admin_audit_events (actor_id, target_user_id, action, metadata)
  values (
    v_actor_id,
    case when p_audience = 'person' then p_recipient_id end,
    'notice_sent',
    jsonb_build_object(
      'batch_id', v_batch_id,
      'audience', p_audience,
      'recipient_count', v_count,
      'title', v_title
    )
  );

  return query select v_batch_id, v_count;
end;
$$;

revoke all on function public.send_platform_notice(text, uuid, text, text, text, text) from public, anon;
grant execute on function public.send_platform_notice(text, uuid, text, text, text, text) to authenticated;

-- A notice cannot be edited once sent. Retracting is the fix for a mistake: it
-- removes the notices from every inbox and leaves the send on record.
create function public.retract_platform_notice(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_retracted_at timestamptz;
  v_removed integer;
begin
  if v_actor_id is null or not exists (
    select 1 from private.admin_users a where a.user_id = v_actor_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede retirar avisos.';
  end if;

  select b.retracted_at
  into v_retracted_at
  from private.platform_notice_batches b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No encontramos ese envío.';
  end if;

  -- Already retracted: nothing to remove, and nothing new to audit.
  if v_retracted_at is not null then
    return 0;
  end if;

  delete from public.platform_notices n
  where n.batch_id = p_batch_id;

  get diagnostics v_removed = row_count;

  update private.platform_notice_batches b
  set retracted_at = now(),
      retracted_by = v_actor_id
  where b.id = p_batch_id;

  insert into private.admin_audit_events (actor_id, action, metadata)
  values (
    v_actor_id,
    'notice_retracted',
    jsonb_build_object('batch_id', p_batch_id, 'removed', v_removed)
  );

  return v_removed;
end;
$$;

revoke all on function public.retract_platform_notice(uuid) from public, anon;
grant execute on function public.retract_platform_notice(uuid) to authenticated;

-- How many people each audience would reach right now, so the form can say so
-- before anything is sent.
create function public.platform_notice_audience_counts()
returns table (audience text, people integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.admin_users a where a.user_id = auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede consultar audiencias.';
  end if;

  return query
  select
    names.name,
    (select count(*)::integer from private.platform_notice_audience(names.name))
  from (values ('everyone'), ('sellers'), ('buyers')) as names (name);
end;
$$;

revoke all on function public.platform_notice_audience_counts() from public, anon;
grant execute on function public.platform_notice_audience_counts() to authenticated;

-- The administration's history of what was sent, newest first.
create function public.list_platform_notice_batches()
returns table (
  batch_id uuid,
  audience text,
  recipient_label text,
  title text,
  body text,
  action_href text,
  action_label text,
  recipient_count integer,
  read_count integer,
  created_at timestamptz,
  retracted_at timestamptz
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
      message = 'Solo administración puede consultar los avisos enviados.';
  end if;

  return query
  select
    b.id,
    b.audience,
    -- Null for an audience, and for a person whose account is gone.
    case
      when b.recipient_id is not null
        then coalesce(nullif(btrim(d.display_name), ''), u.email::text)
    end,
    b.title,
    b.body,
    b.action_href,
    b.action_label,
    b.recipient_count,
    (
      select count(*)::integer
      from public.platform_notices n
      where n.batch_id = b.id and n.read_at is not null
    ),
    b.created_at,
    b.retracted_at
  from private.platform_notice_batches b
  left join auth.users u on u.id = b.recipient_id
  left join public.user_display_names d on d.user_id = b.recipient_id
  order by b.created_at desc, b.id
  limit 100;
end;
$$;

revoke all on function public.list_platform_notice_batches() from public, anon;
grant execute on function public.list_platform_notice_batches() to authenticated;

-- Read state is the one thing a recipient may change, and only on their own
-- notice. Any other id changes nothing and is not an error.
create function public.mark_platform_notice_read(p_notice_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.platform_notices n
  set read_at = now()
  where n.id = p_notice_id
    and n.recipient_id = auth.uid()
    and n.read_at is null
$$;

revoke all on function public.mark_platform_notice_read(bigint) from public, anon;
grant execute on function public.mark_platform_notice_read(bigint) to authenticated;

-- The header and the quick access bar read one number. It now counts unread
-- notices alongside unread messages; for anyone without notices it is unchanged.
create or replace function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (
      select count(*)
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      join public.shops s on s.id = c.shop_id
      left join public.conversation_reads r
        on r.conversation_id = c.id and r.user_id = auth.uid()
      where (c.buyer_id = auth.uid() or s.owner_id = auth.uid())
        and m.sender_id <> auth.uid()
        and (r.last_read_message_id is null or m.id > r.last_read_message_id)
    ) + (
      select count(*)
      from public.platform_notices n
      where n.recipient_id = auth.uid() and n.read_at is null
    )
  )::integer
$$;

revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

-- Rollback:
-- restore public.unread_message_count() from 20260823091000_add_conversation_reads.sql
-- drop function public.mark_platform_notice_read(bigint);
-- drop function public.list_platform_notice_batches();
-- drop function public.platform_notice_audience_counts();
-- drop function public.retract_platform_notice(uuid);
-- drop function public.send_platform_notice(text, uuid, text, text, text, text);
-- drop function private.platform_notice_audience(text);
-- alter publication supabase_realtime drop table public.platform_notices;
-- drop table public.platform_notices;
-- drop table private.platform_notice_batches;
-- restore admin_audit_events_action_check without the two notice_* actions,
--   after removing any such events.
