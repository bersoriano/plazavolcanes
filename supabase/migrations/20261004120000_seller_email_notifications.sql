-- Sellers hear about new requests and buyer messages by email. The database
-- decides what is worth an email and keeps it in an outbox; an Edge Function
-- sends what is due through Resend. Nothing here holds the provider's key, and
-- until the Vault secrets below exist, emails wait in the outbox unsent.

create extension if not exists pg_net with schema extensions;

-- One switch per person. No row means emails are on.
create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "people read their own notification preferences"
  on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "people create their own notification preferences"
  on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "people update their own notification preferences"
  on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.notification_preferences from public, anon;
grant select, insert, update on table public.notification_preferences to authenticated;

create table private.notification_outbox (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('purchase_request', 'buyer_message', 'request_expiring')),
  order_id bigint references public.orders (id) on delete cascade,
  conversation_id bigint references public.conversations (id) on delete cascade,
  -- The buyer message that caused a buyer_message row; the throttle reads it.
  message_id bigint,
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

revoke all on table private.notification_outbox from public, anon, authenticated;

create index notification_outbox_due_idx on private.notification_outbox (available_at)
  where status in ('pending', 'sending');
create index notification_outbox_thread_idx on private.notification_outbox (conversation_id, id desc)
  where kind = 'buyer_message';

-- A new request is the email a seller most needs.
create or replace function private.enqueue_purchase_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.notification_outbox (recipient_id, kind, order_id, dedupe_key)
  select s.owner_id, 'purchase_request', new.id, 'purchase_request:' || new.id
  from public.shops s
  where s.id = new.shop_id
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke execute on function private.enqueue_purchase_request_notification() from public, anon, authenticated;

create trigger enqueue_purchase_request_notification
after insert on public.orders
for each row
when (new.status = 'requested')
execute function private.enqueue_purchase_request_notification();

-- A buyer writing is worth an email, but a conversation is not a mailing list:
-- once a thread has emailed the seller, it stays quiet for an hour unless the
-- seller has answered since. Message ids, not timestamps, say what came after.
create or replace function private.enqueue_buyer_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_owner_id uuid;
  v_order_id bigint;
  v_last_message_id bigint;
  v_last_created_at timestamptz;
begin
  select c.buyer_id, s.owner_id, c.order_id into v_buyer_id, v_owner_id, v_order_id
  from public.conversations c
  join public.shops s on s.id = c.shop_id
  where c.id = new.conversation_id;
  if v_buyer_id is null or new.sender_id <> v_buyer_id then return new; end if;

  select n.message_id, n.created_at into v_last_message_id, v_last_created_at
  from private.notification_outbox n
  where n.conversation_id = new.conversation_id and n.kind = 'buyer_message'
  order by n.id desc
  limit 1;

  if v_last_message_id is not null
    and v_last_created_at > now() - interval '1 hour'
    and not exists (
      select 1 from public.messages m
      where m.conversation_id = new.conversation_id
        and m.sender_id = v_owner_id
        and m.id > v_last_message_id
    ) then
    return new;
  end if;

  insert into private.notification_outbox (recipient_id, kind, order_id, conversation_id, message_id, dedupe_key)
  values (v_owner_id, 'buyer_message', v_order_id, new.conversation_id, new.id, 'buyer_message:' || new.id)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke execute on function private.enqueue_buyer_message_notification() from public, anon, authenticated;

create trigger enqueue_buyer_message_notification
after insert on public.messages
for each row
execute function private.enqueue_buyer_message_notification();

-- One warning per request, during its last day.
create or replace function private.enqueue_expiring_request_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_queued integer;
begin
  insert into private.notification_outbox (recipient_id, kind, order_id, dedupe_key)
  select s.owner_id, 'request_expiring', o.id, 'request_expiring:' || o.id
  from public.orders o
  join public.shops s on s.id = o.shop_id
  where o.status = 'requested'
    and o.decide_by_at > now()
    and o.decide_by_at <= now() + interval '24 hours'
  on conflict (dedupe_key) do nothing;

  get diagnostics v_queued = row_count;
  return v_queued;
end;
$$;

revoke execute on function private.enqueue_expiring_request_notifications() from public, anon, authenticated;

select cron.schedule(
  'plaza-warn-expiring-requests',
  '*/5 * * * *',
  'select private.enqueue_expiring_request_notifications()'
);

-- The sender's only way in. Rows that no longer deserve an email are retired
-- first: the seller switched emails off, or already decided the request. Then
-- due rows are leased for five minutes, so a sender that dies mid-batch hands
-- them back instead of losing them.
create or replace function public.claim_notification_batch(p_limit integer default 20)
returns table (
  id bigint,
  kind text,
  dedupe_key text,
  attempts integer,
  recipient_email text,
  order_id bigint,
  conversation_id bigint,
  shop_name text,
  product_name text,
  item_count integer,
  quantity integer,
  decide_by_at timestamptz,
  time_zone text
)
language sql
security definer
set search_path = ''
as $$
  update private.notification_outbox n
  set status = 'skipped', locked_until = null
  where n.status = 'pending'
    and (
      exists (
        select 1 from public.notification_preferences p
        where p.user_id = n.recipient_id and not p.email_enabled
      )
      or (
        n.kind in ('purchase_request', 'request_expiring')
        and exists (select 1 from public.orders o where o.id = n.order_id and o.status <> 'requested')
      )
    );

  with due as (
    select n.id
    from private.notification_outbox n
    where (n.status = 'pending' and n.available_at <= now())
       or (n.status = 'sending' and n.locked_until <= now())
    order by n.available_at, n.id
    limit greatest(p_limit, 0)
    for update skip locked
  ), leased as (
    update private.notification_outbox n
    set status = 'sending', locked_until = now() + interval '5 minutes', attempts = n.attempts + 1
    from due
    where n.id = due.id
    returning n.*
  )
  select
    l.id,
    l.kind,
    l.dedupe_key,
    l.attempts,
    u.email::text,
    o.id,
    l.conversation_id,
    s.name,
    coalesce(listed.name, first_item.product_name),
    items.item_count,
    items.quantity,
    o.decide_by_at,
    coalesce(o.handling_time_zone, s.time_zone)
  from leased l
  join auth.users u on u.id = l.recipient_id
  left join public.conversations c on c.id = l.conversation_id
  left join public.orders o on o.id = coalesce(l.order_id, c.order_id)
  left join public.shops s on s.id = coalesce(o.shop_id, c.shop_id)
  left join public.products listed on listed.id = c.product_id and c.type = 'pre_sale'
  left join lateral (
    select oi.product_name from public.order_items oi where oi.order_id = o.id order by oi.id limit 1
  ) first_item on true
  left join lateral (
    select count(*)::integer as item_count, sum(oi.quantity)::integer as quantity
    from public.order_items oi where oi.order_id = o.id
  ) items on true
  order by l.id;
$$;

revoke all on function public.claim_notification_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_batch(integer) to service_role;

-- Delivered, retried after 2^attempts minutes, or given up after five tries.
create or replace function public.complete_notification(p_id bigint, p_sent boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.notification_outbox n
  set
    status = case when p_sent then 'sent' when n.attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when p_sent then now() else n.sent_at end,
    available_at = case
      when p_sent or n.attempts >= 5 then n.available_at
      else now() + make_interval(mins => power(2, n.attempts)::integer)
    end,
    locked_until = null,
    last_error = case when p_sent then null else left(p_error, 500) end
  where n.id = p_id and n.status = 'sending';
$$;

revoke all on function public.complete_notification(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_notification(bigint, boolean, text) to service_role;

-- Wakes the sender only when something is due and it has been configured.
create or replace function private.dispatch_notifications()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  if not exists (
    select 1 from private.notification_outbox n
    where (n.status = 'pending' and n.available_at <= now())
       or (n.status = 'sending' and n.locked_until <= now())
  ) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notifications_function_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'notifications_dispatch_token';
  if v_url is null or v_token is null then return null; end if;

  return net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_token),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function private.dispatch_notifications() from public, anon, authenticated;

select cron.schedule(
  'plaza-dispatch-notifications',
  '* * * * *',
  'select private.dispatch_notifications()'
);

-- Rollback:
-- select cron.unschedule('plaza-dispatch-notifications');
-- select cron.unschedule('plaza-warn-expiring-requests');
-- drop function private.dispatch_notifications();
-- drop function public.complete_notification(bigint, boolean, text);
-- drop function public.claim_notification_batch(integer);
-- drop function private.enqueue_expiring_request_notifications();
-- drop trigger enqueue_buyer_message_notification on public.messages;
-- drop function private.enqueue_buyer_message_notification();
-- drop trigger enqueue_purchase_request_notification on public.orders;
-- drop function private.enqueue_purchase_request_notification();
-- drop table private.notification_outbox;
-- drop table public.notification_preferences;
