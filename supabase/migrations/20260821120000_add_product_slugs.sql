-- Products are shared by link, so their URLs carry the name instead of the id.
alter table public.products
  add column if not exists slug text;

-- Backfill with the same rule the application uses: unaccent, lowercase, collapse
-- everything else into hyphens, then disambiguate repeats in creation order.
with slug_candidates as (
  select
    id,
    coalesce(
      nullif(
        btrim(
          regexp_replace(
            lower(extensions.unaccent(name)),
            '[^a-z0-9]+',
            '-',
            'g'
          ),
          '-'
        ),
        ''
      ),
      'producto'
    ) as base
  from public.products
),
numbered as (
  select
    id,
    base,
    row_number() over (partition by base order by id) as position
  from slug_candidates
)
update public.products
  set slug = case
    when numbered.position = 1 then numbered.base
    else numbered.base || '-' || numbered.position
  end
  from numbered
  where numbered.id = products.id
    and products.slug is null;

alter table public.products
  alter column slug set not null;

-- The column is required and unique, so any insert that arrives without a slug -- a
-- migration, a fixture, a manual fix -- gets one rather than failing. The application
-- still assigns slugs itself; this only guarantees the invariant.
create or replace function public.assign_product_slug()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  base text;
  candidate text;
  suffix integer := 2;
begin
  if new.slug is not null then
    return new;
  end if;

  base := coalesce(
    nullif(
      btrim(regexp_replace(lower(extensions.unaccent(new.name)), '[^a-z0-9]+', '-', 'g'), '-'),
      ''
    ),
    'producto'
  );
  candidate := base;

  while exists (select 1 from public.products where products.slug = candidate) loop
    candidate := base || '-' || suffix;
    suffix := suffix + 1;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

drop trigger if exists products_assign_slug on public.products;
create trigger products_assign_slug
  before insert on public.products
  for each row
  execute function public.assign_product_slug();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_slug_format_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_slug_format_check
        check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_slug_key'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_slug_key unique (slug);
  end if;
end $$;

-- Rollback:
-- drop trigger products_assign_slug on public.products;
-- drop function public.assign_product_slug();
-- alter table public.products
--   drop constraint products_slug_key,
--   drop constraint products_slug_format_check,
--   drop column slug;
