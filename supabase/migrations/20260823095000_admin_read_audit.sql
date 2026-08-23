-- Administrators could read any conversation through row level security,
-- leaving no trace of who looked or why. They keep the capability, because
-- disputes need it, but every use is now attributable.
create table public.admin_read_events (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id) on delete restrict,
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

create index admin_read_events_conversation_idx
on public.admin_read_events (conversation_id, created_at desc);

grant select on table public.admin_read_events to authenticated;

alter table public.admin_read_events enable row level security;

-- The audit trail is reviewable by administration itself.
create policy admin_read_events_admin_select on public.admin_read_events
for select to authenticated
using ((select public.is_current_user_admin()));

drop policy conversation_participants_select on public.conversations;
create policy conversation_participants_select on public.conversations
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.shops
    where shops.id = conversations.shop_id and shops.owner_id = (select auth.uid())
  )
);

drop policy message_participants_select on public.messages;
create policy message_participants_select on public.messages
for select to authenticated
using (exists (
  select 1 from public.conversations c join public.shops s on s.id = c.shop_id
  where c.id = messages.conversation_id
    and (c.buyer_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
));

create function public.read_conversation_as_admin(p_conversation_id bigint, p_reason text)
returns table (
  id bigint,
  sender_id uuid,
  sender_label text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501', message = 'Solo administración puede abrir una conversación.';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'Escribe el motivo de la consulta.';
  end if;

  if not exists (
    select 1 from public.conversations c where c.id = p_conversation_id
  ) then
    raise exception using errcode = 'P0002', message = 'Conversación no encontrada.';
  end if;

  -- Recorded before the rows are returned, in the same transaction, so a read
  -- cannot succeed without leaving its trace.
  insert into public.admin_read_events (admin_id, conversation_id, reason)
  values (v_user, p_conversation_id, v_reason);

  return query
  select
    m.id,
    m.sender_id,
    case
      when m.sender_id = c.buyer_id then private.display_label(c.buyer_id, d.display_name)
      else s.name
    end,
    m.body,
    m.created_at
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.shops s on s.id = c.shop_id
  left join public.user_display_names d on d.user_id = c.buyer_id
  where m.conversation_id = p_conversation_id
  order by m.id;
end;
$$;

revoke all on function public.read_conversation_as_admin(bigint, text) from public, anon;
grant execute on function public.read_conversation_as_admin(bigint, text) to authenticated;

-- Rollback:
-- drop function public.read_conversation_as_admin(bigint, text);
-- restore the administrator branches on both policies from 20260820173553_add_reviews_disputes.sql
-- drop table public.admin_read_events;
