alter table public.shops
  add column is_publishing_approved boolean not null default false;

alter table public.products
  add column is_admin_enabled boolean not null default true;

update public.shops s
set is_publishing_approved = exists (
  select 1
  from private.admin_users a
  where a.user_id = s.owner_id
);

update public.products
set is_admin_enabled = true;

create function private.apply_shop_publishing_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_publishing_approved := exists (
    select 1
    from private.admin_users a
    where a.user_id = new.owner_id
  );
  return new;
end;
$$;

revoke all on function private.apply_shop_publishing_approval() from public, anon, authenticated;

create trigger apply_shop_publishing_approval
before insert on public.shops
for each row
execute function private.apply_shop_publishing_approval();

create or replace function private.guard_shop_trust_cache()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') and (
    new.trust_tier is distinct from old.trust_tier
    or new.listing_limit is distinct from old.listing_limit
    or new.trust_evaluated_at is distinct from old.trust_evaluated_at
    or new.is_publishing_approved is distinct from old.is_publishing_approved
  ) then
    raise exception using
      errcode = '42501',
      message = 'Los campos de confianza y publicación son administrados por el sistema.';
  end if;
  return new;
end;
$$;

create function private.apply_product_moderation_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.status := 'draft';
    new.is_admin_enabled := true;
  end if;
  return new;
end;
$$;

revoke all on function private.apply_product_moderation_defaults() from public, anon, authenticated;

create trigger apply_product_moderation_defaults
before insert on public.products
for each row
execute function private.apply_product_moderation_defaults();

create function private.guard_product_administration_enablement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role')
    and new.is_admin_enabled is distinct from old.is_admin_enabled then
    raise exception using
      errcode = '42501',
      message = 'La habilitación administrativa del producto es administrada por el sistema.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_product_administration_enablement() from public, anon, authenticated;

create trigger guard_product_administration_enablement
before update on public.products
for each row
execute function private.guard_product_administration_enablement();

create function public.set_shop_publishing_approval(p_shop_id bigint, p_enabled boolean)
returns table (shop_id bigint, shop_slug text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede cambiar la aprobación de publicación.';
  end if;

  return query
  update public.shops s
  set is_publishing_approved = p_enabled,
      updated_at = now()
  where s.id = p_shop_id
  returning s.id, s.slug;

  if not found then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;
end;
$$;

revoke all on function public.set_shop_publishing_approval(bigint, boolean) from public, anon;
grant execute on function public.set_shop_publishing_approval(bigint, boolean) to authenticated;

create function public.set_product_admin_enabled(p_product_id bigint, p_enabled boolean)
returns table (product_id bigint, product_slug text, shop_id bigint, shop_slug text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede cambiar la habilitación del producto.';
  end if;

  return query
  update public.products p
  set is_admin_enabled = p_enabled,
      updated_at = now()
  from public.shops s
  where p.id = p_product_id
    and s.id = p.shop_id
  returning p.id, p.slug, s.id, s.slug;

  if not found then
    raise exception using errcode = 'P0002', message = 'Producto no encontrado.';
  end if;
end;
$$;

revoke all on function public.set_product_admin_enabled(bigint, boolean) from public, anon;
grant execute on function public.set_product_admin_enabled(bigint, boolean) to authenticated;

-- A public listing is an effective state, not just the seller's requested status.
-- Reconcile windows before installing the public predicate so migration never
-- exposes a published row without a live expiry.
create or replace function private.set_product_expiry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'draft' then
    new.expires_at := null;
  elsif new.status = 'published' and new.is_admin_enabled and exists (
    select 1
    from public.shops s
    where s.id = new.shop_id
      and s.is_publishing_approved
  ) then
    if tg_op = 'INSERT'
      or old.status is distinct from 'published'
      or old.is_admin_enabled is distinct from true
      or new.expires_at is null then
      new.expires_at := now() + interval '30 days';
    end if;
  elsif new.status = 'published' then
    new.expires_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.set_product_expiry() from public, anon, authenticated;

-- This update intentionally invokes the trigger for every existing publication:
-- approved admin-owned rows retain a valid window, while every suspended row
-- loses its expiry before the public policies below are activated.
update public.products
set expires_at = expires_at
where status = 'published';

create or replace function private.expire_due_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  update public.products p
  set status = 'expired', updated_at = now()
  from public.shops s
  where p.shop_id = s.id
    and p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at <= now();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function private.expire_due_products() from public, anon, authenticated;

select private.expire_due_products();

create or replace function public.set_shop_publishing_approval(p_shop_id bigint, p_enabled boolean)
returns table (shop_id bigint, shop_slug text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede cambiar la aprobación de publicación.';
  end if;

  return query
  update public.shops s
  set is_publishing_approved = p_enabled,
      updated_at = now()
  where s.id = p_shop_id
  returning s.id, s.slug;

  if not found then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;

  update public.products p
  set expires_at = case
    when p_enabled and p.status = 'published' and p.is_admin_enabled then now() + interval '30 days'
    when p.status = 'published' then null
    else p.expires_at
  end,
  updated_at = now()
  where p.shop_id = p_shop_id
    and p.status = 'published';
end;
$$;

revoke all on function public.set_shop_publishing_approval(bigint, boolean) from public, anon;
grant execute on function public.set_shop_publishing_approval(bigint, boolean) to authenticated;

drop policy if exists "published_products_and_owner_drafts_are_visible" on public.products;
create policy "effective_products_and_owner_rows_are_visible"
  on public.products for select
  to anon, authenticated
  using (
    (
      status = 'published'
      and is_admin_enabled
      and expires_at is not null
      and expires_at > now()
      and exists (
        select 1 from public.shops s
        where s.id = products.shop_id
          and s.is_publishing_approved
      )
    )
    or exists (
      select 1 from public.shops s
      where s.id = products.shop_id
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "product_images_follow_product_visibility" on public.product_images;
create policy "product_images_follow_effective_product_visibility"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_images.product_id
        and (
          (
            p.status = 'published'
            and p.is_admin_enabled
            and p.expires_at is not null
            and p.expires_at > now()
            and s.is_publishing_approved
          )
          or s.owner_id = (select auth.uid())
        )
    )
  );

drop policy if exists "published_product_translations_are_public" on public.product_translations;
create policy "effective_product_translations_are_public"
  on public.product_translations for select
  to anon, authenticated
  using (
    review_status = 'approved'
    and exists (
      select 1
      from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id = product_translations.product_id
        and p.status = 'published'
        and p.is_admin_enabled
        and p.expires_at is not null
        and p.expires_at > now()
        and s.is_publishing_approved
    )
  );

create index if not exists products_publication_gate_by_shop_idx
  on public.products (shop_id, created_at desc)
  where status = 'published' and is_admin_enabled;

create index if not exists products_active_publication_expiry_idx
  on public.products (expires_at)
  where status = 'published' and is_admin_enabled and expires_at is not null;

create or replace function public.add_cart_item(p_product_id bigint, p_quantity integer default 1)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_shop_id bigint;
  v_owner_id uuid;
  v_cart_id bigint;
  v_units smallint;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_quantity not between 1 and 99 then raise exception using errcode = '22023', message = 'La cantidad debe estar entre 1 y 99.'; end if;

  select p.shop_id, s.owner_id, p.units_available into v_shop_id, v_owner_id, v_units
  from public.products p
  join public.shops s on s.id = p.shop_id
  where p.id = p_product_id
    and p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now();
  if v_shop_id is null then raise exception using errcode = 'P0002', message = 'Producto no disponible.'; end if;
  if v_owner_id = v_user then raise exception using errcode = 'P0001', message = 'No puedes comprar en tu propia tienda.'; end if;
  if p_quantity > v_units then
    raise exception using errcode = '22023', message = format('Solo hay %s unidades disponibles.', v_units);
  end if;

  insert into public.carts (buyer_id, shop_id) values (v_user, v_shop_id)
  on conflict (buyer_id, shop_id) do update set updated_at = now()
  returning id into v_cart_id;

  insert into public.cart_items (cart_id, product_id, quantity)
  values (v_cart_id, p_product_id, p_quantity)
  on conflict (cart_id, product_id) do update
  set quantity = least(v_units, public.cart_items.quantity + excluded.quantity), updated_at = now();
  return v_cart_id;
end;
$$;

create or replace function private.checkout_cart_internal_v2(
  p_shop_id bigint,
  p_fulfillment_method text,
  p_address jsonb,
  p_alt_contact jsonb,
  p_buyer_note text,
  p_idempotency_key uuid,
  p_payment_confirmation_required boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_cart_id bigint;
  v_order_id bigint;
  v_owner_id uuid;
  v_time_zone text;
  v_subtotal numeric(14,2);
  v_handling_days integer;
  v_item_count bigint;
  v_contact_name text := nullif(btrim(p_alt_contact->>'name'), '');
  v_contact_phone text := nullif(btrim(p_alt_contact->>'phone'), '');
  v_contact_note text := nullif(btrim(p_alt_contact->>'note'), '');
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Falta la clave de confirmación.'; end if;
  if p_fulfillment_method is null or p_fulfillment_method not in ('pickup', 'shipping') then
    raise exception using errcode = '22023', message = 'Elige recolección o envío.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user::text),
    pg_catalog.hashtext(p_idempotency_key::text)
  );

  select id into v_order_id from public.orders
  where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if v_order_id is not null then return v_order_id; end if;

  select owner_id, time_zone into v_owner_id, v_time_zone from public.shops where id = p_shop_id;
  if v_owner_id is null then raise exception using errcode = 'P0002', message = 'Tienda no encontrada.'; end if;
  if v_owner_id = v_user then raise exception using errcode = 'P0001', message = 'No puedes comprar en tu propia tienda.'; end if;

  select id into v_cart_id from public.carts
  where buyer_id = v_user and shop_id = p_shop_id for update;
  if v_cart_id is null then raise exception using errcode = 'P0002', message = 'Tu carrito está vacío.'; end if;

  select count(*), sum(p.price_mxn * ci.quantity), max(p.handling_days)
  into v_item_count, v_subtotal, v_handling_days
  from public.cart_items ci
  join public.products p on p.id = ci.product_id
  join public.shops s on s.id = p.shop_id
  where ci.cart_id = v_cart_id
    and p.shop_id = p_shop_id
    and p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now();
  if v_item_count = 0 or v_item_count <> (select count(*) from public.cart_items where cart_id = v_cart_id) then
    raise exception using errcode = 'P0001', message = 'Uno o más productos ya no están disponibles.';
  end if;

  if p_fulfillment_method = 'shipping' then
    if nullif(btrim(p_address->>'recipient'), '') is null
      or nullif(btrim(p_address->>'address_line1'), '') is null
      or nullif(btrim(p_address->>'locality'), '') is null
      or nullif(btrim(p_address->>'administrative_area'), '') is null
      or nullif(btrim(p_address->>'postal_code'), '') is null
      or coalesce(p_address->>'country_code', '') !~ '^[A-Z]{2}$' then
      raise exception using errcode = '22023', message = 'Completa la dirección de entrega.';
    end if;
  elsif p_address is not null then
    raise exception using errcode = 'P0001', message = 'Una recolección no lleva dirección de entrega.';
  end if;

  if v_contact_name is null and (v_contact_phone is not null or v_contact_note is not null) then
    raise exception using errcode = '22023', message = 'Escribe el nombre de la otra persona.';
  end if;
  if v_contact_name is not null and length(v_contact_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'El nombre de la otra persona debe tener entre 2 y 80 caracteres.';
  end if;
  if v_contact_phone is not null and v_contact_phone !~ '^\+52[0-9]{10}$' then
    raise exception using errcode = '22023', message = 'El teléfono debe tener 10 dígitos.';
  end if;
  if v_contact_note is not null and length(v_contact_note) > 200 then
    raise exception using errcode = '22023', message = 'La nota no puede pasar de 200 caracteres.';
  end if;

  insert into public.orders (
    buyer_id, shop_id, idempotency_key, currency_code, subtotal, buyer_note,
    handling_days, handling_time_zone, payment_confirmation_required,
    fulfillment_method, alt_contact_name, alt_contact_phone, alt_contact_note
  ) values (
    v_user, p_shop_id, p_idempotency_key, 'MXN', v_subtotal,
    nullif(btrim(p_buyer_note), ''), v_handling_days, v_time_zone,
    p_payment_confirmation_required,
    p_fulfillment_method, v_contact_name, v_contact_phone, v_contact_note
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, currency_code,
    quantity, line_total, handling_days
  )
  select v_order_id, p.id, p.name, p.price_mxn, p.currency_code,
    ci.quantity, p.price_mxn * ci.quantity, p.handling_days
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id;

  if p_fulfillment_method = 'shipping' then
    insert into public.order_addresses (
      order_id, recipient, address_line1, address_line2, locality,
      administrative_area, postal_code, country_code, delivery_instructions
    ) values (
      v_order_id, btrim(p_address->>'recipient'), btrim(p_address->>'address_line1'),
      nullif(btrim(p_address->>'address_line2'), ''), btrim(p_address->>'locality'),
      btrim(p_address->>'administrative_area'), btrim(p_address->>'postal_code'),
      p_address->>'country_code', nullif(btrim(p_address->>'delivery_instructions'), '')
    );
  end if;

  insert into public.order_events (order_id, actor_id, actor_type, event_type, next_status, metadata, idempotency_key)
  values (
    v_order_id, v_user, 'buyer', 'requested', 'requested',
    jsonb_build_object(
      'payment_confirmation_required', p_payment_confirmation_required,
      'fulfillment_method', p_fulfillment_method
    ),
    p_idempotency_key
  );

  delete from public.carts where id = v_cart_id;
  return v_order_id;
end;
$$;

revoke all on function public.add_cart_item(bigint, integer) from public, anon;
grant execute on function public.add_cart_item(bigint, integer) to authenticated;
revoke execute on function private.checkout_cart_internal_v2(bigint,text,jsonb,jsonb,text,uuid,boolean)
from public, anon, authenticated;

alter function public.search_product_ids(text, text, text, text, bigint, integer)
  rename to search_product_ids_unfiltered;
revoke all on function public.search_product_ids_unfiltered(text, text, text, text, bigint, integer)
  from public, anon, authenticated;

-- Preserve the established candidate/ranking implementation, but deliberately
-- remove its public-result cap for the private stream. Effective visibility is
-- applied by the wrapper below, before that wrapper orders and limits results.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.search_product_ids_unfiltered(text,text,text,text,bigint,integer)'::regprocedure
  ) into v_definition;

  if position('limit greatest(1, least(coalesce(p_limit, 20), 100));' in v_definition) = 0 then
    raise exception 'Expected search candidate limit was not found.';
  end if;

  v_definition := replace(
    v_definition,
    'FUNCTION public.search_product_ids_unfiltered(',
    'FUNCTION private.search_product_ids_candidates('
  );
  v_definition := replace(
    v_definition,
    'limit greatest(1, least(coalesce(p_limit, 20), 100));',
    ''
  );
  execute v_definition;
end;
$$;

revoke all on function private.search_product_ids_candidates(text, text, text, text, bigint, integer)
  from public, anon, authenticated;

create function public.search_product_ids(
  p_query text,
  p_locale text,
  p_country_code text,
  p_administrative_area_code text,
  p_category_id bigint,
  p_limit integer
)
returns table(product_id bigint, rank real)
language sql
stable
security definer
set search_path = ''
as $$
  select search_results.product_id, search_results.rank
  from private.search_product_ids_candidates(
    p_query, p_locale, p_country_code, p_administrative_area_code, p_category_id, p_limit
  ) search_results
  join public.products p on p.id = search_results.product_id
  join public.shops s on s.id = p.shop_id
  where p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now()
  order by search_results.rank desc, p.created_at desc, p.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.search_product_ids(text, text, text, text, bigint, integer)
  from public, anon;
grant execute on function public.search_product_ids(text, text, text, text, bigint, integer)
  to anon, authenticated;

create or replace function public.catalog_state_counts(p_country_code text)
returns table(administrative_area_code text, product_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    area_code as administrative_area_code,
    count(*) as product_count
  from public.products p
  join public.shops s on s.id = p.shop_id
  cross join lateral unnest(coalesce(s.administrative_area_codes, '{}')) as area_code
  where p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now()
    and (p_country_code is null or s.country_code = upper(p_country_code))
  group by area_code
  order by count(*) desc, area_code;
$$;

revoke all on function public.catalog_state_counts(text) from public, anon;
grant execute on function public.catalog_state_counts(text) to anon, authenticated;

create or replace function public.set_cart_item_quantity(p_cart_item_id bigint, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_units smallint;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_quantity not between 1 and 99 then raise exception using errcode = '22023', message = 'La cantidad debe estar entre 1 y 99.'; end if;

  select p.units_available into v_units
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id
  join public.products p on p.id = ci.product_id
  join public.shops s on s.id = p.shop_id
  where ci.id = p_cart_item_id
    and c.buyer_id = auth.uid()
    and p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.expires_at is not null
    and p.expires_at > now();
  if v_units is null then raise exception using errcode = 'P0002', message = 'Producto no encontrado en tu carrito.'; end if;
  if p_quantity > v_units then
    raise exception using errcode = '22023',
      message = format('Solo hay %s unidades disponibles.', v_units);
  end if;

  update public.cart_items ci set quantity = p_quantity, updated_at = now()
  from public.carts c
  where ci.id = p_cart_item_id and c.id = ci.cart_id and c.buyer_id = auth.uid();
  if not found then raise exception using errcode = 'P0002', message = 'Producto no encontrado en tu carrito.'; end if;
end;
$$;

revoke all on function public.set_cart_item_quantity(bigint, integer) from public, anon;
grant execute on function public.set_cart_item_quantity(bigint, integer) to authenticated;

create or replace function public.record_search_selection(
  p_event_id uuid,
  p_product_id bigint,
  p_position integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_result_count integer;
  event_selected_product_id bigint;
  event_selected_position integer;
  event_selected_at timestamptz;
begin
  if p_event_id is null then
    raise exception using errcode = '22023', message = 'Search event id is required.';
  end if;

  if p_product_id is null or not exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = p_product_id
      and p.status = 'published'
      and p.is_admin_enabled
      and s.is_publishing_approved
      and p.expires_at is not null
      and p.expires_at > now()
  ) then
    raise exception using errcode = '22023', message = 'Selected product must be published.';
  end if;

  if p_position is null or p_position < 1 then
    raise exception using errcode = '22023', message = 'Selected position must be one or greater.';
  end if;

  select result_count, selected_product_id, selected_position, selected_at
  into event_result_count, event_selected_product_id, event_selected_position, event_selected_at
  from public.search_events
  where id = p_event_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'Search event does not exist.';
  end if;
  if event_selected_product_id is not null
    or event_selected_position is not null
    or event_selected_at is not null then
    raise exception using errcode = '22023', message = 'Search selection has already been recorded.';
  end if;
  if p_position > event_result_count then
    raise exception using errcode = '22023', message = 'Selected position must not exceed result count.';
  end if;

  update public.search_events
  set selected_product_id = p_product_id,
      selected_position = p_position,
      selected_at = now()
  where id = p_event_id;
end;
$$;

revoke all on function public.record_search_selection(uuid, bigint, integer) from public, anon;
grant execute on function public.record_search_selection(uuid, bigint, integer) to anon, authenticated;

create or replace function public.start_pre_sale_conversation(
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

  -- Existing threads remain reachable after a listing is hidden; only creating
  -- a new product-scoped thread is subject to the effective public gate.
  select id into v_id from public.conversations
  where buyer_id = v_user
    and shop_id = p_shop_id
    and type = 'pre_sale'
    and product_id is not distinct from p_product_id;
  if v_id is not null then
    update public.conversations set updated_at = now() where id = v_id;
    return v_id;
  end if;

  if p_product_id is not null and not exists (
    select 1
    from public.products p
    join public.shops s on s.id = p.shop_id
    where p.id = p_product_id
      and p.shop_id = p_shop_id
      and p.status = 'published'
      and p.is_admin_enabled
      and s.is_publishing_approved
      and p.expires_at is not null
      and p.expires_at > now()
  ) then
    raise exception using errcode = 'P0002', message = 'Producto no encontrado.';
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
