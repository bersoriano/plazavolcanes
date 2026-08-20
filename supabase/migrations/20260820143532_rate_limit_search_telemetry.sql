create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.telemetry_rate_limits (
  bucket_start timestamptz primary key,
  accepted_count integer not null default 0
    check (accepted_count between 0 and 300),
  rejected_count integer not null default 0
    check (rejected_count >= 0),
  updated_at timestamptz not null default statement_timestamp()
);

revoke all on table private.telemetry_rate_limits from public, anon, authenticated;

create or replace function public.record_catalog_search(
  p_query text,
  p_locale text,
  p_country_code text,
  p_category_id bigint,
  p_result_count integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_query_value text;
  event_id uuid;
  quota_bucket timestamptz := date_trunc('minute', statement_timestamp());
  quota_acquired boolean;
begin
  normalized_query_value := lower(extensions.unaccent(btrim(coalesce(p_query, ''))));

  if normalized_query_value = '' then
    raise exception using errcode = '22023', message = 'Search query must not be empty.';
  end if;

  if char_length(normalized_query_value) > 200 then
    raise exception using errcode = '22023', message = 'Search query must be 200 characters or fewer.';
  end if;

  if p_locale not in ('es-MX', 'en-US') then
    raise exception using errcode = '22023', message = 'Unsupported search locale.';
  end if;

  if p_country_code is null or p_country_code !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'Country code must use uppercase ISO format.';
  end if;

  if p_result_count is null or p_result_count < 0 then
    raise exception using errcode = '22023', message = 'Result count must be zero or greater.';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories
    where categories.id = p_category_id
      and categories.is_active
      and categories.listing_type = 'product'
  ) then
    raise exception using errcode = '22023', message = 'Category filter must reference an active product category.';
  end if;

  insert into private.telemetry_rate_limits (
    bucket_start,
    accepted_count,
    rejected_count,
    updated_at
  ) values (
    quota_bucket,
    1,
    0,
    statement_timestamp()
  )
  on conflict (bucket_start) do update
  set accepted_count = private.telemetry_rate_limits.accepted_count + 1,
      updated_at = excluded.updated_at
  where private.telemetry_rate_limits.accepted_count < 300
  returning true into quota_acquired;

  if not coalesce(quota_acquired, false) then
    update private.telemetry_rate_limits
    set rejected_count = rejected_count + 1,
        updated_at = statement_timestamp()
    where bucket_start = quota_bucket;

    return null;
  end if;

  insert into public.search_events (
    normalized_query,
    locale,
    country_code,
    category_id,
    result_count
  ) values (
    normalized_query_value,
    p_locale,
    p_country_code,
    p_category_id,
    p_result_count
  )
  returning id into event_id;

  return event_id;
end;
$$;

revoke execute on function public.record_catalog_search(text, text, text, bigint, integer)
from public, anon, authenticated;

grant execute on function public.record_catalog_search(text, text, text, bigint, integer)
to anon, authenticated;

-- Expand-only migration. Existing telemetry rows remain unchanged.
-- Destructive rollback, only after callers no longer depend on rate limiting:
-- drop table private.telemetry_rate_limits;
-- drop schema private;
-- restore record_catalog_search from 20260819173000_add_categories_and_search.sql.
