begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, created_at) values
  ('60000000-0000-4000-8000-000000000001', 'owner-import@test.local', now()),
  ('60000000-0000-4000-8000-000000000002', 'other-import@test.local', now()),
  ('60000000-0000-4000-8000-000000000003', 'admin-import@test.local', now());

insert into private.admin_users (user_id, granted_by)
values ('60000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000003');

insert into public.shops (id, owner_id, name, slug, description)
overriding system value values
  (9501, '60000000-0000-4000-8000-000000000001', 'Importa', 'tienda-importa', 'Descripción suficientemente larga para la tienda.');

set local role authenticated;
set local request.jwt.claims = '{"sub": "60000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select ok(
  public.request_listing_import(9501, array['https://articulo.mercadolibre.com.mx/MLM-1', ' https://www.facebook.com/marketplace/item/2 ', '']) > 0,
  'an owner can ask for their listings to be brought over'
);
select is(
  (select link_count from public.shop_import_requests(9501) limit 1),
  2,
  'blank lines are dropped and links trimmed'
);
select throws_ok(
  $$select public.request_listing_import(9501, array['mercadolibre.com.mx/MLM-1'])$$,
  '22023', null, 'every line must be a link'
);
select throws_ok(
  $$select public.request_listing_import(9501, array[]::text[])$$,
  '22023', null, 'an empty request is refused'
);
select public.request_listing_import(9501, array['https://a.example/1']);
select public.request_listing_import(9501, array['https://a.example/2']);
select throws_ok(
  $$select public.request_listing_import(9501, array['https://a.example/3'])$$,
  'P0001', null, 'at most 3 requests wait at once'
);
select throws_ok(
  'select * from public.admin_import_requests()',
  '42501', null, 'a seller cannot read the queue'
);

set local request.jwt.claims = '{"sub": "60000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$select public.request_listing_import(9501, array['https://a.example/4'])$$,
  '42501', null, 'nobody else can ask on the shop''s behalf'
);
select throws_ok('select * from public.shop_import_requests(9501)', '42501', null, 'nor read its requests');

set local request.jwt.claims = '{"sub": "60000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select is((select count(*)::integer from public.admin_import_requests() where status = 'pending'), 3, 'administration sees the queue');
select public.complete_import_request((select min(id) from public.admin_import_requests()));
select is((select count(*)::integer from public.admin_import_requests() where status = 'done'), 1, 'and closes a request');

reset role;
select * from finish();
rollback;
