-- Unread state is per person, not per message, so one row per participant per
-- conversation is enough. Anything newer than the stored id and sent by the
-- other party is unread.
create table public.conversation_reads (
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_message_id bigint not null references public.messages (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

grant select on table public.conversation_reads to authenticated;

alter table public.conversation_reads enable row level security;

-- Read state is personal. Administrators have no arbitration interest in it.
create policy conversation_reads_are_personal on public.conversation_reads
for select to authenticated
using (user_id = (select auth.uid()));

create function private.is_conversation_participant(p_conversation_id bigint, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.shops s on s.id = c.shop_id
    where c.id = p_conversation_id
      and (c.buyer_id = p_user_id or s.owner_id = p_user_id)
  )
$$;

revoke execute on function private.is_conversation_participant(bigint, uuid)
from public, anon, authenticated;

create function public.mark_conversation_read(p_conversation_id bigint, p_last_message_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if not private.is_conversation_participant(p_conversation_id, v_user) then
    raise exception using errcode = '42501', message = 'No participas en esta conversación.';
  end if;

  if not exists (
    select 1 from public.messages
    where id = p_last_message_id and conversation_id = p_conversation_id
  ) then
    raise exception using errcode = '22023', message = 'Ese mensaje no pertenece a esta conversación.';
  end if;

  insert into public.conversation_reads (conversation_id, user_id, last_read_message_id)
  values (p_conversation_id, v_user, p_last_message_id)
  on conflict (conversation_id, user_id) do update
    -- A slow request finishing out of order must never resurrect read messages.
    set last_read_message_id = greatest(
          excluded.last_read_message_id,
          public.conversation_reads.last_read_message_id
        ),
        updated_at = now();
end;
$$;

revoke all on function public.mark_conversation_read(bigint, bigint) from public, anon;
grant execute on function public.mark_conversation_read(bigint, bigint) to authenticated;

create function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(count(*), 0)::integer
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.shops s on s.id = c.shop_id
  left join public.conversation_reads r
    on r.conversation_id = c.id and r.user_id = auth.uid()
  where (c.buyer_id = auth.uid() or s.owner_id = auth.uid())
    and m.sender_id <> auth.uid()
    and (r.last_read_message_id is null or m.id > r.last_read_message_id)
$$;

revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

-- Rollback:
-- drop function public.unread_message_count();
-- drop function public.mark_conversation_read(bigint, bigint);
-- drop function private.is_conversation_participant(bigint, uuid);
-- drop table public.conversation_reads;
