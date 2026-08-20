create table private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table private.admin_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('admin_granted', 'admin_revoked', 'dispute_resolved')),
  related_dispute_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on table private.admin_users, private.admin_audit_events from public, anon, authenticated;
revoke all on sequence private.admin_audit_events_id_seq from public, anon, authenticated;
alter table private.admin_users enable row level security;
alter table private.admin_audit_events enable row level security;

create function private.audit_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.admin_audit_events (actor_id, target_user_id, action)
  values (
    case when tg_op = 'INSERT' then new.granted_by else auth.uid() end,
    case when tg_op = 'INSERT' then new.user_id else old.user_id end,
    case when tg_op = 'INSERT' then 'admin_granted' else 'admin_revoked' end
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_admin_membership() from public, anon, authenticated;

create trigger audit_admin_membership
after insert or delete on private.admin_users
for each row execute function private.audit_admin_membership();

create function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admin_users where user_id = auth.uid())
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

create table public.order_reviews (
  id bigint generated always as identity primary key,
  order_id bigint not null unique references public.orders (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  shop_id bigint not null references public.shops (id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  matched_description boolean not null,
  comment text check (comment is null or char_length(comment) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.order_disputes (
  id bigint generated always as identity primary key,
  order_id bigint not null unique references public.orders (id) on delete restrict,
  shop_id bigint not null references public.shops (id) on delete restrict,
  buyer_id uuid not null references auth.users (id) on delete restrict,
  reason text not null check (reason in ('item_not_received', 'item_not_as_described', 'damaged_item', 'other')),
  status text not null default 'open' check (status in ('open', 'seller_responded', 'resolved')),
  buyer_statement text not null check (char_length(buyer_statement) between 10 and 3000),
  buyer_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(buyer_evidence) = 'array'),
  seller_response text check (seller_response is null or char_length(seller_response) between 10 and 3000),
  seller_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(seller_evidence) = 'array'),
  admin_resolver_id uuid references auth.users (id) on delete restrict,
  resolution text check (resolution is null or resolution in ('buyer_favor', 'seller_favor', 'dismissed')),
  resolution_notes text check (resolution_notes is null or char_length(resolution_notes) between 10 and 3000),
  seller_fault boolean,
  opened_at timestamptz not null default now(),
  responded_at timestamptz,
  resolved_at timestamptz,
  check (
    (status <> 'resolved' and admin_resolver_id is null and resolution is null and resolution_notes is null and seller_fault is null and resolved_at is null)
    or (status = 'resolved' and admin_resolver_id is not null and resolution is not null and resolution_notes is not null and seller_fault is not null and resolved_at is not null)
  )
);

alter table private.admin_audit_events
  add constraint admin_audit_events_related_dispute_id_fkey
  foreign key (related_dispute_id) references public.order_disputes (id) on delete set null;

create index order_reviews_shop_created_idx on public.order_reviews (shop_id, created_at desc);
create index order_reviews_buyer_id_idx on public.order_reviews (buyer_id);
create index order_disputes_shop_status_idx on public.order_disputes (shop_id, status, opened_at desc);
create index order_disputes_buyer_id_idx on public.order_disputes (buyer_id);
create index order_disputes_admin_open_idx on public.order_disputes (opened_at) where status <> 'resolved';

grant select on table public.order_reviews, public.order_disputes to authenticated;
grant usage, select on sequence public.order_reviews_id_seq, public.order_disputes_id_seq to authenticated;
alter table public.order_reviews enable row level security;
alter table public.order_disputes enable row level security;

create policy review_participants_select on public.order_reviews for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (select 1 from public.shops where shops.id = order_reviews.shop_id and shops.owner_id = (select auth.uid()))
  or (select public.is_current_user_admin())
);

create policy dispute_participants_and_admin_select on public.order_disputes for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (select 1 from public.shops where shops.id = order_disputes.shop_id and shops.owner_id = (select auth.uid()))
  or (select public.is_current_user_admin())
);

drop policy order_participants_select on public.orders;
create policy order_participants_select on public.orders for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (select 1 from public.shops where shops.id = orders.shop_id and shops.owner_id = (select auth.uid()))
  or (select public.is_current_user_admin())
);

drop policy order_items_participants_select on public.order_items;
create policy order_items_participants_select on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
    and (
      orders.buyer_id = (select auth.uid())
      or exists (select 1 from public.shops where shops.id = orders.shop_id and shops.owner_id = (select auth.uid()))
      or (select public.is_current_user_admin())
    )
));

drop policy order_addresses_participants_select on public.order_addresses;
create policy order_addresses_participants_select on public.order_addresses for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_addresses.order_id
    and (
      orders.buyer_id = (select auth.uid())
      or exists (select 1 from public.shops where shops.id = orders.shop_id and shops.owner_id = (select auth.uid()))
      or (select public.is_current_user_admin())
    )
));

drop policy order_events_participants_select on public.order_events;
create policy order_events_participants_select on public.order_events for select to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_events.order_id
    and (
      orders.buyer_id = (select auth.uid())
      or exists (select 1 from public.shops where shops.id = orders.shop_id and shops.owner_id = (select auth.uid()))
      or (select public.is_current_user_admin())
    )
));

drop policy conversation_participants_select on public.conversations;
create policy conversation_participants_select on public.conversations for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (select 1 from public.shops where shops.id = conversations.shop_id and shops.owner_id = (select auth.uid()))
  or (select public.is_current_user_admin())
);

drop policy message_participants_select on public.messages;
create policy message_participants_select on public.messages for select to authenticated
using (exists (
  select 1 from public.conversations c join public.shops s on s.id = c.shop_id
  where c.id = messages.conversation_id
    and (c.buyer_id = (select auth.uid()) or s.owner_id = (select auth.uid()) or (select public.is_current_user_admin()))
));

drop policy response_event_participants_select on public.seller_response_events;
create policy response_event_participants_select on public.seller_response_events for select to authenticated
using (exists (
  select 1 from public.conversations c join public.shops s on s.id = c.shop_id
  where c.id = seller_response_events.conversation_id
    and (c.buyer_id = (select auth.uid()) or s.owner_id = (select auth.uid()) or (select public.is_current_user_admin()))
));

create function public.create_order_review(p_order_id bigint, p_rating integer, p_matched_description boolean, p_comment text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_id bigint; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  select * into v_order from public.orders where id = p_order_id and buyer_id = v_user;
  if v_order.id is null or v_order.status <> 'completed' then raise exception using errcode = 'P0001', message = 'Solo puedes reseñar pedidos completados.'; end if;
  if p_rating not between 1 and 5 then raise exception using errcode = '22023', message = 'La calificación debe estar entre 1 y 5.'; end if;
  insert into public.order_reviews (order_id, buyer_id, shop_id, rating, matched_description, comment)
  values (p_order_id, v_user, v_order.shop_id, p_rating, p_matched_description, nullif(btrim(p_comment), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.open_order_dispute(p_order_id bigint, p_reason text, p_statement text, p_evidence jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_order public.orders%rowtype; v_id bigint; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  select * into v_order from public.orders where id = p_order_id and buyer_id = v_user;
  if v_order.id is null or v_order.status not in ('shipped', 'delivered', 'completed') then raise exception using errcode = 'P0001', message = 'Este pedido no admite una disputa.'; end if;
  insert into public.order_disputes (order_id, shop_id, buyer_id, reason, buyer_statement, buyer_evidence)
  values (p_order_id, v_order.shop_id, v_user, p_reason, btrim(p_statement), coalesce(p_evidence, '[]'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.respond_to_dispute(p_dispute_id bigint, p_response text, p_evidence jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_dispute public.order_disputes%rowtype; v_user uuid := auth.uid();
begin
  select d.* into v_dispute from public.order_disputes d join public.shops s on s.id = d.shop_id
  where d.id = p_dispute_id and s.owner_id = v_user for update of d;
  if v_dispute.id is null or v_dispute.status = 'resolved' then raise exception using errcode = '42501', message = 'No puedes responder esta disputa.'; end if;
  update public.order_disputes set status = 'seller_responded', seller_response = btrim(p_response), seller_evidence = coalesce(p_evidence, '[]'::jsonb), responded_at = now() where id = p_dispute_id;
  perform private.record_seller_activity(v_dispute.shop_id, v_user, 'evidence_submitted', 'dispute', p_dispute_id);
end;
$$;

create function public.resolve_order_dispute(p_dispute_id bigint, p_resolution text, p_seller_fault boolean, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_shop_id bigint;
begin
  if not exists (select 1 from private.admin_users where user_id = v_user) then
    raise exception using errcode = '42501', message = 'Solo administración puede resolver disputas.';
  end if;
  select shop_id into v_shop_id from public.order_disputes where id = p_dispute_id and status <> 'resolved' for update;
  if v_shop_id is null then raise exception using errcode = 'P0002', message = 'Disputa no encontrada o ya resuelta.'; end if;
  update public.order_disputes set status = 'resolved', admin_resolver_id = v_user, resolution = p_resolution,
    seller_fault = p_seller_fault, resolution_notes = btrim(p_notes), resolved_at = now()
  where id = p_dispute_id;
  insert into private.admin_audit_events (actor_id, action, related_dispute_id, metadata)
  values (v_user, 'dispute_resolved', p_dispute_id, jsonb_build_object('resolution', p_resolution, 'seller_fault', p_seller_fault));
end;
$$;

revoke all on function public.create_order_review(bigint, integer, boolean, text) from public, anon;
revoke all on function public.open_order_dispute(bigint, text, text, jsonb) from public, anon;
revoke all on function public.respond_to_dispute(bigint, text, jsonb) from public, anon;
revoke all on function public.resolve_order_dispute(bigint, text, boolean, text) from public, anon;
grant execute on function public.create_order_review(bigint, integer, boolean, text) to authenticated;
grant execute on function public.open_order_dispute(bigint, text, text, jsonb) to authenticated;
grant execute on function public.respond_to_dispute(bigint, text, jsonb) to authenticated;
grant execute on function public.resolve_order_dispute(bigint, text, boolean, text) to authenticated;

create or replace function private.auto_complete_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_order record; v_count integer := 0;
begin
  for v_order in
    select o.id from public.orders o
    where o.status = 'delivered' and o.delivered_at <= now() - interval '7 days'
      and not exists (select 1 from public.order_disputes d where d.order_id = o.id and d.status <> 'resolved')
    for update of o skip locked
  loop
    update public.orders set status = 'completed', auto_completed_at = now(), completed_at = now(), updated_at = now() where id = v_order.id and status = 'delivered';
    if found then
      insert into public.order_events (order_id, actor_type, event_type, previous_status, next_status) values (v_order.id, 'system', 'auto_completed', 'delivered', 'completed');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create function private.redact_expired_order_addresses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  with eligible as (
    select a.order_id
    from public.order_addresses a join public.orders o on o.id = a.order_id
    where a.redacted_at is null
      and coalesce(o.completed_at, o.canceled_at) is not null
      and (
        (
          not exists (select 1 from public.order_disputes d where d.order_id = o.id)
          and coalesce(o.completed_at, o.canceled_at) <= now() - interval '90 days'
        )
        or (
          exists (select 1 from public.order_disputes d where d.order_id = o.id)
          and not exists (select 1 from public.order_disputes d where d.order_id = o.id and d.status <> 'resolved')
          and (select max(d.resolved_at) from public.order_disputes d where d.order_id = o.id) <= now() - interval '90 days'
        )
      )
    for update of a skip locked
  )
  update public.order_addresses a
  set recipient = null, address_line1 = null, address_line2 = null, locality = null,
      administrative_area = null, postal_code = null, country_code = null,
      delivery_instructions = null, redacted_at = now()
  from eligible e where a.order_id = e.order_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.redact_expired_order_addresses() from public, anon, authenticated;

select cron.schedule(
  'plaza-redact-order-addresses',
  '15 1 * * *',
  'select private.redact_expired_order_addresses()'
);
