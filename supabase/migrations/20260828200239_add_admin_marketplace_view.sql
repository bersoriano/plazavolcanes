-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE FUNCTION private.bootstrap_initial_admin()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id
  from auth.users u
  where lower(btrim(u.email)) = 'bsorianodev@gmail.com';

  if v_user_id is null then
    return false;
  end if;

  insert into private.admin_users (user_id, granted_by)
  values (v_user_id, v_user_id)
  on conflict (user_id) do nothing;

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION private.bootstrap_initial_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.bootstrap_initial_admin() FROM anon;
REVOKE ALL ON FUNCTION private.bootstrap_initial_admin() FROM authenticated;

DO $function$
begin
  if not private.bootstrap_initial_admin() then
    raise notice 'Bootstrap admin bsorianodev@gmail.com does not exist in auth.users.';
  end if;
end;
$function$;

CREATE FUNCTION public.list_admin_marketplace_users()
  RETURNS TABLE (
    user_id            uuid,
    email              text,
    user_created_at    timestamp with time zone,
    display_name       text,
    shop_id            bigint,
    shop_name          text,
    shop_slug          text,
    shop_created_at    timestamp with time zone,
    product_id         bigint,
    product_name       text,
    product_slug       text,
    product_status     text,
    product_created_at timestamp with time zone,
    product_updated_at timestamp with time zone
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    s.id,
    s.name,
    s.slug,
    s.created_at,
    p.id,
    p.name,
    p.slug,
    p.status,
    p.created_at,
    p.updated_at
  from auth.users u
  left join public.user_display_names d on d.user_id = u.id
  left join public.shops s on s.owner_id = u.id
  left join public.products p
    on p.shop_id = s.id and p.status in ('draft', 'published')
  order by u.created_at desc, u.id, s.created_at desc nulls last, s.id,
           p.created_at desc nulls last, p.id;
end;
$function$;

REVOKE ALL ON FUNCTION public.list_admin_marketplace_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_admin_marketplace_users() FROM anon;

GRANT EXECUTE ON FUNCTION public.list_admin_marketplace_users() TO authenticated;

-- Rollback:
-- revoke execute on function public.list_admin_marketplace_users() from authenticated;
-- drop function public.list_admin_marketplace_users();
-- drop function private.bootstrap_initial_admin();
