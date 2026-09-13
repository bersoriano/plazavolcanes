begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_column('public', 'shops', 'is_premium',
  'shop records whether administration distinguished it');
-- public.shops is readable by anyone; the grant's provenance must not be.
select hasnt_column('public', 'shops', 'premium_granted_at',
  'the public shops table does not expose when the distinction was granted');
select hasnt_column('public', 'shops', 'premium_granted_by',
  'the public shops table does not expose which administrator granted it');
select has_table('private', 'shop_premium_grants',
  'grant provenance lives in a private table');
select has_function('public', 'set_shop_premium', array['bigint', 'boolean'],
  'administrator can set a shop premium status');

insert into auth.users (id, email, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'admin-premium@test.local', now()),
  ('30000000-0000-4000-8000-000000000002', 'seller-premium@test.local', now()),
  ('30000000-0000-4000-8000-000000000003', 'seller-premium-insert@test.local', now()),
  ('30000000-0000-4000-8000-000000000004', 'admin-premium-second@test.local', now());

insert into private.admin_users (user_id, granted_by) values
  ('30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000004',
   '30000000-0000-4000-8000-000000000001');

-- Room for a second shop, so the seller's upsert below reaches its conflict
-- clause instead of stopping at the shop limit.
insert into private.user_shop_limits (user_id, shop_limit) values
  ('30000000-0000-4000-8000-000000000002', 2);

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (
  9101,
  '30000000-0000-4000-8000-000000000002',
  'Casa Premium',
  'casa-premium',
  'Descripción suficientemente larga para la tienda distinguida.'
);

insert into public.products (
  id, shop_id, name, slug, description, price_mxn, status, is_admin_enabled, category_id
)
overriding system value
values (
  9201,
  9101,
  'Jarra de barro',
  'jarra-de-barro-premium',
  'Pieza descrita con suficiente detalle para la prueba.',
  700,
  'published',
  true,
  (select id from public.categories where slug = 'celulares-y-accesorios')
);

set local role anon;

select throws_ok(
  $$select * from private.shop_premium_grants$$,
  '42501', null,
  'anonymous visitors cannot read who granted the distinction'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select * from private.shop_premium_grants$$,
  '42501', null,
  'signed-in users cannot read who granted the distinction'
);

select throws_ok(
  $$update public.shops set is_premium = true where id = 9101$$,
  '42501',
  'Los campos de confianza y publicación son administrados por el sistema.',
  'seller cannot award itself the premium distinction'
);

select throws_ok(
  $$insert into public.shops (id, owner_id, name, slug, description)
    overriding system value
    values (
      9101,
      '30000000-0000-4000-8000-000000000002',
      'Casa Premium',
      'casa-premium',
      'Descripción suficientemente larga para la tienda distinguida.'
    )
    on conflict (id) do update set is_premium = true$$,
  '42501',
  'Los campos de confianza y publicación son administrados por el sistema.',
  'seller cannot award itself the premium distinction through an upsert'
);

select throws_ok(
  $$select public.set_shop_premium(9101, true)$$,
  '42501',
  'Solo administración puede cambiar la distinción Premium.',
  'non-administrator cannot grant the premium distinction'
);

set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select shop_slug from public.set_shop_premium(9101, true)),
  'casa-premium',
  'grant returns the shop slug for revalidation'
);

select is(
  (select product_slugs from public.set_shop_premium(9101, true)),
  array['jarra-de-barro-premium']::text[],
  'grant returns published product slugs for revalidation'
);

select is(
  (select is_premium from public.shops where id = 9101),
  true,
  'administrator grants the premium distinction'
);

reset role;

select results_eq(
  $$select granted_by, granted_at is not null
    from private.shop_premium_grants where shop_id = 9101$$,
  $$values ('30000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'granting records the administrator who decided and when'
);

-- now() is fixed for the whole transaction, so move the original grant into
-- the past to tell a preserved row from a re-stamped one.
update private.shop_premium_grants
set granted_at = '2026-01-01 00:00:00+00'
where shop_id = 9101;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}';

do $$ begin perform public.set_shop_premium(9101, true); end $$;

reset role;

select results_eq(
  $$select granted_at, granted_by
    from private.shop_premium_grants where shop_id = 9101$$,
  $$values ('2026-01-01 00:00:00+00'::timestamptz,
            '30000000-0000-4000-8000-000000000001'::uuid)$$,
  're-granting a premium shop keeps the original grant'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select shop_is_premium
   from public.list_admin_marketplace_users()
   where shop_id = 9101
   limit 1),
  true,
  'administration screen reads the current premium status'
);

select throws_ok(
  $$select public.set_shop_premium(999999, true)$$,
  'P0002',
  'Tienda no encontrada.',
  'granting a missing shop reports it'
);

select lives_ok(
  $$select public.set_shop_premium(9101, false)$$,
  'administrator withdraws the premium distinction'
);

select is(
  (select is_premium from public.shops where id = 9101),
  false,
  'withdrawal clears the premium flag'
);

reset role;

select is(
  (select count(*)::integer from private.shop_premium_grants where shop_id = 9101),
  0,
  'withdrawal removes the grant record'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}';

do $$ begin perform public.set_shop_premium(9101, true); end $$;

reset role;

select is(
  (select granted_by from private.shop_premium_grants where shop_id = 9101),
  '30000000-0000-4000-8000-000000000004'::uuid,
  'a grant after withdrawal is a new decision with its own grantor'
);

-- RLS lets a seller insert their own shop row with any column values; a
-- dedicated before-insert trigger must scrub the flag the same way the update
-- guard blocks a later write, or a seller could self-grant on arrival.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}';

insert into public.shops (id, owner_id, name, slug, description, is_premium)
overriding system value
values (
  9102,
  '30000000-0000-4000-8000-000000000003',
  'Tienda Autopremium',
  'tienda-autopremium-test',
  'Descripción suficientemente larga para la tienda de la prueba de autopremium.',
  true
);

select is(
  (select is_premium from public.shops where id = 9102),
  false,
  'seller cannot self-grant the premium distinction via insert'
);

reset role;

select is(
  (select count(*)::integer from private.shop_premium_grants where shop_id = 9102),
  0,
  'a seller-created shop carries no grant record'
);

select * from finish();

rollback;
