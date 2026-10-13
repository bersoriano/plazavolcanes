-- Administrators can disable, re-enable, and delete marketplace accounts.
--
-- Both mutations stay inside the database, like every other administrator
-- power: the application holds no service-role key, so a security definer
-- function that re-checks membership is the only thing that touches auth.users.

alter table private.admin_audit_events
  drop constraint admin_audit_events_action_check;

alter table private.admin_audit_events
  add constraint admin_audit_events_action_check
  check (action in ('admin_granted', 'admin_revoked', 'dispute_resolved',
                    'legal_version_published', 'shop_limit_changed',
                    'user_disabled', 'user_enabled', 'user_deleted'));

-- Disabling uses Supabase Auth's own ban field, so the auth server refuses
-- sign-in and token refresh without any application check. The timestamp is
-- finite because the auth server reads the column into a native time value,
-- which has no representation for 'infinity'.
create function public.set_user_disabled(p_user_id uuid, p_disabled boolean)
returns table (user_id uuid, is_disabled boolean, shop_slugs text[], product_slugs text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_was_disabled boolean;
  v_shop_id bigint;
  v_shop_slug text;
  v_shop_product_slugs text[];
  v_shop_ids bigint[] := '{}';
  v_shop_slugs text[] := '{}';
  v_product_slugs text[] := '{}';
begin
  if v_actor_id is null or not exists (
    select 1 from private.admin_users a where a.user_id = v_actor_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede deshabilitar cuentas.';
  end if;

  if p_disabled is null then
    raise exception using
      errcode = '22023',
      message = 'Indica si la cuenta queda deshabilitada.';
  end if;

  if p_user_id = v_actor_id then
    raise exception using
      errcode = '22023',
      message = 'No puedes deshabilitar tu propia cuenta.';
  end if;

  if exists (select 1 from private.admin_users a where a.user_id = p_user_id) then
    raise exception using
      errcode = '22023',
      message = 'No puedes deshabilitar la cuenta de otra persona administradora.';
  end if;

  select coalesce(u.banned_until > now(), false)
  into v_was_disabled
  from auth.users u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No encontramos ese usuario.';
  end if;

  update auth.users u
  set banned_until = case when p_disabled then now() + interval '100 years' end,
      updated_at = now()
  where u.id = p_user_id;

  if p_disabled then
    -- Refresh tokens hang off sessions, so the account cannot renew the access
    -- token it already holds.
    delete from auth.sessions s
    where s.user_id = p_user_id;

    -- Approval is withdrawn through the one function that knows how to hide a
    -- shop's listings. Enabling the account does not restore it: republishing
    -- is a decision an administrator takes per shop.
    for v_shop_id in
      select s.id
      from public.shops s
      where s.owner_id = p_user_id
        and s.is_publishing_approved
      order by s.id
    loop
      select r.shop_slug, r.product_slugs
      into v_shop_slug, v_shop_product_slugs
      from public.set_shop_publishing_approval(v_shop_id, false) r;

      v_shop_ids := v_shop_ids || v_shop_id;
      v_shop_slugs := v_shop_slugs || v_shop_slug;
      v_product_slugs := v_product_slugs || v_shop_product_slugs;
    end loop;
  end if;

  if v_was_disabled is distinct from p_disabled then
    insert into private.admin_audit_events (
      actor_id,
      target_user_id,
      action,
      metadata
    ) values (
      v_actor_id,
      p_user_id,
      case when p_disabled then 'user_disabled' else 'user_enabled' end,
      case
        when p_disabled then jsonb_build_object('shop_ids', to_jsonb(v_shop_ids))
        else '{}'::jsonb
      end
    );
  end if;

  return query select p_user_id, p_disabled, v_shop_slugs, v_product_slugs;
end;
$$;

revoke all on function public.set_user_disabled(uuid, boolean) from public, anon;
grant execute on function public.set_user_disabled(uuid, boolean) to authenticated;

-- Deletion is only for accounts nobody else depends on. Orders, conversations,
-- messages, reviews, and disputes reference their people and shops with
-- `on delete restrict`, because they are the other party's record too; an
-- account with any of them is disabled instead.
create function public.admin_delete_user(p_user_id uuid)
returns table (user_id uuid, shop_slugs text[], product_slugs text[], image_keys text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_email text;
  v_shop_count integer;
  v_shop_slugs text[];
  v_product_slugs text[];
  v_image_keys text[];
begin
  if v_actor_id is null or not exists (
    select 1 from private.admin_users a where a.user_id = v_actor_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede eliminar cuentas.';
  end if;

  if p_user_id = v_actor_id then
    raise exception using
      errcode = '22023',
      message = 'No puedes eliminar tu propia cuenta.';
  end if;

  if exists (select 1 from private.admin_users a where a.user_id = p_user_id) then
    raise exception using
      errcode = '22023',
      message = 'No puedes eliminar la cuenta de otra persona administradora.';
  end if;

  select u.email::text
  into v_email
  from auth.users u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'No encontramos ese usuario.';
  end if;

  -- Collected before the delete, because the cascade takes these rows with it.
  select coalesce(array_agg(s.slug order by s.id), '{}'::text[]), count(*)::integer
  into v_shop_slugs, v_shop_count
  from public.shops s
  where s.owner_id = p_user_id;

  select coalesce(array_agg(p.slug order by p.id), '{}'::text[])
  into v_product_slugs
  from public.products p
  join public.shops s on s.id = p.shop_id
  where s.owner_id = p_user_id
    and p.status = 'published';

  -- The catalog bucket is not covered by the cascade, so the caller receives
  -- every object key the account's shops and listings pointed at.
  select coalesce(array_agg(k.object_key order by k.object_key), '{}'::text[])
  into v_image_keys
  from (
    select s.image_path as object_key
    from public.shops s
    where s.owner_id = p_user_id
    union
    select p.image_path
    from public.products p
    join public.shops s on s.id = p.shop_id
    where s.owner_id = p_user_id
    union
    select i.storage_path
    from public.product_images i
    join public.products p on p.id = i.product_id
    join public.shops s on s.id = p.shop_id
    where s.owner_id = p_user_id
  ) k
  where k.object_key is not null;

  begin
    delete from auth.users u
    where u.id = p_user_id;
  exception
    when foreign_key_violation or restrict_violation then
      raise exception using
        errcode = '23503',
        message = 'Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla.';
  end;

  -- The account is gone, so the event cannot point at it; the snapshot keeps
  -- the audit trail able to say what was removed.
  insert into private.admin_audit_events (
    actor_id,
    target_user_id,
    action,
    metadata
  ) values (
    v_actor_id,
    null,
    'user_deleted',
    jsonb_build_object(
      'user_id', p_user_id,
      'email', v_email,
      'shop_count', v_shop_count
    )
  );

  return query select p_user_id, v_shop_slugs, v_product_slugs, v_image_keys;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Removing a deleted account's catalog images goes through the Storage API as
-- the administrator, which needs to see the objects as well as delete them.
create policy "admins_read_catalog_images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'catalogo'
    and (select public.is_current_user_admin())
  );

create policy "admins_delete_catalog_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalogo'
    and (select public.is_current_user_admin())
  );

drop function public.list_admin_marketplace_users();

create function public.list_admin_marketplace_users()
returns table (
  user_id uuid,
  email text,
  user_created_at timestamp with time zone,
  display_name text,
  shop_limit integer,
  user_is_disabled boolean,
  user_is_admin boolean,
  shop_id bigint,
  shop_name text,
  shop_slug text,
  shop_created_at timestamp with time zone,
  shop_is_publishing_approved boolean,
  shop_is_premium boolean,
  product_id bigint,
  product_name text,
  product_slug text,
  product_status text,
  product_is_admin_enabled boolean,
  product_expires_at timestamp with time zone,
  product_created_at timestamp with time zone,
  product_updated_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501',
      message = 'Solo administración puede consultar usuarios.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    d.display_name,
    private.shop_limit_for(u.id),
    coalesce(u.banned_until > now(), false),
    exists (select 1 from private.admin_users a where a.user_id = u.id),
    s.id,
    s.name,
    s.slug,
    s.created_at,
    s.is_publishing_approved,
    s.is_premium,
    p.id,
    p.name,
    p.slug,
    p.status,
    p.is_admin_enabled,
    p.expires_at,
    p.created_at,
    p.updated_at
  from auth.users u
  left join public.user_display_names d on d.user_id = u.id
  left join public.shops s on s.owner_id = u.id
  left join public.products p
    on p.shop_id = s.id and p.status in ('draft', 'published', 'expired')
  order by u.created_at desc, u.id, s.created_at desc nulls last, s.id,
           p.created_at desc nulls last, p.id;
end;
$$;

revoke all on function public.list_admin_marketplace_users() from public, anon;
grant execute on function public.list_admin_marketplace_users() to authenticated;

-- Rollback:
-- restore public.list_admin_marketplace_users() from
--   20260912090000_add_shop_premium_status.sql
-- drop policy "admins_delete_catalog_images" on storage.objects;
-- drop policy "admins_read_catalog_images" on storage.objects;
-- drop function public.admin_delete_user(uuid);
-- drop function public.set_user_disabled(uuid, boolean);
-- restore admin_audit_events_action_check without the three user_* actions,
--   after removing any such events.
