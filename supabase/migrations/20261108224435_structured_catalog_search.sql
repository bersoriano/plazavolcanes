-- NULL means the seller has not declared this attribute for this listing.
alter table public.products
  add column color text check (color in ('black', 'white', 'blue', 'red', 'green')),
  add column size text check (size in ('XS', 'S', 'M', 'L', 'XL')),
  add column material text check (material in ('cotton', 'wool', 'leather', 'polyester')),
  add column waterproof boolean;

-- A budget-only search can range-scan prices within the public MXN inventory.
create index products_public_mxn_price_idx on public.products (price_mxn)
  where status = 'published' and is_admin_enabled and currency_code = 'MXN';

create function public.search_catalog_ids(
  p_query text, p_locale text, p_country_code text, p_administrative_area_code text,
  p_category_id bigint, p_limit integer, p_filters jsonb
)
returns table (product_id bigint, rank real)
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_min numeric;
  v_max numeric;
  v_min_inclusive boolean;
  v_max_inclusive boolean;
  v_name text;
  v_query tsquery;
  v_lexical_text text;
  v_config regconfig;
begin
  if p_query is null or char_length(p_query) > 500
    or p_locale is null or p_locale not in ('en-US', 'es-MX')
    or p_country_code is null or p_country_code !~ '^[A-Z]{2}$'
    or (p_administrative_area_code is not null and (
      p_country_code <> 'MX' or p_administrative_area_code not in (
        'MX-AGU','MX-BCN','MX-BCS','MX-CAM','MX-CHP','MX-CHH','MX-CMX','MX-COA',
        'MX-COL','MX-DUR','MX-GUA','MX-GRO','MX-HID','MX-JAL','MX-MEX','MX-MIC',
        'MX-MOR','MX-NAY','MX-NLE','MX-OAX','MX-PUE','MX-QUE','MX-ROO','MX-SLP',
        'MX-SIN','MX-SON','MX-TAB','MX-TAM','MX-TLA','MX-VER','MX-YUC','MX-ZAC'
      )))
    or p_category_id <= 0 or p_limit is null or p_limit not between 1 and 100
    or jsonb_typeof(p_filters) is distinct from 'object'
    or octet_length(p_filters::text) > 1024 then
    raise exception using errcode = '22023', message = 'Invalid catalog search parameters.';
  end if;

  if exists (
    select 1 from jsonb_each(p_filters) as f(key, value)
    where not case
      when key in ('min', 'max') then jsonb_typeof(value) = 'number'
      when key in ('minInclusive', 'maxInclusive', 'inStock', 'waterproof') then jsonb_typeof(value) = 'boolean'
      when key = 'currency' then value = '"MXN"'::jsonb
      when key = 'condition' then value <@ '["new","used"]'::jsonb and jsonb_typeof(value) = 'string'
      when key = 'grade' then value <@ '["mint","good","fair","bad","scrap"]'::jsonb and jsonb_typeof(value) = 'string'
      when key = 'color' then value <@ '["black","white","blue","red","green"]'::jsonb and jsonb_typeof(value) = 'string'
      when key = 'size' then value <@ '["XS","S","M","L","XL"]'::jsonb and jsonb_typeof(value) = 'string'
      when key = 'material' then value <@ '["cotton","wool","leather","polyester"]'::jsonb and jsonb_typeof(value) = 'string'
      else false end
  ) then
    raise exception using errcode = '22023', message = 'Invalid catalog filter.';
  end if;

  v_min := (p_filters->>'min')::numeric;
  v_max := (p_filters->>'max')::numeric;
  v_min_inclusive := coalesce((p_filters->>'minInclusive')::boolean, true);
  v_max_inclusive := coalesce((p_filters->>'maxInclusive')::boolean, true);
  if v_min not between 0 and 9999999999.99 or v_min <> trunc(v_min, 2)
    or v_max not between 0 and 9999999999.99 or v_max <> trunc(v_max, 2)
    or (p_filters ? 'minInclusive' and v_min is null)
    or (p_filters ? 'maxInclusive' and v_max is null)
    or coalesce(v_min, 0) + (case when v_min_inclusive then 0 else 0.01 end)
       > coalesce(v_max, 9999999999.99) - (case when v_max_inclusive then 0 else 0.01 end)
    or (p_filters ? 'grade' and p_filters->>'condition' = 'new') then
    raise exception using errcode = '22023', message = 'Inconsistent catalog filter.';
  end if;

  v_name := lower(extensions.unaccent(btrim(p_query)));
  if v_name ~ '^"[^"]+"$' then
    v_name := substr(v_name, 2, char_length(v_name) - 2);
  end if;
  v_config := case p_locale when 'en-US' then 'english'::regconfig else 'spanish'::regconfig end;
  if v_name <> '' then
    -- Rewrite one concept inside the parsed query. Ordinary adjacent terms
    -- stay conjunctive; quoted phrases, explicit OR, and exclusions survive.
    v_lexical_text := regexp_replace(p_query, '\m(jacket|chamarra|chaqueta)\M', 'jacket', 'gi');
    v_query := websearch_to_tsquery(v_config, v_lexical_text);
    if v_lexical_text ~* '\mjacket\M' then
      v_query := ts_rewrite(v_query, plainto_tsquery(v_config, 'jacket'),
        to_tsquery(v_config, 'jacket | chamarra | chaqueta'));
    end if;
  end if;

  return query
  with eligible as (
    select p.id, p.created_at, p.search_document,
      t.search_document as translated_document,
      to_tsvector(v_config, p.name) as name_vector,
      to_tsvector(v_config, t.name) as translated_name_vector,
      to_tsvector(v_config, p.name || ' ' || p.description) as document,
      to_tsvector(v_config, t.name || ' ' || t.description) as translation,
      lower(extensions.unaccent(p.name)) as original_name,
      lower(extensions.unaccent(t.name)) as local_name,
      lower(extensions.unaccent(s.name)) as shop_name,
      leaf.id as leaf_id, root.id as root_id
    from public.products p
    join public.shops s on s.id = p.shop_id
    left join public.categories leaf on leaf.id = p.category_id and leaf.is_active and leaf.listing_type = 'product'
    left join public.categories root on root.id = leaf.parent_id and root.is_active and root.listing_type = 'product'
    left join public.product_translations t
      on t.product_id = p.id and t.locale = p_locale and t.review_status = 'approved'
    where p.status = 'published' and p.is_admin_enabled and p.expires_at > now() and s.is_publishing_approved
      and s.country_code = p_country_code
      and ((v_min is null and v_max is null and not p_filters ? 'currency') or p.currency_code = 'MXN')
      and (p_administrative_area_code is null or s.administrative_area_codes && array[p_administrative_area_code])
      and (p_category_id is null or (root.id is not null and p_category_id in (leaf.id, root.id)))
      and (v_min is null or p.price_mxn > v_min or (v_min_inclusive and p.price_mxn = v_min))
      and (v_max is null or p.price_mxn < v_max or (v_max_inclusive and p.price_mxn = v_max))
      and (not p_filters ? 'condition' or p.condition = p_filters->>'condition')
      and (not p_filters ? 'grade' or (p.condition = 'used' and p.used_condition = p_filters->>'grade'))
      and (not coalesce((p_filters->>'inStock')::boolean, false) or p.units_available > 0)
      and (not p_filters ? 'color' or p.color = p_filters->>'color')
      and (not p_filters ? 'size' or p.size = p_filters->>'size')
      and (not p_filters ? 'material' or p.material = p_filters->>'material')
      and (not p_filters ? 'waterproof' or p.waterproof = (p_filters->>'waterproof')::boolean)
  ), scored as (
    select e.id, e.created_at, case
      when v_name = '' then 0
      when v_name in (e.original_name, e.local_name) then 100
      when starts_with(e.original_name, v_name) or starts_with(e.local_name, v_name) then 80
      when e.name_vector @@ v_query or e.translated_name_vector @@ v_query then 60
      when e.root_id is not null and (exists (
        select 1 from public.category_translations ct where ct.category_id in (e.leaf_id, e.root_id)
          and ct.locale = p_locale and strpos(lower(extensions.unaccent(ct.name)), v_name) > 0
      ) or exists (
        select 1 from public.category_aliases ca where ca.category_id in (e.leaf_id, e.root_id)
          and ca.locale = p_locale and strpos(lower(extensions.unaccent(ca.alias)), v_name) > 0
      )) then 50
      when e.search_document @@ v_query or e.translated_document @@ v_query
        or e.document @@ v_query or e.translation @@ v_query then 30
      when strpos(e.shop_name, v_name) > 0 then 10
    end as match_tier,
    case when v_query is not null then greatest(ts_rank(e.document, v_query, 32),
      ts_rank(e.translation, v_query, 32)) else 0 end as relevance
    from eligible e
  )
  select s.id, (s.match_tier + s.relevance)::real as score
  from scored s where s.match_tier is not null
  order by score desc, s.created_at desc, s.id desc
  limit p_limit;
end;
$$;

revoke all on function public.search_catalog_ids(text,text,text,text,bigint,integer,jsonb) from public;
grant execute on function public.search_catalog_ids(text,text,text,text,bigint,integer,jsonb) to anon, authenticated;

-- Roll back the app first. The legacy search_product_ids signature remains live.
-- drop function public.search_catalog_ids(text,text,text,text,bigint,integer,jsonb);
-- drop index public.products_public_mxn_price_idx;
-- To remove seller data permanently, back up these columns before dropping them:
-- alter table public.products drop column waterproof, drop column material, drop column size, drop column color;
