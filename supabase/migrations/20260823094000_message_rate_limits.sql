-- Pre-sale chat lets any signed-in account reach any shop, which is a spam
-- surface the order-only system never had. Counters follow the shape already
-- used by private.telemetry_rate_limits: hourly buckets, written only by
-- security-definer functions, unreachable from a browser role.
create table private.message_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_hour timestamptz not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  conversations_opened integer not null default 0 check (conversations_opened >= 0),
  primary key (user_id, window_hour)
);

revoke all on table private.message_rate_limits from public, anon, authenticated;

create function private.prune_message_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.message_rate_limits where window_hour < now() - interval '24 hours'
$$;

revoke execute on function private.prune_message_rate_limits() from public, anon, authenticated;

create or replace function public.send_conversation_message(
  p_conversation_id bigint,
  p_body text,
  p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id bigint;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if not exists (
    select 1 from public.conversations c join public.shops s on s.id = c.shop_id
    where c.id = p_conversation_id and (c.buyer_id = v_user or s.owner_id = v_user)
  ) then
    raise exception using errcode = '42501', message = 'No puedes escribir en esta conversación.';
  end if;

  if char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'El mensaje debe tener entre 1 y 2000 caracteres.';
  end if;

  -- The idempotency check stays ahead of the rate limit: a retry of a message
  -- the server already stored is the client being careful, not a new send.
  select id into v_id from public.messages
  where conversation_id = p_conversation_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  insert into private.message_rate_limits (user_id, window_hour, sent_count)
  values (v_user, date_trunc('hour', now()), 1)
  on conflict (user_id, window_hour) do update
    set sent_count = private.message_rate_limits.sent_count + 1
    where private.message_rate_limits.sent_count < 60;

  if not found then
    raise exception using errcode = 'P0001',
      message = 'Enviaste demasiados mensajes. Intenta de nuevo en un rato.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, idempotency_key)
  values (p_conversation_id, v_user, btrim(p_body), p_idempotency_key)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.start_pre_sale_conversation(p_shop_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_id bigint;
  v_opened integer;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  select owner_id into v_owner from public.shops where id = p_shop_id;
  if v_owner is null then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;
  if v_owner = v_user then
    raise exception using errcode = 'P0001', message = 'No puedes abrir una conversación contigo.';
  end if;

  -- Re-opening a thread that already exists is free. Only a genuinely new
  -- conversation spends quota, so a returning shopper is never throttled for
  -- coming back to a shop they already talked to.
  select id into v_id from public.conversations
  where buyer_id = v_user and shop_id = p_shop_id and type = 'pre_sale';

  if v_id is not null then
    update public.conversations set updated_at = now() where id = v_id;
    return v_id;
  end if;

  select coalesce(sum(conversations_opened), 0) into v_opened
  from private.message_rate_limits
  where user_id = v_user and window_hour > now() - interval '24 hours';

  if v_opened >= 10 then
    raise exception using errcode = 'P0001',
      message = 'Abriste demasiadas conversaciones hoy. Intenta de nuevo mañana.';
  end if;

  insert into public.conversations (shop_id, buyer_id, type)
  values (p_shop_id, v_user, 'pre_sale')
  returning id into v_id;

  insert into private.message_rate_limits (user_id, window_hour, conversations_opened)
  values (v_user, date_trunc('hour', now()), 1)
  on conflict (user_id, window_hour) do update
    set conversations_opened = private.message_rate_limits.conversations_opened + 1;

  return v_id;
end;
$$;

-- Rollback, only after callers no longer depend on rate limiting:
-- restore both function bodies from 20260820173552_add_fulfillment_communication.sql
-- drop function private.prune_message_rate_limits();
-- drop table private.message_rate_limits;
