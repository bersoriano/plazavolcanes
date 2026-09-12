begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select has_column('public', 'shops', 'is_premium',
  'shop records whether administration distinguished it');
select has_column('public', 'shops', 'premium_granted_at',
  'shop records when the distinction was granted');
select has_column('public', 'shops', 'premium_granted_by',
  'shop records which administrator granted the distinction');
select has_function('public', 'set_shop_premium', array['bigint', 'boolean'],
  'administrator can set a shop premium status');

insert into auth.users (id, email, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'admin-premium@test.local', now()),
  ('30000000-0000-4000-8000-000000000002', 'seller-premium@test.local', now());

insert into private.admin_users (user_id, granted_by) values
  ('30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001');

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

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$update public.shops set is_premium = true where id = 9101$$,
  '42501',
  'Los campos de confianza y publicación son administrados por el sistema.',
  'seller cannot award itself the premium distinction'
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

select isnt(
  (select premium_granted_at from public.shops where id = 9101),
  null,
  'granting stamps the moment of the decision'
);

select is(
  (select premium_granted_by from public.shops where id = 9101),
  '30000000-0000-4000-8000-000000000001'::uuid,
  'granting records the administrator who decided'
);

select is(
  (select shop_is_premium
   from public.list_admin_marketplace_users()
   where shop_id = 9101
   limit 1),
  true,
  'administration screen reads the current premium status'
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

select is(
  (select premium_granted_at from public.shops where id = 9101),
  null,
  'withdrawal clears the grant timestamp'
);

select is(
  (select premium_granted_by from public.shops where id = 9101),
  null,
  'withdrawal clears the granting administrator'
);

select * from finish();

rollback;
