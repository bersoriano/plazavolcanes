begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('public', 'search_catalog_ids',
  array['text','text','text','text','bigint','integer','jsonb'], 'structured search RPC exists');
select has_function('public', 'search_product_ids',
  array['text','text','text','text','bigint','integer'], 'legacy ranked RPC is still callable');

insert into auth.users (id, email, created_at) values
  ('c167f000-0000-4000-8000-000000000001', 'search-contract-a@test.local', now()),
  ('c167f000-0000-4000-8000-000000000002', 'search-contract-b@test.local', now());

update private.founders_program set base_listing_limit = 150, founder_listing_limit = 150;
insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('c167f000-0000-4000-8000-000000000001', 'Catálogo local', 'catalog-search-fixture', 'Tienda local para probar los filtros.', 'MX', array['MX-JAL']),
  ('c167f000-0000-4000-8000-000000000002', 'Tienda en revisión', 'catalog-search-pending', 'Tienda pendiente de aprobación.', 'MX', array['MX-JAL']);
update public.shops set is_publishing_approved = true where slug = 'catalog-search-fixture';

insert into public.categories (listing_type, slug) values ('product', 'catalog-search-root');
insert into public.categories (parent_id, listing_type, slug)
select id, 'product', 'catalog-search-leaf' from public.categories where slug = 'catalog-search-root';

insert into public.products
  (shop_id, category_id, status, image_path, name, description, price_mxn, units_available,
   waterproof, color, material, size, condition, used_condition, currency_code)
select s.id, c.id, 'published', 'tests/search.webp', f.*
from public.shops s cross join public.categories c cross join (values
  ('Jacket',           'Alpine outerwear for cold mornings.', 89.99, 2, true, 'blue', 'cotton', 'M', 'used', 'good', 'MXN'),
  ('Abrigo térmico',   'Confección para una mañana fresca.',  95.00, 1, true, 'red', 'wool', 'S', 'new', null, 'MXN'),
  ('Prenda ligera',    'Esta chaqueta alpine es muy suave.',  99.99, 1, true, 'green', 'polyester', 'L', 'new', null, 'MXN'),
  ('Chamarra de piel', 'Cuero suave de confección local.',   100.00, 0, true, 'black', 'leather', 'L', 'new', null, 'MXN'),
  ('Jacket sin dato',  'Waterproof according to this description.', 70, 1, null, null, null, null, 'new', null, 'MXN'),
  ('Jacket de tela',   'Tela ligera para días soleados.',       70, 1, false, null, null, null, 'new', null, 'MXN'),
  ('Jacket dólares',   'Abrigo en otra moneda de prueba.',      50, 1, true, null, null, null, 'new', null, 'USD'),
  ('Bufanda',          'Bufanda suave para un día fresco.',      45, 1, true, null, null, null, 'new', null, 'MXN'),
  ('Jacket inactiva',  'Prueba de moderación del producto.',    70, 1, true, null, null, null, 'new', null, 'MXN'),
  ('Jacket vencida',   'Prueba de vigencia del producto.',      70, 1, true, null, null, null, 'new', null, 'MXN'),
  ('Jacket borrador',  'Prueba de borrador de publicación.',    70, 1, true, null, null, null, 'new', null, 'MXN'),
  ('Polar alpine jacket', 'Primera secuencia para probar frases.', 120, 1, true, null, null, null, 'new', null, 'MXN'),
  ('Polar winter alpine jacket', 'Segunda secuencia con palabras intermedias.', 125, 1, true, null, null, null, 'new', null, 'MXN')
) f(name, description, price, units, waterproof, color, material, size, condition, grade, currency)
where s.slug = 'catalog-search-fixture' and c.slug = 'catalog-search-leaf';

update public.products set is_admin_enabled = false where name = 'Jacket inactiva';
update public.products set expires_at = now() - interval '1 minute' where name = 'Jacket vencida';
update public.products set status = 'draft' where name = 'Jacket borrador';
insert into public.product_translations (product_id, locale, name, description, review_status)
select id, 'en-US', 'Jacket alpine', 'Translated outerwear for a chilly day.', 'approved'
from public.products where name = 'Abrigo térmico'
union all
select id, 'en-US', 'Jacket scarf', 'Translation still under review by the seller.', 'draft'
from public.products where name = 'Bufanda';

-- More exact-title candidates than the card limit, all above budget.
insert into public.products (shop_id, category_id, status, image_path, name, description, price_mxn, waterproof)
select s.id, c.id, 'published', 'tests/search.webp', 'Jacket', 'Chaqueta por encima del presupuesto.', 999, true
from public.shops s cross join public.categories c cross join generate_series(1, 26)
where s.slug = 'catalog-search-fixture' and c.slug = 'catalog-search-leaf';

insert into public.products (shop_id, category_id, status, image_path, name, description, price_mxn, waterproof)
select s.id, c.id, 'published', 'tests/search.webp', 'Jacket pendiente', 'Prueba de una tienda pendiente.', 60, true
from public.shops s cross join public.categories c
where s.slug = 'catalog-search-pending' and c.slug = 'catalog-search-leaf';

create function pg_temp.search_names(q text, f jsonb, lim integer default 24, area text default 'MX-JAL')
returns setof text language sql stable as $$
  select p.name from public.search_catalog_ids(q, 'en-US', 'MX', area,
    (select id from public.categories where slug = 'catalog-search-root'), lim, f
  ) with ordinality r
  join public.products p on p.id = r.product_id order by r.ordinality
$$;

update public.products set other_features = 'Capucha desmontable; tela impermeable'
where name in ('Jacket de tela', 'Jacket borrador');
update public.products set other_features = 'Bolsillo oculto' where name = 'Abrigo térmico';

set local role anon;
select results_eq($$select p.name from public.search_catalog_ids('chaqueta capucha desmontable', 'es-MX', 'MX', 'MX-JAL',
  null, 24, '{}') r join public.products p on p.id = r.product_id$$,
  array['Jacket de tela'], 'Spanish keywords span title and other features on public listings only');
select results_eq($$select * from pg_temp.search_names('alpine bolsillo', '{}')$$,
  array['Abrigo térmico'], 'keywords can span an approved translation and seller features');
select results_eq($$select * from pg_temp.search_names('capucha', '{"waterproof":true}')$$,
  array[]::text[], 'other features cannot override structured waterproofing');
select results_eq($$select * from pg_temp.search_names('jacket', '{"waterproof":true,"max":100,"maxInclusive":false}')$$,
  array['Jacket','Abrigo térmico','Prenda ligera'],
  'literal title, approved translation, then description-only synonym survive the strict budget and limit');
select results_eq($$select * from pg_temp.search_names('jacket', '{"waterproof":true,"max":100}') order by 1$$,
  $$values ('Abrigo térmico'::text),('Chamarra de piel'),('Jacket'),('Prenda ligera') order by 1$$,
  'up to 100 includes the boundary and ordinary search includes a sold-out jacket');
select results_eq($$select * from pg_temp.search_names('jacket', '{"waterproof":true,"max":100,"inStock":true}')$$,
  array['Jacket','Abrigo térmico','Prenda ligera'], 'in-stock excludes zero units');
select results_eq($$select * from pg_temp.search_names('alpine jacket', '{"max":100,"waterproof":true}') order by 1$$,
  $$values ('Abrigo térmico'::text),('Jacket'),('Prenda ligera') order by 1$$,
  'a synonym group is conjunctive with a second concept');
select results_eq($$select * from pg_temp.search_names('jacket absentword', '{}')$$,
  array[]::text[], 'a jacket alone cannot match a missing second term');
select results_eq($$select p.name from public.search_catalog_ids('chamarra', 'es-MX', 'MX', 'MX-JAL',
  (select id from public.categories where slug = 'catalog-search-root'), 24, '{"waterproof":true,"max":100}') r
  join public.products p on p.id = r.product_id order by p.name$$,
  $$values ('Chamarra de piel'::text),('Jacket'),('Prenda ligera') order by 1$$,
  'Spanish search finds Spanish and English jacket listings without needing translations');
select results_eq($$select product_id from public.search_catalog_ids('jacket', 'en-US', 'MX', 'MX-JAL',
  (select id from public.categories where slug = 'catalog-search-root'), 2, '{"min":999}')$$,
  $$select id from public.products where category_id = (select id from public.categories where slug = 'catalog-search-leaf')
    and name = 'Jacket' and price_mxn = 999 order by id desc limit 2$$,
  'identically ranked rows with the same creation timestamp have stable ID order');
select results_eq($$select * from pg_temp.search_names('"polar alpine"', '{}')$$,
  array['Polar alpine jacket'], 'web-search quotes require contiguous words');
select results_eq($$select * from pg_temp.search_names('polar -winter', '{}')$$,
  array['Polar alpine jacket'], 'web-search exclusions survive');
select results_eq($$select * from pg_temp.search_names('bufanda OR winter', '{}') order by 1$$,
  $$values ('Bufanda'::text), ('Polar winter alpine jacket') order by 1$$, 'web-search explicit alternatives survive');
select results_eq($$select * from pg_temp.search_names('', '{"min":89.99,"max":89.99,"currency":"MXN","color":"blue","size":"M","material":"cotton","grade":"good","inStock":true}')$$,
  array['Jacket'], 'grade implies used and all structured fields work without lexical text');
select results_eq(format('select * from pg_temp.search_names('''', %L::jsonb)', '{"min":89.99,"max":89.99}'::jsonb || mismatch),
  array[]::text[], 'filter-only search rejects mismatching ' || mismatch::text)
from unnest(array['{"color":"red"}','{"size":"L"}','{"material":"leather"}','{"grade":"mint"}','{"condition":"new"}']::jsonb[]) mismatch;
select results_eq($$select * from pg_temp.search_names('', '{"min":89.99,"minInclusive":false,"max":95,"waterproof":true}')$$,
  array['Abrigo térmico'], 'exclusive minimum is applied to the stored decimal price');
select results_eq($$select * from pg_temp.search_names('jacket', '{"waterproof":false,"max":100}')$$,
  array['Jacket de tela'], 'explicit false excludes unknown waterproofing');
select results_eq($$select * from pg_temp.search_names('jacket dólares', '{}')$$,
  array['Jacket dólares'], 'ordinary searches can still match a legacy foreign-currency listing');
select results_eq($$select * from pg_temp.search_names('jacket dólares', '{"currency":"MXN"}')$$,
  array[]::text[], 'currency can also be required explicitly without a budget');
select results_eq($$select * from pg_temp.search_names('jacket', '{}', 24, 'MX-VER')$$,
  array[]::text[], 'the area applies to the shop before the result limit');
select results_eq($$select product_id from public.search_catalog_ids('', 'en-US', 'US', null,
  (select id from public.categories where slug = 'catalog-search-root'), 24, '{}')$$,
  array[]::bigint[], 'the country applies even for filter-only browsing');
select results_eq($$select * from pg_temp.search_names('jacket', '{"color":"red","condition":"used"}')$$,
  array[]::text[], 'incompatible inventory is never broadened');
select lives_ok($$select * from pg_temp.search_names(repeat('a',500), '{}')$$, 'up to 500 characters are accepted');
select throws_ok($$select * from pg_temp.search_names(repeat('a',501), '{}')$$,
  '22023', null, 'over-limit lexical text is rejected');
select throws_ok(format('select * from pg_temp.search_names('''', %L::jsonb)', invalid),
  '22023', null, 'invalid RPC filter rejected: ' || invalid)
from unnest(array['null','[]','{"extra":1}','{"grade":"good","condition":"new"}','{"grade":"fine"}',
  '{"color":["red"]}','{"color":"purple"}','{"size":"m"}','{"material":"linen"}','{"currency":"USD"}',
  '{"waterproof":"true"}','{"inStock":null}','{"min":-1}','{"min":10000000000}','{"min":"50"}',
  '{"max":25.019}','{"maxInclusive":false}','{"min":100,"max":90}',
  '{"min":100,"max":100,"minInclusive":false}', '{"min":1,"max":1.01,"minInclusive":false,"maxInclusive":false}',
  '{"max":0,"maxInclusive":false}']) invalid;
select throws_ok(format('select * from public.search_catalog_ids('''', %L, %L, %L, %L, %L, %L)',
  locale, market, area, category_id, lim, filters), '22023', null, label)
from (values ('en', 'MX', null, null::bigint, 24, '{}', 'unknown locale'),
  ('en-US', null, null, null, 24, '{}', 'missing market'),
  ('en-US', 'mx', null, null, 24, '{}', 'malformed market'),
  ('en-US', 'US', 'MX-JAL', null, 24, '{}', 'area and market conflict'),
  ('en-US', 'MX', 'MX-UNK', null, 24, '{}', 'unknown area'),
  ('en-US', 'MX', null, 0, 24, '{}', 'invalid category ID'),
  ('en-US', 'MX', null, null, 101, '{}', 'unbounded limit'),
  ('en-US', 'MX', null, null, 24, null, 'missing filter object')) bad(locale,market,area,category_id,lim,filters,label);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'c167f000-0000-4000-8000-000000000001';
select results_eq($$select * from pg_temp.search_names('jacket', '{"waterproof":true,"max":100,"maxInclusive":false}')$$,
  array['Jacket','Abrigo térmico','Prenda ligera'], 'signed-in owners see only publicly eligible results and translations');
select results_eq($$update public.products set waterproof = false where name = 'Jacket pendiente' returning id$$,
  array[]::bigint[], 'a seller cannot change another shop’s attributes');
select throws_ok($$update public.products set color = 'orange' where name = 'Jacket borrador'$$, '23514', null,
  'database rejects unsupported colors on seller edits');
select throws_ok($$update public.products set size = 'XXXL' where name = 'Jacket borrador'$$, '23514', null,
  'database rejects unsupported sizes');
select throws_ok($$update public.products set material = 'cashmere' where name = 'Jacket borrador'$$, '23514', null,
  'database rejects unsupported materials');
select results_eq($$update public.products set color = 'black', size = 'XS', material = 'wool', waterproof = null
  where name = 'Jacket borrador' returning color$$,
  array['black'], 'seller can update controlled attributes on a draft and clear a declaration');
reset role;

select * from finish();
rollback;
