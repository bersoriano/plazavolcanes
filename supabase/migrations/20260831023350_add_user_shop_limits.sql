create table private.user_shop_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shop_limit integer not null check (shop_limit >= 0),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamp with time zone not null default now()
);

revoke all on table private.user_shop_limits from public, anon, authenticated;
alter table private.user_shop_limits enable row level security;

create function private.shop_limit_for(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select l.shop_limit
     from private.user_shop_limits l
     where l.user_id = p_user_id),
    1
  )
$$;

revoke all on function private.shop_limit_for(uuid)
  from public, anon, authenticated;

create function public.current_user_shop_limit()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  return private.shop_limit_for(v_user_id);
end;
$$;

revoke all on function public.current_user_shop_limit() from public, anon;
grant execute on function public.current_user_shop_limit() to authenticated;

create function private.enforce_user_shop_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_shop_count integer;
begin
  -- Trusted database work can seed or repair rows. Seller writes always carry
  -- auth.uid() and remain subject to both this invariant and shops RLS.
  if auth.uid() is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner_id::text, 0)
  );

  v_limit := private.shop_limit_for(new.owner_id);

  select count(*)::integer into v_shop_count
  from public.shops s
  where s.owner_id = new.owner_id
    and (tg_op = 'INSERT' or s.id <> new.id);

  if v_shop_count >= v_limit then
    raise exception using
      errcode = 'P0001',
      message = 'Alcanzaste el límite de tiendas.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_user_shop_limit()
  from public, anon, authenticated;

create trigger enforce_user_shop_limit
before insert or update of owner_id on public.shops
for each row execute function private.enforce_user_shop_limit();

do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'private.admin_audit_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%legal_version_published%';

  if v_constraint_name is null then
    raise exception 'No se encontró la restricción de acción en private.admin_audit_events.';
  end if;

  execute format(
    'alter table private.admin_audit_events drop constraint %I',
    v_constraint_name
  );
end;
$$;

alter table private.admin_audit_events
  add constraint admin_audit_events_action_check
  check (action in ('admin_granted', 'admin_revoked', 'dispute_resolved',
                    'legal_version_published', 'shop_limit_changed'));

create function public.set_user_shop_limit(p_user_id uuid, p_shop_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_previous_limit integer;
begin
  if not exists (
    select 1 from private.admin_users a where a.user_id = v_actor_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede cambiar límites de tiendas.';
  end if;

  if p_shop_limit is null or p_shop_limit < 0 then
    raise exception using
      errcode = '22023',
      message = 'El límite de tiendas debe ser un número entero mayor o igual a cero.';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception using
      errcode = '22023',
      message = 'No encontramos ese usuario.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  v_previous_limit := private.shop_limit_for(p_user_id);

  if v_previous_limit is distinct from p_shop_limit then
    insert into private.user_shop_limits (
      user_id,
      shop_limit,
      updated_by,
      updated_at
    ) values (
      p_user_id,
      p_shop_limit,
      v_actor_id,
      now()
    )
    on conflict (user_id) do update
      set shop_limit = excluded.shop_limit,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;

    insert into private.admin_audit_events (
      actor_id,
      target_user_id,
      action,
      metadata
    ) values (
      v_actor_id,
      p_user_id,
      'shop_limit_changed',
      jsonb_build_object(
        'previous_limit', v_previous_limit,
        'new_limit', p_shop_limit
      )
    );
  end if;

  return p_shop_limit;
end;
$$;

revoke all on function public.set_user_shop_limit(uuid, integer)
  from public, anon;
grant execute on function public.set_user_shop_limit(uuid, integer)
  to authenticated;

drop function public.list_admin_marketplace_users();

create function public.list_admin_marketplace_users()
returns table (
  user_id uuid,
  email text,
  user_created_at timestamp with time zone,
  display_name text,
  shop_limit integer,
  shop_id bigint,
  shop_name text,
  shop_slug text,
  shop_created_at timestamp with time zone,
  shop_is_publishing_approved boolean,
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
    s.id,
    s.name,
    s.slug,
    s.created_at,
    s.is_publishing_approved,
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
