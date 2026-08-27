-- A pre-sale conversation used to be identified by buyer and shop alone, so every
-- question about every product in a shop landed in one thread and the inbox lost
-- track of what was being asked about. A conversation now names the product it is
-- about, or names none and is the shop's general enquiry.
--
-- Nothing is copied onto the conversation. The thread points at the product and
-- reads it live, so a corrected title or a new price shows up on its own. A frozen
-- price belongs to an order, where it is the transaction, not to a conversation.

-- A listing a conversation points at has to outlive the seller taking it down, so
-- removal becomes a status the catalogue already knows how to hide.
alter table public.products drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
    check (status in ('draft', 'published', 'expired', 'deleted'));

-- The pairing of product and shop is enforced by the key rather than by whoever
-- writes the row, so a thread can never point at another shop's product.
alter table public.products
  add constraint products_id_shop_id_key unique (id, shop_id);

alter table public.conversations
  add column product_id bigint;

alter table public.conversations
  add constraint conversations_product_shop_fkey
    foreign key (product_id, shop_id) references public.products (id, shop_id)
    on delete restrict;

-- An order thread stays an order thread: it is evidence in disputes and its
-- identity must not drift into an enquiry about a listing.
alter table public.conversations
  add constraint conversations_product_pre_sale_only
    check (product_id is null or type = 'pre_sale');

-- One general thread per buyer and shop, one product thread per buyer, shop and
-- product. Existing pre-sale rows arrive with a null product and become general
-- enquiries under the first index, which is the shape they already had.
drop index public.conversations_pre_sale_buyer_shop_idx;

create unique index conversations_pre_sale_general_idx
on public.conversations (buyer_id, shop_id)
where type = 'pre_sale' and product_id is null;

create unique index conversations_pre_sale_product_idx
on public.conversations (buyer_id, shop_id, product_id)
where type = 'pre_sale' and product_id is not null;

-- Deleting a product has to check this table, and the inbox joins on it.
create index conversations_product_idx on public.conversations (product_id, shop_id);

-- The one-argument form is dropped rather than left beside the new one: two
-- overloads where the second argument has a default make every one-argument call
-- ambiguous, and callers that pass only a shop must keep working.
drop function public.start_pre_sale_conversation(bigint);

create function public.start_pre_sale_conversation(
  p_shop_id bigint,
  p_product_id bigint default null
)
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
  v_product_shop bigint;
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

  -- Re-opening a thread that already exists is free, and it comes first: a thread
  -- about a listing that has since been taken down is still reachable from the
  -- inbox even though it could no longer be started today.
  select id into v_id from public.conversations
  where buyer_id = v_user
    and shop_id = p_shop_id
    and type = 'pre_sale'
    and product_id is not distinct from p_product_id;

  if v_id is not null then
    update public.conversations set updated_at = now() where id = v_id;
    return v_id;
  end if;

  if p_product_id is not null then
    -- A thread may only be opened from a page the shopper could actually reach.
    -- A product belonging to another shop, a draft, and a product that was never
    -- there are all answered identically, so none of them discloses the others.
    select shop_id into v_product_shop
    from public.products
    where id = p_product_id and status = 'published';

    if v_product_shop is null or v_product_shop <> p_shop_id then
      raise exception using errcode = 'P0002', message = 'Producto no encontrado.';
    end if;
  end if;

  select coalesce(sum(conversations_opened), 0) into v_opened
  from private.message_rate_limits
  where user_id = v_user and window_hour > now() - interval '24 hours';

  if v_opened >= 10 then
    raise exception using errcode = 'P0001',
      message = 'Abriste demasiadas conversaciones hoy. Intenta de nuevo mañana.';
  end if;

  insert into public.conversations (shop_id, buyer_id, type, product_id)
  values (p_shop_id, v_user, 'pre_sale', p_product_id)
  returning id into v_id;

  insert into private.message_rate_limits (user_id, window_hour, conversations_opened)
  values (v_user, date_trunc('hour', now()), 1)
  on conflict (user_id, window_hour) do update
    set conversations_opened = private.message_rate_limits.conversations_opened + 1;

  return v_id;
end;
$$;

revoke all on function public.start_pre_sale_conversation(bigint, bigint) from public, anon;
grant execute on function public.start_pre_sale_conversation(bigint, bigint) to authenticated;

-- The inbox gains the product behind each thread. It is read here rather than by
-- the caller because row level security hides a listing that is no longer
-- published, which is exactly the thread that has to say "Ya no disponible".
-- Reading it in a definer function is safe: the where clause below already limits
-- the rows to conversations the caller participates in, and a product one of their
-- own threads points at is a product they were shown.
drop function public.list_conversations(text);

create function public.list_conversations(p_role text)
returns table (
  conversation_id bigint,
  type text,
  order_id bigint,
  shop_id bigint,
  shop_name text,
  shop_slug text,
  counterpart_label text,
  product_id bigint,
  product_name text,
  product_slug text,
  product_image_path text,
  product_price numeric,
  product_currency_code text,
  product_status text,
  product_units_available integer,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if p_role not in ('buyer', 'seller') then
    raise exception using errcode = '22023', message = 'Rol inválido.';
  end if;

  return query
  select
    c.id,
    c.type,
    c.order_id,
    c.shop_id,
    s.name,
    s.slug,
    case
      when p_role = 'buyer' then s.name
      else private.display_label(c.buyer_id, d.display_name)
    end,
    p.id,
    p.name,
    p.slug,
    -- The cover is kept in sync with the gallery by a trigger, so one column
    -- answers for both the products that have a gallery and those that predate it.
    p.image_path,
    p.price_mxn,
    p.currency_code,
    p.status,
    p.units_available::integer,
    lm.body,
    lm.created_at,
    lm.sender_id,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> v_user
        and (r.last_read_message_id is null or m.id > r.last_read_message_id)
    )::integer
  from public.conversations c
  join public.shops s on s.id = c.shop_id
  left join public.products p on p.id = c.product_id
  left join public.user_display_names d on d.user_id = c.buyer_id
  left join public.conversation_reads r
    on r.conversation_id = c.id and r.user_id = v_user
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.id desc
    limit 1
  ) lm on true
  where (p_role = 'buyer' and c.buyer_id = v_user)
     or (p_role = 'seller' and s.owner_id = v_user)
  order by c.updated_at desc;
end;
$$;

revoke all on function public.list_conversations(text) from public, anon;
grant execute on function public.list_conversations(text) to authenticated;

-- Rollback:
-- restore both function bodies from 20260823092000_add_list_conversations.sql
--   and 20260823094000_message_rate_limits.sql after dropping the versions above;
-- drop index public.conversations_product_idx;
-- drop index public.conversations_pre_sale_product_idx;
-- drop index public.conversations_pre_sale_general_idx;
-- create unique index conversations_pre_sale_buyer_shop_idx
--   on public.conversations (buyer_id, shop_id) where type = 'pre_sale';
-- alter table public.conversations drop constraint conversations_product_pre_sale_only;
-- alter table public.conversations drop constraint conversations_product_shop_fkey;
-- alter table public.conversations drop column product_id;
-- alter table public.products drop constraint products_id_shop_id_key;
-- update public.products set status = 'draft' where status = 'deleted';
-- alter table public.products drop constraint products_status_check,
--   add constraint products_status_check check (status in ('draft', 'published', 'expired'));
