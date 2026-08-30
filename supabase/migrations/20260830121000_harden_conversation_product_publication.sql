-- Preserve historical product context while exposing one database-derived
-- effective-publication flag for the inbox link and availability state.
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
  product_is_public boolean,
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
    p.image_path,
    p.price_mxn,
    p.currency_code,
    p.status,
    p.status = 'published'
      and p.is_admin_enabled
      and s.is_publishing_approved
      and p.expires_at is not null
      and p.expires_at > now(),
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
