begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_function('private', 'bootstrap_initial_admin', array[]::text[],
  'operator-only bootstrap helper exists');
select has_function('public', 'list_admin_marketplace_users', array[]::text[],
  'administrator marketplace RPC exists');
select is(
  (select p.proargnames::text
   from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'list_admin_marketplace_users'),
  '{user_id,email,user_created_at,display_name,shop_id,shop_name,shop_slug,shop_created_at,product_id,product_name,product_slug,product_status,product_created_at,product_updated_at}',
  'RPC exposes exactly the approved 14 fields in order'
);

select is(private.bootstrap_initial_admin(), false,
  'missing bootstrap account is reported without granting membership');

insert into auth.users (id, email, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'bsorianodev@gmail.com', '2026-08-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'seller@test.local', '2026-08-02T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'empty@test.local', '2026-08-03T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', 'member@test.local', '2026-08-04T00:00:00Z');

insert into public.user_display_names (user_id, display_name)
values ('10000000-0000-4000-8000-000000000002', 'María Taller');

select ok(private.bootstrap_initial_admin(), 'existing bootstrap account is granted');
select results_eq(
  $$select user_id, granted_by from private.admin_users
    where user_id = '10000000-0000-4000-8000-000000000001'$$,
  $$values ('10000000-0000-4000-8000-000000000001'::uuid,
            '10000000-0000-4000-8000-000000000001'::uuid)$$,
  'bootstrap stores the target as both member and grantor'
);
select results_eq(
  $$select actor_id, target_user_id, action from private.admin_audit_events
    where target_user_id = '10000000-0000-4000-8000-000000000001'
    order by id$$,
  $$values ('10000000-0000-4000-8000-000000000001'::uuid,
            '10000000-0000-4000-8000-000000000001'::uuid,
            'admin_granted'::text)$$,
  'bootstrap audits admin_granted for the same target'
);
select is(
  (select count(*) from private.admin_users
   where user_id <> '10000000-0000-4000-8000-000000000001')::integer,
  0,
  'bootstrap does not grant another account'
);

insert into public.shops (id, owner_id, name, slug, description, created_at)
overriding system value
values
  (9101, '10000000-0000-4000-8000-000000000002', 'Taller Volcán', 'taller-volcan',
   'Taller de prueba con productos en distintos estados.', '2026-08-05T00:00:00Z'),
  (9102, '10000000-0000-4000-8000-000000000004', 'Tienda Vacía', 'tienda-vacia',
   'Tienda de prueba sin productos visibles para administración.', '2026-08-06T00:00:00Z');

-- The marketplace test isolates its read-model fixtures from the separate
-- publication-category invariant; it intentionally includes all statuses.
alter table public.products disable trigger products_require_publishable_category;

insert into public.products
  (id, shop_id, name, slug, description, price_mxn, status, created_at, updated_at)
overriding system value
values
  (9201, 9101, 'Borrador visible', 'borrador-visible',
   'Descripción suficientemente larga para producto de prueba.', 100, 'draft',
   '2026-08-07T00:00:00Z', '2026-08-08T00:00:00Z'),
  (9202, 9101, 'Publicado visible', 'publicado-visible',
   'Descripción suficientemente larga para producto de prueba.', 200, 'published',
   '2026-08-09T00:00:00Z', '2026-08-10T00:00:00Z'),
  (9203, 9101, 'Vencido oculto', 'vencido-oculto',
   'Descripción suficientemente larga para producto de prueba.', 300, 'expired',
   '2026-08-11T00:00:00Z', '2026-08-12T00:00:00Z'),
  (9204, 9101, 'Eliminado oculto', 'eliminado-oculto',
   'Descripción suficientemente larga para producto de prueba.', 400, 'deleted',
   '2026-08-13T00:00:00Z', '2026-08-14T00:00:00Z');
alter table public.products enable trigger products_require_publishable_category;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select * from public.list_admin_marketplace_users()$$,
  '42501', null, 'non-administrator cannot read account marketplace data'
);

set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$select distinct email from public.list_admin_marketplace_users() order by email$$,
  $$values ('bsorianodev@gmail.com'::text), ('empty@test.local'::text),
           ('member@test.local'::text), ('seller@test.local'::text)$$,
  'administrator sees every signed-up user'
);
select results_eq(
  $$select display_name from public.list_admin_marketplace_users()
    where email = 'seller@test.local' limit 1$$,
  array['María Taller'::text], 'display name is returned when present'
);
select isnt_empty(
  $$select 1 from public.list_admin_marketplace_users()
    where email = 'empty@test.local' and shop_id is null$$,
  'user without a shop remains present'
);
select isnt_empty(
  $$select 1 from public.list_admin_marketplace_users()
    where shop_id = 9102 and product_id is null$$,
  'shop without included products remains present'
);
select results_eq(
  $$select product_status from public.list_admin_marketplace_users()
    where shop_id = 9101 order by product_created_at$$,
  $$values ('draft'::text), ('published'::text)$$,
  'draft and published products are returned'
);
select is_empty(
  $$select 1 from public.list_admin_marketplace_users() where product_id in (9203, 9204)$$,
  'expired and deleted products are excluded'
);
select results_eq(
  $$select email from public.list_admin_marketplace_users()
    group by user_id, email, user_created_at order by user_created_at desc, user_id$$,
  $$values ('member@test.local'::text), ('empty@test.local'::text),
           ('seller@test.local'::text), ('bsorianodev@gmail.com'::text)$$,
  'users return newest first with stable ordering'
);

set local role postgres;
select is(
  has_function_privilege('anon', 'public.list_admin_marketplace_users()', 'EXECUTE'),
  false, 'anonymous role cannot execute RPC'
);
select is(
  has_function_privilege('authenticated', 'private.bootstrap_initial_admin()', 'EXECUTE'),
  false, 'browser roles cannot invoke bootstrap helper'
);

select * from finish();
rollback;
