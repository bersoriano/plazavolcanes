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
