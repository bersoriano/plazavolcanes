alter table public.shops
  add column country_code text not null default 'MX',
  add column administrative_area_code text;

alter table public.shops
  add constraint shops_country_code_format_check
    check (country_code ~ '^[A-Z]{2}$') not valid,
  add constraint shops_administrative_area_code_format_check
    check (
      administrative_area_code is null
      or administrative_area_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
    ) not valid,
  add constraint shops_administrative_area_country_check
    check (
      administrative_area_code is null
      or administrative_area_code like country_code || '-%'
    ) not valid;

alter table public.shops
  validate constraint shops_country_code_format_check,
  validate constraint shops_administrative_area_code_format_check,
  validate constraint shops_administrative_area_country_check;

-- Rollback (removes stored location data):
-- alter table public.shops
--   drop constraint shops_administrative_area_country_check,
--   drop constraint shops_administrative_area_code_format_check,
--   drop constraint shops_country_code_format_check,
--   drop column administrative_area_code,
--   drop column country_code;
