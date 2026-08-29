begin;

create extension if not exists pgtap with schema extensions;

select plan(84);

select has_table('public', 'categories', 'categories table exists');
select has_table('public', 'category_translations', 'category translations table exists');
select has_table('public', 'category_aliases', 'category aliases table exists');
select has_table('public', 'category_suggestions', 'category suggestions table exists');
select has_table('public', 'product_translations', 'product translations table exists');
select has_table('public', 'search_events', 'search events table exists');

select has_column('public', 'products', 'category_id', 'products have category id');
select has_column('public', 'products', 'currency_code', 'products have currency code');
select has_column('public', 'products', 'content_locale', 'products have content locale');
select has_column('public', 'products', 'search_document', 'products have a search document');

select has_function(
  'public',
  'search_product_ids',
  array['text', 'text', 'text', 'text', 'bigint', 'integer'],
  'search product ids RPC exists with its public signature'
);
select has_function(
  'public',
  'record_catalog_search',
  array['text', 'text', 'text', 'bigint', 'integer'],
  'record catalog search RPC exists with its public signature'
);
select has_function(
  'public',
  'record_search_selection',
  array['uuid', 'bigint', 'integer'],
  'record search selection RPC exists with its public signature'
);

select results_eq(
  $$select pg_get_function_result('public.search_product_ids(text,text,text,text,bigint,integer)'::regprocedure)$$,
  array['TABLE(product_id bigint, rank real)'::text],
  'search RPC returns ranked product ids'
);
select results_eq(
  $$select pg_get_function_result('public.record_catalog_search(text,text,text,bigint,integer)'::regprocedure)$$,
  array['uuid'::text],
  'catalog search telemetry RPC returns an event id'
);
select results_eq(
  $$select pg_get_function_result('public.record_search_selection(uuid,bigint,integer)'::regprocedure)$$,
  array['void'::text],
  'search selection telemetry RPC returns void'
);

select results_eq(
  $$select count(*) from public.categories$$,
  array[57::bigint],
  'the exact initial taxonomy has eleven roots and forty-six leaves'
);
select results_eq(
  $$select count(*) from public.category_translations$$,
  array[114::bigint],
  'every initial category has Spanish and English translations'
);
select results_eq(
  $$select count(*) from public.category_aliases$$,
  array[31::bigint],
  'the exact localized aliases are seeded'
);

insert into auth.users (id, email, created_at) values
  ('123e4567-e89b-12d3-a456-426614174000', 'taxonomy-seller-a@test.local', '2026-08-19 10:00:00+00'),
  ('987fcdeb-51a2-43d7-9012-345678901234', 'taxonomy-seller-b@test.local', '2026-08-19 11:00:00+00');

insert into public.shops (owner_id, name, slug, description, country_code) values
  ('123e4567-e89b-12d3-a456-426614174000', 'Tecnología Volcanes', 'tecnologia-volcanes', 'Productos tecnológicos desde México.', 'MX'),
  ('987fcdeb-51a2-43d7-9012-345678901234', 'US Catalog Shop', 'us-catalog-shop', 'Technology products shipped from the United States.', 'US');

update public.shops
set is_publishing_approved = true
where slug in ('tecnologia-volcanes', 'us-catalog-shop');

alter table public.products disable trigger products_require_publishable_category;
insert into public.products (shop_id, name, description, price_mxn, status)
values ((select id from public.shops where slug = 'tecnologia-volcanes'), 'Publicación heredada', 'Producto publicado antes de existir la taxonomía.', 100, 'published');
alter table public.products enable trigger products_require_publishable_category;

select lives_ok(
  $$select id from public.products where status = 'published' and category_id is null$$,
  'legacy uncategorized publications remain readable'
);
select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status) values ((select id from public.shops where slug = 'tecnologia-volcanes'), 'Sin categoría', 'Descripción suficientemente larga para probar.', 100, 'published')$$,
  '23514', null, 'new publications require a category'
);
select lives_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status) values ((select id from public.shops where slug = 'tecnologia-volcanes'), 'Borrador libre', 'Descripción suficientemente larga para probar.', 100, 'draft')$$,
  'drafts may omit category'
);
select throws_ok(
  $$update public.products set price_mxn = 101 where name = 'Publicación heredada'$$,
  '23514',
  'Published products require an active product leaf category.',
  'legacy publications require classification on their next edit'
);

select lives_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status, category_id)
    select (select id from public.shops where slug = 'tecnologia-volcanes'), 'Funda resistente', 'Protección durable para equipos de uso diario.', 250, 'published', id
    from public.categories where slug = 'celulares-y-accesorios'$$,
  'published products accept an active product leaf category'
);
select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status, category_id)
    select (select id from public.shops where slug = 'tecnologia-volcanes'), 'Raíz inválida', 'Una categoría principal no puede clasificar productos.', 250, 'published', id
    from public.categories where slug = 'electronica'$$,
  '23514',
  'Published products require an active product leaf category.',
  'published products reject root categories'
);

insert into public.categories (parent_id, listing_type, slug, is_active)
select id, 'product', 'categoria-inactiva', false
from public.categories
where slug = 'electronica';

insert into public.category_translations (category_id, locale, name)
select id, 'es-MX', 'Categoría inactiva'
from public.categories
where slug = 'categoria-inactiva';

insert into public.category_aliases (category_id, locale, alias)
select id, 'es-MX', 'inactiva'
from public.categories
where slug = 'categoria-inactiva';

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status, category_id)
    select (select id from public.shops where slug = 'tecnologia-volcanes'), 'Categoría inactiva', 'Una categoría inactiva no permite publicar productos.', 250, 'published', id
    from public.categories where slug = 'categoria-inactiva'$$,
  '23514',
  'Published products require an active product leaf category.',
  'published products reject inactive leaves'
);
select throws_ok(
  $$insert into public.categories (parent_id, listing_type, slug)
    select id, 'product', 'tercer-nivel'
    from public.categories where slug = 'celulares-y-accesorios'$$,
  '23514',
  'Category hierarchy supports roots and leaves only.',
  'category hierarchy rejects a third level'
);
select throws_ok(
  $$insert into public.categories (parent_id, listing_type, slug)
    select id, 'service', 'tipo-incompatible'
    from public.categories where slug = 'electronica'$$,
  '23514',
  'Parent and child categories must share a listing type.',
  'category hierarchy rejects listing type mismatches'
);

insert into public.products (shop_id, name, description, price_mxn, status, category_id)
select (select id from public.shops where slug = 'tecnologia-volcanes'), 'Cuaderno técnico', 'Equipo portátil potente para jugar y trabajar.', 15000, 'published', id
from public.categories
where slug = 'computacion';

insert into public.products (shop_id, name, description, price_mxn, status, category_id)
select (select id from public.shops where slug = 'us-catalog-shop'), 'Funda internacional', 'Protección durable para teléfonos vendidos en Estados Unidos.', 30, 'published', id
from public.categories
where slug = 'celulares-y-accesorios';

set local role anon;

select results_eq(
  $$select count(*) from public.categories where slug = 'categoria-inactiva'$$,
  array[0::bigint],
  'anonymous visitors cannot read inactive categories'
);
select results_eq(
  $$select count(*) from public.category_translations where name = 'Categoría inactiva'$$,
  array[0::bigint],
  'anonymous visitors cannot read inactive category translations'
);
select results_eq(
  $$select count(*) from public.category_aliases where alias = 'inactiva'$$,
  array[0::bigint],
  'anonymous visitors cannot read inactive category aliases'
);
select results_eq(
  $$select count(*) from public.categories where is_active$$,
  array[57::bigint],
  'anonymous visitors can read active categories'
);
select results_eq(
  $$select count(*) from public.category_translations$$,
  array[114::bigint],
  'anonymous visitors can read active category translations'
);
select results_eq(
  $$select count(*) from public.category_aliases$$,
  array[31::bigint],
  'anonymous visitors can read active category aliases'
);
select throws_ok(
  $$insert into public.categories (listing_type, slug) values ('product', 'categoria-publica')$$,
  '42501', null, 'anonymous visitors cannot create categories'
);
select ok(
  not exists (
    select 1
    from (values
      ('public.categories', 'insert'),
      ('public.categories', 'update'),
      ('public.categories', 'delete'),
      ('public.category_translations', 'insert'),
      ('public.category_translations', 'update'),
      ('public.category_translations', 'delete'),
      ('public.category_aliases', 'insert'),
      ('public.category_aliases', 'update'),
      ('public.category_aliases', 'delete')
    ) as taxonomy_privileges(table_name, privilege_name)
    where has_table_privilege('anon', table_name, privilege_name)
  ),
  'anonymous visitors have no taxonomy write privileges'
);

reset role;

insert into public.categories (id, listing_type, slug, is_active)
overriding system value
values
  (9001, 'product', 'raiz-producto-inactiva', false),
  (9002, 'service', 'raiz-servicio', true),
  (9003, 'restaurant', 'raiz-restaurante', true);

select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    select '123e4567-e89b-12d3-a456-426614174000', id, 'es-MX', 'Owner context leaf'
    from public.categories where slug = 'celulares-y-accesorios'$$,
  '23514',
  'Category suggestions require an active product root category.',
  'table owners cannot create suggestions with an active product leaf context'
);
select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    values ('123e4567-e89b-12d3-a456-426614174000', 9001, 'es-MX', 'Owner context inactive')$$,
  '23514',
  'Category suggestions require an active product root category.',
  'table owners cannot create suggestions with an inactive product root context'
);
select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    values ('123e4567-e89b-12d3-a456-426614174000', 9002, 'es-MX', 'Owner context service')$$,
  '23514',
  'Category suggestions require an active product root category.',
  'table owners cannot create suggestions with a service root context'
);
select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    values ('123e4567-e89b-12d3-a456-426614174000', 9003, 'es-MX', 'Owner context restaurant')$$,
  '23514',
  'Category suggestions require an active product root category.',
  'table owners cannot create suggestions with a restaurant root context'
);
select lives_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    select '123e4567-e89b-12d3-a456-426614174000', id, 'es-MX', 'Owner context active root'
    from public.categories where slug = 'electronica'$$,
  'table owners can create suggestions with an active product root context'
);
select lives_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    values ('123e4567-e89b-12d3-a456-426614174000', null, 'es-MX', 'Owner context null')$$,
  'table owners can create suggestions without a root context'
);
select throws_ok(
  $$update public.category_suggestions
    set root_category_id = (select id from public.categories where slug = 'celulares-y-accesorios')
    where suggested_name = 'Owner context null'$$,
  '23514',
  'Category suggestions require an active product root category.',
  'table owners cannot update suggestions to an invalid leaf context'
);

delete from public.category_suggestions where suggested_name like 'Owner context%';

set local role authenticated;
set local request.jwt.claim.sub = '123e4567-e89b-12d3-a456-426614174000';

select results_eq(
  $$select count(*) from public.categories where slug = 'categoria-inactiva'$$,
  array[1::bigint],
  'authenticated sellers can read inactive categories'
);
select results_eq(
  $$select count(*) from public.category_translations where name = 'Categoría inactiva'$$,
  array[1::bigint],
  'authenticated sellers can read inactive category translations'
);
select results_eq(
  $$select count(*) from public.category_aliases where alias = 'inactiva'$$,
  array[1::bigint],
  'authenticated sellers can read inactive category aliases'
);
select ok(
  not exists (
    select 1
    from (values
      ('public.categories', 'insert'),
      ('public.categories', 'update'),
      ('public.categories', 'delete'),
      ('public.category_translations', 'insert'),
      ('public.category_translations', 'update'),
      ('public.category_translations', 'delete'),
      ('public.category_aliases', 'insert'),
      ('public.category_aliases', 'update'),
      ('public.category_aliases', 'delete')
    ) as taxonomy_privileges(table_name, privilege_name)
    where has_table_privilege('authenticated', table_name, privilege_name)
  ),
  'authenticated sellers have no taxonomy write privileges'
);
select throws_ok(
  $$insert into public.category_translations (category_id, locale, name)
    select id, 'en-US', 'Unauthorized label' from public.categories where slug = 'categoria-inactiva'$$,
  '42501', null, 'authenticated sellers cannot write category translations'
);
select throws_ok(
  $$insert into public.category_aliases (category_id, locale, alias)
    select id, 'en-US', 'unauthorized alias' from public.categories where slug = 'categoria-inactiva'$$,
  '42501', null, 'authenticated sellers cannot write category aliases'
);
select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    select '123e4567-e89b-12d3-a456-426614174000', id, 'es-MX', 'Contexto en hoja'
    from public.categories where slug = 'celulares-y-accesorios'$$,
  '23514',
  'Category suggestions require an active product root category.',
  'category suggestions reject an active product leaf context'
);
select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    values ('123e4567-e89b-12d3-a456-426614174000', 9001, 'es-MX', 'Contexto inactivo')$$,
  '23514',
  'Category suggestions require an active product root category.',
  'category suggestions reject an inactive product root context'
);
select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    values ('123e4567-e89b-12d3-a456-426614174000', 9002, 'es-MX', 'Contexto de servicio')$$,
  '23514',
  'Category suggestions require an active product root category.',
  'category suggestions reject a service root context'
);
select throws_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name)
    values ('123e4567-e89b-12d3-a456-426614174000', 9003, 'es-MX', 'Contexto de restaurante')$$,
  '23514',
  'Category suggestions require an active product root category.',
  'category suggestions reject a restaurant root context'
);
select lives_ok(
  $$insert into public.category_suggestions (seller_id, root_category_id, locale, suggested_name, context)
    select '123e4567-e89b-12d3-a456-426614174000', id, 'es-MX', 'Drones', 'Productos aéreos de consumo.'
    from public.categories where slug = 'electronica'$$,
  'sellers can create their own category suggestions'
);
select results_eq(
  $$select count(*) from public.category_suggestions$$,
  array[1::bigint],
  'sellers can read their own category suggestions'
);

select lives_ok(
  $$insert into public.product_translations (product_id, locale, name, description, source, review_status)
    select id, 'en-US', 'Gaming laptop', 'Powerful portable computer for gaming and work.', 'manual', 'approved'
    from public.products where name = 'Cuaderno técnico'$$,
  'owners can write translations for their products'
);

set local request.jwt.claim.sub = '987fcdeb-51a2-43d7-9012-345678901234';

select results_eq(
  $$select count(*) from public.category_suggestions$$,
  array[0::bigint],
  'category suggestions remain private across sellers'
);
select throws_ok(
  $$insert into public.product_translations (product_id, locale, name, description, source, review_status)
    select id, 'en-US', 'Stolen translation', 'A seller must not translate another seller product.', 'manual', 'approved'
    from public.products where name = 'Funda resistente'$$,
  '42501', null, 'sellers cannot write translations for another seller products'
);

reset role;
insert into public.search_events (
  id,
  normalized_query,
  locale,
  country_code,
  result_count
) values
  ('00000000-0000-4000-8000-000000000001', 'funda', 'es-MX', 'MX', 1),
  ('00000000-0000-4000-8000-000000000002', 'funda', 'es-MX', 'MX', 2);
set local role anon;

select results_eq(
  $$select count(*) from public.product_translations where name = 'Gaming laptop'$$,
  array[1::bigint],
  'anonymous visitors can read approved translations of published products'
);
select results_eq(
  $$select product_id from public.search_product_ids('teléfono', 'es-MX', 'MX', null, null, 20)$$,
  $$select id from public.products where name = 'Funda resistente'$$,
  'Spanish alias search finds the categorized product'
);
select results_eq(
  $$select product_id from public.search_product_ids('Gaming laptop', 'en-US', 'MX', null, null, 20)$$,
  $$select id from public.products where name = 'Cuaderno técnico'$$,
  'English translation search finds the original product'
);
select results_eq(
  $$select product_id from public.search_product_ids('teléfono', 'es-MX', 'US', null, null, 20)$$,
  $$select id from public.products where name = 'Funda internacional'$$,
  'country filtering excludes otherwise matching products'
);
select results_eq(
  $$select product_id from public.search_product_ids('%', 'es-MX', 'MX', null, null, 100)$$,
  $$select id from public.products where false$$,
  'percent signs are searched literally instead of matching the catalog as wildcards'
);
select results_eq(
  $$select product_id from public.search_product_ids('_', 'es-MX', 'MX', null, null, 100)$$,
  $$select id from public.products where false$$,
  'underscores are searched literally instead of matching the catalog as wildcards'
);
select results_eq(
  $$select product_id
    from public.search_product_ids(
      '',
      'es-MX',
      'MX',
      null,
      (select id from public.categories where slug = 'electronica'),
      100
    )
    order by product_id$$,
  $$select id
    from public.products
    where name in ('Funda resistente', 'Cuaderno técnico')
    order by id$$,
  'a selected root category includes products in its leaves'
);
select results_eq(
  $$select product_id
    from public.search_product_ids('', 'es-MX', 'MX', null, null, 100)
    order by product_id$$,
  $$select id
    from public.products
    where name in ('Publicación heredada', 'Funda resistente', 'Cuaderno técnico')
    order by id$$,
  'Todos keeps legacy uncategorized publications visible during migration'
);
select throws_ok(
  $$select * from public.search_events$$,
  '42501', null, 'anonymous visitors cannot read telemetry rows directly'
);
select ok(
  public.record_catalog_search('  Teléfono  ', 'es-MX', 'MX', null, 1) is not null,
  'anonymous visitors can record valid search telemetry through the RPC'
);
select throws_ok(
  $$select public.record_catalog_search('', 'es-MX', 'MX', null, 0)$$,
  '22023',
  'Search query must not be empty.',
  'search telemetry rejects empty queries'
);
select throws_ok(
  $$select public.record_search_selection(
      '00000000-0000-4000-8000-000000000001',
      (select id from public.products where name = 'Funda resistente'),
      2
    )$$,
  '22023',
  'Selected position must not exceed result count.',
  'anonymous selection telemetry rejects positions beyond the recorded result count'
);
select throws_ok(
  $$select public.record_search_selection(
      '00000000-0000-4000-8000-000000000001',
      (select id from public.products where name = 'Funda resistente'),
      0
    )$$,
  '22023',
  'Selected position must be one or greater.',
  'anonymous selection telemetry retains positive-position validation'
);
select throws_ok(
  $$select public.record_search_selection(
      '00000000-0000-4000-8000-000000000001',
      (select id from public.products where name = 'Borrador libre'),
      1
    )$$,
  '22023',
  'Selected product must be published.',
  'anonymous selection telemetry retains published-product validation'
);
select lives_ok(
  $$select public.record_search_selection(
      '00000000-0000-4000-8000-000000000002',
      (select id from public.products where name = 'Funda resistente'),
      2
    )$$,
  'anonymous callers can record a valid result selection once'
);
select throws_ok(
  $$select public.record_search_selection(
      '00000000-0000-4000-8000-000000000002',
      (select id from public.products where name = 'Funda resistente'),
      2
    )$$,
  '22023',
  'Search selection has already been recorded.',
  'selection telemetry is write-once'
);

reset role;
update public.categories
set is_active = false
where slug = 'computacion';
set local role anon;

select results_eq(
  $$select product_id from public.search_product_ids('Cuaderno técnico', 'es-MX', 'MX', null, null, 20)$$,
  $$select id from public.products where name = 'Cuaderno técnico'$$,
  'unfiltered text search keeps a published product discoverable after category deactivation'
);
select results_eq(
  $$select product_id from public.search_product_ids('laptop', 'es-MX', 'MX', null, null, 20)$$,
  $$select id from public.products where false$$,
  'anonymous search does not match an inactive category alias'
);
select results_eq(
  $$select count(*) from public.categories where slug = 'computacion'$$,
  array[0::bigint],
  'anonymous category navigation still hides the deactivated category'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '123e4567-e89b-12d3-a456-426614174000';

select results_eq(
  $$select product_id from public.search_product_ids('laptop', 'es-MX', 'MX', null, null, 20)$$,
  $$select id from public.products where false$$,
  'authenticated search does not match an inactive category alias'
);
select results_eq(
  $$select product_id from public.search_product_ids('Cuaderno técnico', 'es-MX', 'MX', null, null, 20)$$,
  $$select id from public.products where name = 'Cuaderno técnico'$$,
  'authenticated text search keeps the published product discoverable after category deactivation'
);
select throws_ok(
  $$select * from public.search_events$$,
  '42501', null, 'authenticated sellers cannot read telemetry rows directly'
);
select lives_ok(
  $$select public.record_search_selection(
      public.record_catalog_search('teléfono', 'es-MX', 'MX', null, 1),
      (select id from public.products where name = 'Funda resistente'),
      1
    )$$,
  'authenticated callers can record a selected result through the RPC'
);

reset role;
update public.products
set is_admin_enabled = false
where name = 'Funda resistente';

create temp table hidden_search_product as
select id from public.products where name = 'Funda resistente';

grant select on hidden_search_product to anon;

set local role anon;

select throws_ok(
  $$select public.record_search_selection(
      public.record_catalog_search('teléfono', 'es-MX', 'MX', null, 1),
      (select id from hidden_search_product),
      1
    )$$,
  '22023',
  'Selected product must be published.',
  'search telemetry cannot select a hidden product'
);

reset role;

select results_eq(
  $$select normalized_query from public.search_events where selected_position = 1$$,
  array['telefono'::text],
  'telemetry stores a trimmed lowercase accent-normalized query'
);
select results_eq(
  $$select selected_position from public.search_events where selected_position = 1$$,
  array[1],
  'selection telemetry updates the event without exposing the table'
);

do $$
begin
  -- nextval/setval changes survive rollback; restore fresh-reset sequence state for later test files.
  perform setval('public.shops_id_seq', 1, false);
  perform setval('public.products_id_seq', 1, false);
  perform setval('public.categories_id_seq', 57, true);
  perform setval('public.category_suggestions_id_seq', 1, false);
end;
$$;

select * from finish();
rollback;
