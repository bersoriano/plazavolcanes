-- A shop may operate in up to two administrative areas of its country.
create or replace function public.shop_area_codes_valid(
  p_codes text[],
  p_country_code text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    cardinality(p_codes) between 1 and 2
    and not exists (
      select 1
      from unnest(p_codes) as code
      where code is null
        or code !~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
        or code not like p_country_code || '-%'
    )
    and cardinality(p_codes) = (select count(distinct code) from unnest(p_codes) as code);
$$;

alter table public.shops
  add column if not exists administrative_area_codes text[];

update public.shops
  set administrative_area_codes = array[administrative_area_code]
  where administrative_area_code is not null
    and administrative_area_codes is null;

alter table public.shops
  drop constraint if exists shops_administrative_area_code_format_check,
  drop constraint if exists shops_administrative_area_country_check,
  drop column if exists administrative_area_code;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shops_administrative_area_codes_check'
      and conrelid = 'public.shops'::regclass
  ) then
    alter table public.shops
      add constraint shops_administrative_area_codes_check
        check (
          administrative_area_codes is null
          or public.shop_area_codes_valid(administrative_area_codes, country_code)
        );
  end if;
end $$;

-- Rollback (keeps only the first stored area):
-- alter table public.shops add column administrative_area_code text;
-- update public.shops set administrative_area_code = administrative_area_codes[1];
-- alter table public.shops
--   drop constraint shops_administrative_area_codes_check,
--   drop column administrative_area_codes;
-- drop function public.shop_area_codes_valid(text[], text);
