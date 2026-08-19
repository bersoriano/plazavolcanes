create extension if not exists unaccent with schema extensions;

create table public.categories (
  id bigint generated always as identity primary key,
  parent_id bigint references public.categories (id) on delete restrict,
  listing_type text not null check (listing_type in ('product', 'service', 'restaurant')),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_type, slug),
  check (parent_id is null or parent_id <> id)
);

create index categories_parent_id_idx on public.categories (parent_id);

create table public.category_translations (
  category_id bigint not null references public.categories (id) on delete cascade,
  locale text not null check (locale in ('es-MX', 'en-US')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  primary key (category_id, locale)
);

create table public.category_aliases (
  category_id bigint not null references public.categories (id) on delete cascade,
  locale text not null check (locale in ('es-MX', 'en-US')),
  alias text not null check (char_length(btrim(alias)) between 1 and 120),
  primary key (category_id, locale, alias)
);

create table public.category_suggestions (
  id bigint generated always as identity primary key,
  seller_id uuid not null references auth.users (id) on delete cascade,
  root_category_id bigint references public.categories (id) on delete set null,
  locale text not null check (locale in ('es-MX', 'en-US')),
  suggested_name text not null check (char_length(btrim(suggested_name)) between 2 and 120),
  context text check (context is null or char_length(context) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (
    (status = 'pending' and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null)
  )
);

create index category_suggestions_seller_created_at_idx
  on public.category_suggestions (seller_id, created_at desc);
create index category_suggestions_root_category_id_idx
  on public.category_suggestions (root_category_id);

create function public.validate_category_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_category public.categories%rowtype;
begin
  if new.parent_id is null then
    if exists (
      select 1
      from public.categories as child
      where child.parent_id = new.id
        and child.listing_type <> new.listing_type
    ) then
      raise exception using
        errcode = '23514',
        message = 'Parent and child categories must share a listing type.';
    end if;

    return new;
  end if;

  select *
  into parent_category
  from public.categories
  where id = new.parent_id;

  if parent_category.id is not null and parent_category.parent_id is not null then
    raise exception using
      errcode = '23514',
      message = 'Category hierarchy supports roots and leaves only.';
  end if;

  if exists (
    select 1
    from public.categories as child
    where child.parent_id = new.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Category hierarchy supports roots and leaves only.';
  end if;

  if parent_category.id is not null and parent_category.listing_type <> new.listing_type then
    raise exception using
      errcode = '23514',
      message = 'Parent and child categories must share a listing type.';
  end if;

  return new;
end;
$$;

create trigger categories_validate_hierarchy
before insert or update of parent_id, listing_type on public.categories
for each row execute function public.validate_category_hierarchy();

alter table public.products
  add column category_id bigint references public.categories (id) on delete restrict,
  add column currency_code text not null default 'MXN' check (currency_code ~ '^[A-Z]{3}$'),
  add column content_locale text not null default 'es-MX' check (content_locale in ('es-MX', 'en-US')),
  add column search_document tsvector generated always as (
    setweight(to_tsvector('spanish'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(description, '')), 'C')
  ) stored;

create index products_category_id_idx on public.products (category_id);
create index products_search_document_idx on public.products using gin (search_document);
create index products_category_published_idx on public.products (category_id, created_at desc)
  where status = 'published';

create function public.require_publishable_product_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and not exists (
    select 1
    from public.categories as leaf
    join public.categories as root on root.id = leaf.parent_id
    where leaf.id = new.category_id
      and leaf.is_active
      and leaf.listing_type = 'product'
      and root.is_active
      and root.listing_type = 'product'
      and not exists (
        select 1
        from public.categories as child
        where child.parent_id = leaf.id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Published products require an active product leaf category.';
  end if;

  return new;
end;
$$;

create trigger products_require_publishable_category
before insert or update on public.products
for each row execute function public.require_publishable_product_category();

create table public.product_translations (
  product_id bigint not null references public.products (id) on delete cascade,
  locale text not null check (locale in ('es-MX', 'en-US')),
  name text not null check (char_length(name) between 3 and 120),
  description text not null check (char_length(description) between 20 and 3000),
  source text not null default 'manual' check (source in ('manual', 'ai')),
  review_status text not null default 'draft' check (review_status in ('draft', 'approved')),
  search_document tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, locale)
);

create index product_translations_search_document_idx
  on public.product_translations using gin (search_document);

create table public.search_events (
  id uuid primary key default gen_random_uuid(),
  normalized_query text not null check (char_length(normalized_query) between 1 and 200),
  locale text not null check (locale in ('es-MX', 'en-US')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  category_id bigint references public.categories (id) on delete set null,
  result_count integer not null check (result_count >= 0),
  selected_product_id bigint references public.products (id) on delete set null,
  selected_position integer check (selected_position > 0),
  created_at timestamptz not null default now(),
  selected_at timestamptz,
  check (
    (selected_product_id is null and selected_position is null and selected_at is null)
    or (selected_position is not null and selected_at is not null)
  )
);

create index search_events_created_at_idx on public.search_events (created_at);
create index search_events_category_id_idx on public.search_events (category_id);
create index search_events_selected_product_id_idx on public.search_events (selected_product_id);

revoke all on table
  public.categories,
  public.category_translations,
  public.category_aliases,
  public.category_suggestions,
  public.product_translations,
  public.search_events
from anon, authenticated;

grant select on table
  public.categories,
  public.category_translations,
  public.category_aliases
to anon, authenticated;

grant select, insert on table public.category_suggestions to authenticated;
grant usage, select on sequence public.category_suggestions_id_seq to authenticated;

grant select on table public.product_translations to anon;
grant select, insert, update, delete on table public.product_translations to authenticated;

alter table public.categories enable row level security;
alter table public.category_translations enable row level security;
alter table public.category_aliases enable row level security;
alter table public.category_suggestions enable row level security;
alter table public.product_translations enable row level security;
alter table public.search_events enable row level security;

create policy "active_categories_are_public"
  on public.categories for select
  to anon, authenticated
  using (is_active);

create policy "active_category_translations_are_public"
  on public.category_translations for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.categories
      where categories.id = category_translations.category_id
        and categories.is_active
    )
  );

create policy "active_category_aliases_are_public"
  on public.category_aliases for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.categories
      where categories.id = category_aliases.category_id
        and categories.is_active
    )
  );

create policy "sellers_create_own_category_suggestions"
  on public.category_suggestions for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = seller_id
    and status = 'pending'
    and reviewed_at is null
  );

create policy "sellers_read_own_category_suggestions"
  on public.category_suggestions for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = seller_id
  );

create policy "published_product_translations_are_public"
  on public.product_translations for select
  to anon, authenticated
  using (
    review_status = 'approved'
    and exists (
      select 1
      from public.products
      where products.id = product_translations.product_id
        and products.status = 'published'
    )
  );

create policy "owners_read_product_translations"
  on public.product_translations for select
  to authenticated
  using (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_translations.product_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_create_product_translations"
  on public.product_translations for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_translations.product_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_update_product_translations"
  on public.product_translations for update
  to authenticated
  using (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_translations.product_id
        and shops.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_translations.product_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_delete_product_translations"
  on public.product_translations for delete
  to authenticated
  using (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_translations.product_id
        and shops.owner_id = (select auth.uid())
    )
  );

create function public.search_product_ids(
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
        else exists (
          select 1
          from public.category_translations
          where category_translations.category_id in (leaf.id, leaf.parent_id)
            and category_translations.locale = p_locale
            and lower(extensions.unaccent(category_translations.name)) like '%' || query_terms.normalized_query || '%'
        ) or exists (
          select 1
          from public.category_aliases
          where category_aliases.category_id in (leaf.id, leaf.parent_id)
            and category_aliases.locale = p_locale
            and lower(extensions.unaccent(category_aliases.alias)) like '%' || query_terms.normalized_query || '%'
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
      and (
        products.category_id is null
        or (
          leaf.is_active
          and leaf.listing_type = 'product'
          and root.is_active
          and root.listing_type = 'product'
        )
      )
      and (p_country_code is null or shops.country_code = upper(p_country_code))
      and (
        p_category_id is null
        or products.category_id = p_category_id
        or leaf.parent_id = p_category_id
      )
  )
  select
    candidates.product_id,
    (
      case
        when candidates.normalized_query = '' then 0
        when lower(extensions.unaccent(candidates.localized_name)) = candidates.normalized_query then 100
        when lower(extensions.unaccent(candidates.localized_name)) like candidates.normalized_query || '%' then 80
        when to_tsvector(candidates.search_config, candidates.localized_name) @@ candidates.ts_query then 60
        when candidates.category_matches then 50
        when to_tsvector(candidates.search_config, candidates.localized_description) @@ candidates.ts_query then 30
        when lower(extensions.unaccent(candidates.shop_name)) like '%' || candidates.normalized_query || '%' then 10
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
    or lower(extensions.unaccent(candidates.localized_name)) like candidates.normalized_query || '%'
    or candidates.original_search_document @@ candidates.ts_query
    or candidates.translation_search_document @@ candidates.ts_query
    or to_tsvector(candidates.search_config, candidates.localized_name) @@ candidates.ts_query
    or candidates.category_matches
    or to_tsvector(candidates.search_config, candidates.localized_description) @@ candidates.ts_query
    or lower(extensions.unaccent(candidates.shop_name)) like '%' || candidates.normalized_query || '%'
  order by rank desc, candidates.created_at desc, candidates.product_id desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

create function public.record_catalog_search(
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

create function public.record_search_selection(
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

  update public.search_events
  set selected_product_id = p_product_id,
      selected_position = p_position,
      selected_at = now()
  where id = p_event_id;

  if not found then
    raise exception using errcode = '22023', message = 'Search event does not exist.';
  end if;
end;
$$;

revoke execute on function public.validate_category_hierarchy() from public, anon, authenticated;
revoke execute on function public.require_publishable_product_category() from public, anon, authenticated;
revoke execute on function public.search_product_ids(text, text, text, bigint, integer) from public, anon, authenticated;
revoke execute on function public.record_catalog_search(text, text, text, bigint, integer) from public, anon, authenticated;
revoke execute on function public.record_search_selection(uuid, bigint, integer) from public, anon, authenticated;

grant execute on function public.search_product_ids(text, text, text, bigint, integer) to anon, authenticated;
grant execute on function public.record_catalog_search(text, text, text, bigint, integer) to anon, authenticated;
grant execute on function public.record_search_selection(uuid, bigint, integer) to anon, authenticated;

insert into public.categories (listing_type, slug, sort_order)
values
  ('product', 'electronica', 1),
  ('product', 'hogar-y-jardin', 2),
  ('product', 'moda-y-accesorios', 3),
  ('product', 'belleza-y-cuidado-personal', 4),
  ('product', 'alimentos-y-bebidas', 5),
  ('product', 'deportes-y-aire-libre', 6),
  ('product', 'bebes-ninas-y-ninos', 7),
  ('product', 'arte-papeleria-y-manualidades', 8),
  ('product', 'mascotas', 9),
  ('product', 'automotriz', 10),
  ('product', 'libros-medios-y-coleccionables', 11);

with leaf_seed (root_slug, leaf_slug, sort_order) as (
  values
    ('electronica', 'celulares-y-accesorios', 1),
    ('electronica', 'computacion', 2),
    ('electronica', 'audio-y-video', 3),
    ('electronica', 'videojuegos', 4),
    ('electronica', 'accesorios-electronicos', 5),
    ('hogar-y-jardin', 'muebles', 1),
    ('hogar-y-jardin', 'decoracion', 2),
    ('hogar-y-jardin', 'cocina-y-comedor', 3),
    ('hogar-y-jardin', 'electrodomesticos', 4),
    ('hogar-y-jardin', 'jardin-y-herramientas', 5),
    ('moda-y-accesorios', 'ropa-para-mujer', 1),
    ('moda-y-accesorios', 'ropa-para-hombre', 2),
    ('moda-y-accesorios', 'calzado', 3),
    ('moda-y-accesorios', 'bolsas-y-accesorios', 4),
    ('moda-y-accesorios', 'joyeria-y-relojes', 5),
    ('belleza-y-cuidado-personal', 'maquillaje', 1),
    ('belleza-y-cuidado-personal', 'cuidado-de-piel', 2),
    ('belleza-y-cuidado-personal', 'cuidado-del-cabello', 3),
    ('belleza-y-cuidado-personal', 'perfumes', 4),
    ('belleza-y-cuidado-personal', 'cuidado-personal', 5),
    ('alimentos-y-bebidas', 'despensa', 1),
    ('alimentos-y-bebidas', 'panaderia-y-postres', 2),
    ('alimentos-y-bebidas', 'bebidas-sin-alcohol', 3),
    ('alimentos-y-bebidas', 'alimentos-artesanales', 4),
    ('deportes-y-aire-libre', 'ejercicio-y-fitness', 1),
    ('deportes-y-aire-libre', 'ciclismo', 2),
    ('deportes-y-aire-libre', 'camping', 3),
    ('deportes-y-aire-libre', 'articulos-deportivos', 4),
    ('bebes-ninas-y-ninos', 'ropa-infantil', 1),
    ('bebes-ninas-y-ninos', 'juguetes', 2),
    ('bebes-ninas-y-ninos', 'cuidado-infantil', 3),
    ('bebes-ninas-y-ninos', 'articulos-escolares', 4),
    ('arte-papeleria-y-manualidades', 'arte', 1),
    ('arte-papeleria-y-manualidades', 'papeleria', 2),
    ('arte-papeleria-y-manualidades', 'manualidades', 3),
    ('arte-papeleria-y-manualidades', 'instrumentos-musicales', 4),
    ('mascotas', 'alimento-para-mascotas', 1),
    ('mascotas', 'accesorios-para-mascotas', 2),
    ('mascotas', 'higiene-y-cuidado-para-mascotas', 3),
    ('automotriz', 'refacciones', 1),
    ('automotriz', 'accesorios-automotrices', 2),
    ('automotriz', 'herramientas-automotrices', 3),
    ('libros-medios-y-coleccionables', 'libros', 1),
    ('libros-medios-y-coleccionables', 'musica-y-peliculas', 2),
    ('libros-medios-y-coleccionables', 'coleccionables', 3),
    ('libros-medios-y-coleccionables', 'antiguedades', 4)
)
insert into public.categories (parent_id, listing_type, slug, sort_order)
select roots.id, 'product', leaf_seed.leaf_slug, leaf_seed.sort_order
from leaf_seed
join public.categories as roots
  on roots.listing_type = 'product'
  and roots.slug = leaf_seed.root_slug
order by roots.sort_order, leaf_seed.sort_order;

with translation_seed (slug, es_name, en_name) as (
  values
    ('electronica', 'Electrónica', 'Electronics'),
    ('celulares-y-accesorios', 'Celulares y accesorios', 'Cell Phones & Accessories'),
    ('computacion', 'Computación', 'Computers'),
    ('audio-y-video', 'Audio y video', 'Audio & Video'),
    ('videojuegos', 'Videojuegos', 'Video Games'),
    ('accesorios-electronicos', 'Accesorios electrónicos', 'Electronics Accessories'),
    ('hogar-y-jardin', 'Hogar y jardín', 'Home & Garden'),
    ('muebles', 'Muebles', 'Furniture'),
    ('decoracion', 'Decoración', 'Home Decor'),
    ('cocina-y-comedor', 'Cocina y comedor', 'Kitchen & Dining'),
    ('electrodomesticos', 'Electrodomésticos', 'Appliances'),
    ('jardin-y-herramientas', 'Jardín y herramientas', 'Garden & Tools'),
    ('moda-y-accesorios', 'Moda y accesorios', 'Fashion & Accessories'),
    ('ropa-para-mujer', 'Ropa para mujer', 'Women''s Clothing'),
    ('ropa-para-hombre', 'Ropa para hombre', 'Men''s Clothing'),
    ('calzado', 'Calzado', 'Footwear'),
    ('bolsas-y-accesorios', 'Bolsas y accesorios', 'Bags & Accessories'),
    ('joyeria-y-relojes', 'Joyería y relojes', 'Jewelry & Watches'),
    ('belleza-y-cuidado-personal', 'Belleza y cuidado personal', 'Beauty & Personal Care'),
    ('maquillaje', 'Maquillaje', 'Makeup'),
    ('cuidado-de-piel', 'Cuidado de piel', 'Skin Care'),
    ('cuidado-del-cabello', 'Cuidado del cabello', 'Hair Care'),
    ('perfumes', 'Perfumes', 'Fragrances'),
    ('cuidado-personal', 'Cuidado personal', 'Personal Care'),
    ('alimentos-y-bebidas', 'Alimentos y bebidas', 'Food & Beverages'),
    ('despensa', 'Despensa', 'Pantry'),
    ('panaderia-y-postres', 'Panadería y postres', 'Bakery & Desserts'),
    ('bebidas-sin-alcohol', 'Bebidas sin alcohol', 'Non-Alcoholic Beverages'),
    ('alimentos-artesanales', 'Alimentos artesanales', 'Artisan Foods'),
    ('deportes-y-aire-libre', 'Deportes y aire libre', 'Sports & Outdoors'),
    ('ejercicio-y-fitness', 'Ejercicio y fitness', 'Exercise & Fitness'),
    ('ciclismo', 'Ciclismo', 'Cycling'),
    ('camping', 'Camping', 'Camping'),
    ('articulos-deportivos', 'Artículos deportivos', 'Sporting Goods'),
    ('bebes-ninas-y-ninos', 'Bebés, niñas y niños', 'Babies & Kids'),
    ('ropa-infantil', 'Ropa infantil', 'Children''s Clothing'),
    ('juguetes', 'Juguetes', 'Toys'),
    ('cuidado-infantil', 'Cuidado infantil', 'Child Care'),
    ('articulos-escolares', 'Artículos escolares', 'School Supplies'),
    ('arte-papeleria-y-manualidades', 'Arte, papelería y manualidades', 'Art, Stationery & Crafts'),
    ('arte', 'Arte', 'Art'),
    ('papeleria', 'Papelería', 'Stationery'),
    ('manualidades', 'Manualidades', 'Crafts'),
    ('instrumentos-musicales', 'Instrumentos musicales', 'Musical Instruments'),
    ('mascotas', 'Mascotas', 'Pets'),
    ('alimento-para-mascotas', 'Alimento', 'Pet Food'),
    ('accesorios-para-mascotas', 'Accesorios', 'Pet Accessories'),
    ('higiene-y-cuidado-para-mascotas', 'Higiene y cuidado', 'Pet Hygiene & Care'),
    ('automotriz', 'Automotriz', 'Automotive'),
    ('refacciones', 'Refacciones', 'Auto Parts'),
    ('accesorios-automotrices', 'Accesorios', 'Automotive Accessories'),
    ('herramientas-automotrices', 'Herramientas', 'Automotive Tools'),
    ('libros-medios-y-coleccionables', 'Libros, medios y coleccionables', 'Books, Media & Collectibles'),
    ('libros', 'Libros', 'Books'),
    ('musica-y-peliculas', 'Música y películas', 'Music & Movies'),
    ('coleccionables', 'Coleccionables', 'Collectibles'),
    ('antiguedades', 'Antigüedades', 'Antiques')
)
insert into public.category_translations (category_id, locale, name)
select categories.id, localized.locale, localized.name
from translation_seed
join public.categories on categories.slug = translation_seed.slug
cross join lateral (
  values
    ('es-MX'::text, translation_seed.es_name),
    ('en-US'::text, translation_seed.en_name)
) as localized(locale, name);

with alias_seed (slug, locale, alias) as (
  values
    ('celulares-y-accesorios', 'es-MX', 'celular'),
    ('celulares-y-accesorios', 'es-MX', 'teléfono'),
    ('celulares-y-accesorios', 'es-MX', 'smartphone'),
    ('celulares-y-accesorios', 'es-MX', 'móvil'),
    ('celulares-y-accesorios', 'en-US', 'phone'),
    ('celulares-y-accesorios', 'en-US', 'smartphone'),
    ('celulares-y-accesorios', 'en-US', 'mobile phone'),
    ('computacion', 'es-MX', 'computadora'),
    ('computacion', 'es-MX', 'laptop'),
    ('computacion', 'es-MX', 'pc'),
    ('computacion', 'en-US', 'computer'),
    ('computacion', 'en-US', 'laptop'),
    ('computacion', 'en-US', 'pc'),
    ('decoracion', 'es-MX', 'decoración del hogar'),
    ('decoracion', 'es-MX', 'adornos'),
    ('decoracion', 'en-US', 'home decor'),
    ('decoracion', 'en-US', 'decorations'),
    ('ropa-para-mujer', 'es-MX', 'ropa mujer'),
    ('ropa-para-mujer', 'es-MX', 'moda mujer'),
    ('ropa-para-mujer', 'en-US', 'womenswear'),
    ('ropa-para-mujer', 'en-US', 'women''s fashion'),
    ('panaderia-y-postres', 'es-MX', 'pan'),
    ('panaderia-y-postres', 'es-MX', 'pastel'),
    ('panaderia-y-postres', 'es-MX', 'repostería'),
    ('panaderia-y-postres', 'en-US', 'bakery'),
    ('panaderia-y-postres', 'en-US', 'cake'),
    ('panaderia-y-postres', 'en-US', 'desserts'),
    ('refacciones', 'es-MX', 'autopartes'),
    ('refacciones', 'es-MX', 'piezas para auto'),
    ('refacciones', 'en-US', 'auto parts'),
    ('refacciones', 'en-US', 'car parts')
)
insert into public.category_aliases (category_id, locale, alias)
select categories.id, alias_seed.locale, alias_seed.alias
from alias_seed
join public.categories on categories.slug = alias_seed.slug;

-- Expand-only migration: existing products are not updated or backfilled.
-- New and subsequently edited published products are validated by the trigger.
--
-- Destructive rollback, only if explicitly required after callers stop using the new API:
-- drop function public.record_search_selection(uuid, bigint, integer);
-- drop function public.record_catalog_search(text, text, text, bigint, integer);
-- drop function public.search_product_ids(text, text, text, bigint, integer);
-- drop table public.search_events;
-- drop table public.product_translations;
-- drop trigger products_require_publishable_category on public.products;
-- drop function public.require_publishable_product_category();
-- drop index public.products_category_published_idx;
-- drop index public.products_search_document_idx;
-- drop index public.products_category_id_idx;
-- alter table public.products
--   drop column search_document,
--   drop column content_locale,
--   drop column currency_code,
--   drop column category_id;
-- drop table public.category_suggestions;
-- drop table public.category_aliases;
-- drop table public.category_translations;
-- drop trigger categories_validate_hierarchy on public.categories;
-- drop function public.validate_category_hierarchy();
-- drop table public.categories;
-- The shared unaccent extension is intentionally retained during rollback.
