create or replace function public.search_product_ids(
  p_query text,
  p_locale text,
  p_country_code text,
  p_category_id bigint,
  p_limit integer
)
returns table(product_id bigint, rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  with search_input as (
    select
      btrim(coalesce(p_query, '')) as raw_query,
      lower(extensions.unaccent(btrim(coalesce(p_query, '')))) as normalized_query,
      case
        when p_locale = 'en-US' then 'english'::regconfig
        else 'spanish'::regconfig
      end as search_config
  ),
  query_terms as (
    select
      search_input.*,
      case
        when raw_query = '' then null
        else websearch_to_tsquery(search_config, raw_query)
      end as ts_query
    from search_input
  ),
  candidates as (
    select
      products.id as product_id,
      products.created_at,
      coalesce(product_translations.name, products.name) as localized_name,
      coalesce(product_translations.description, products.description) as localized_description,
      products.search_document as original_search_document,
      product_translations.search_document as translation_search_document,
      shops.name as shop_name,
      query_terms.normalized_query,
      query_terms.search_config,
      query_terms.ts_query,
      case
        when query_terms.raw_query = '' then false
        when not coalesce(
          leaf.is_active
          and root.is_active
          and leaf.listing_type = 'product'
          and root.listing_type = 'product',
          false
        ) then false
        else exists (
          select 1
          from public.category_translations
          where category_translations.category_id in (leaf.id, leaf.parent_id)
            and category_translations.locale = p_locale
            and strpos(
              lower(extensions.unaccent(category_translations.name)),
              query_terms.normalized_query
            ) > 0
        ) or exists (
          select 1
          from public.category_aliases
          where category_aliases.category_id in (leaf.id, leaf.parent_id)
            and category_aliases.locale = p_locale
            and strpos(
              lower(extensions.unaccent(category_aliases.alias)),
              query_terms.normalized_query
            ) > 0
        )
      end as category_matches
    from public.products
    join public.shops on shops.id = products.shop_id
    left join public.categories as leaf on leaf.id = products.category_id
    left join public.categories as root on root.id = leaf.parent_id
    left join public.product_translations
      on product_translations.product_id = products.id
      and product_translations.locale = p_locale
      and product_translations.review_status = 'approved'
    cross join query_terms
    where products.status = 'published'
      and (p_country_code is null or shops.country_code = upper(p_country_code))
      and (
        p_category_id is null
        or (
          leaf.is_active
          and root.is_active
          and leaf.listing_type = 'product'
          and root.listing_type = 'product'
          and (
            products.category_id = p_category_id
            or leaf.parent_id = p_category_id
          )
        )
      )
  )
  select
    candidates.product_id,
    (
      case
        when candidates.normalized_query = '' then 0
        when lower(extensions.unaccent(candidates.localized_name)) = candidates.normalized_query then 100
        when starts_with(
          lower(extensions.unaccent(candidates.localized_name)),
          candidates.normalized_query
        ) then 80
        when to_tsvector(candidates.search_config, candidates.localized_name) @@ candidates.ts_query then 60
        when candidates.category_matches then 50
        when to_tsvector(candidates.search_config, candidates.localized_description) @@ candidates.ts_query then 30
        when strpos(
          lower(extensions.unaccent(candidates.shop_name)),
          candidates.normalized_query
        ) > 0 then 10
        else 0
      end
      + case
          when candidates.ts_query is null then 0
          else ts_rank(
            to_tsvector(
              candidates.search_config,
              candidates.localized_name || ' ' || candidates.localized_description
            ),
            candidates.ts_query
          )
        end
    )::real as rank
  from candidates
  where candidates.normalized_query = ''
    or starts_with(
      lower(extensions.unaccent(candidates.localized_name)),
      candidates.normalized_query
    )
    or candidates.original_search_document @@ candidates.ts_query
    or candidates.translation_search_document @@ candidates.ts_query
    or to_tsvector(candidates.search_config, candidates.localized_name) @@ candidates.ts_query
    or candidates.category_matches
    or to_tsvector(candidates.search_config, candidates.localized_description) @@ candidates.ts_query
    or strpos(
      lower(extensions.unaccent(candidates.shop_name)),
      candidates.normalized_query
    ) > 0
  order by rank desc, candidates.created_at desc, candidates.product_id desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

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
    from public.products
    where products.id = p_product_id
      and products.status = 'published'
  ) then
    raise exception using errcode = '22023', message = 'Selected product must be published.';
  end if;

  if p_position is null or p_position < 1 then
    raise exception using errcode = '22023', message = 'Selected position must be one or greater.';
  end if;

  select
    search_events.result_count,
    search_events.selected_product_id,
    search_events.selected_position,
    search_events.selected_at
  into
    event_result_count,
    event_selected_product_id,
    event_selected_position,
    event_selected_at
  from public.search_events
  where search_events.id = p_event_id
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

revoke execute on function public.search_product_ids(text, text, text, bigint, integer) from public, anon, authenticated;
revoke execute on function public.record_search_selection(uuid, bigint, integer) from public, anon, authenticated;

grant execute on function public.search_product_ids(text, text, text, bigint, integer) to anon, authenticated;
grant execute on function public.record_search_selection(uuid, bigint, integer) to anon, authenticated;
