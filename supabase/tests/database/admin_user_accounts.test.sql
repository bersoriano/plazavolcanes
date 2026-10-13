begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

-- Publishing needs a gallery cover (20260916090000_require_product_cover_to_publish).
-- These fixtures are not about media, so every listing gets one unless it says
-- otherwise. The default is rolled back with the rest of the test.
alter table public.products alter column image_path set default 'tests/cover.webp';

select has_function('public', 'set_user_disabled', array['uuid', 'boolean'],
  'account disabling RPC exists');
select has_function('public', 'admin_delete_user', array['uuid'],
  'account deletion RPC exists');
select is(
  has_function_privilege('anon', 'public.set_user_disabled(uuid, boolean)', 'EXECUTE'),
  false, 'anonymous role cannot execute the disabling RPC'
);
select is(
  has_function_privilege('anon', 'public.admin_delete_user(uuid)', 'EXECUTE'),
  false, 'anonymous role cannot execute the deletion RPC'
);

insert into auth.users (id, email, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'admin-accounts@test.local', now()),
  ('30000000-0000-4000-8000-000000000002', 'other-admin-accounts@test.local', now()),
  ('30000000-0000-4000-8000-000000000003', 'clean-seller@test.local', now()),
  ('30000000-0000-4000-8000-000000000004', 'buyer-with-order@test.local', now()),
  ('30000000-0000-4000-8000-000000000005', 'seller-with-order@test.local', now());

insert into private.admin_users (user_id, granted_by) values
  ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001');

insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', now(), now()),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', now(), now()),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004', now(), now());

insert into public.shops (id, owner_id, name, slug, description, image_path)
overriding system value
values
  (9301, '30000000-0000-4000-8000-000000000003', 'Tienda Limpia', 'tienda-limpia',
   'Tienda de prueba sin historial de pedidos.',
   'shops/30000000-0000-4000-8000-000000000003/logo.webp'),
  (9302, '30000000-0000-4000-8000-000000000005', 'Tienda Con Pedido', 'tienda-con-pedido',
   'Tienda de prueba con un pedido registrado.', null);

insert into public.products
  (id, shop_id, name, slug, description, price_mxn, status)
overriding system value
values
  (9401, 9301, 'Producto publicado', 'producto-publicado',
   'Descripción suficientemente larga para producto de prueba.', 100, 'draft'),
  (9402, 9301, 'Producto borrador', 'producto-borrador',
   'Descripción suficientemente larga para producto de prueba.', 200, 'draft');

insert into public.product_images (product_id, storage_path, position) values
  (9401, 'products/30000000-0000-4000-8000-000000000003/9401/a.webp', 0);

insert into storage.objects (bucket_id, name, owner_id) values
  ('catalogo', 'products/30000000-0000-4000-8000-000000000003/9401/a.webp',
   '30000000-0000-4000-8000-000000000003');

update public.products
  set status = 'published',
      category_id = (select id from public.categories where slug = 'celulares-y-accesorios')
  where id = 9401;

insert into public.orders (
  buyer_id, shop_id, status, idempotency_key, currency_code, subtotal,
  handling_days, handling_time_zone, fulfillment_method
) values (
  '30000000-0000-4000-8000-000000000004', 9302, 'completed', gen_random_uuid(),
  'MXN', 100, 1, 'America/Mexico_City', 'shipping'
);

-- An administrator approves the clean seller's shop, which opens the listing's
-- expiry window. Disabling the account must close it again.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select * from public.set_shop_publishing_approval(9301, true)$$,
  'fixture shop is approved before the account is disabled'
);

-- Audit assertions below are scoped to this test's administrator: the events
-- of accounts that were deleted outside it stay in the table by design.
-- Authorization
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}';

select throws_ok(
  $$select * from public.set_user_disabled('30000000-0000-4000-8000-000000000003', true)$$,
  '42501', 'Solo administración puede deshabilitar cuentas.',
  'non-administrator cannot disable an account'
);
select throws_ok(
  $$select * from public.admin_delete_user('30000000-0000-4000-8000-000000000003')$$,
  '42501', 'Solo administración puede eliminar cuentas.',
  'non-administrator cannot delete an account'
);

-- Storage refuses direct deletes unless the session says it means it; the
-- flag lets these statements reach the row-level policies under test.
set local "storage.allow_delete_query" = 'true';
delete from storage.objects
where bucket_id = 'catalogo'
  and name = 'products/30000000-0000-4000-8000-000000000003/9401/a.webp';

set local role postgres;
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'catalogo'
     and name = 'products/30000000-0000-4000-8000-000000000003/9401/a.webp'),
  1,
  'a person who is neither owner nor administrator cannot remove a catalog image'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select * from public.set_user_disabled('30000000-0000-4000-8000-000000000001', true)$$,
  '22023', 'No puedes deshabilitar tu propia cuenta.',
  'administrator cannot disable their own account'
);
select throws_ok(
  $$select * from public.admin_delete_user('30000000-0000-4000-8000-000000000001')$$,
  '22023', 'No puedes eliminar tu propia cuenta.',
  'administrator cannot delete their own account'
);
select throws_ok(
  $$select * from public.set_user_disabled('30000000-0000-4000-8000-000000000002', true)$$,
  '22023', 'No puedes deshabilitar la cuenta de otra persona administradora.',
  'administrator cannot disable another administrator'
);
select throws_ok(
  $$select * from public.admin_delete_user('30000000-0000-4000-8000-000000000002')$$,
  '22023', 'No puedes eliminar la cuenta de otra persona administradora.',
  'administrator cannot delete another administrator'
);
select throws_ok(
  $$select * from public.set_user_disabled('30000000-0000-4000-8000-0000000000ff', true)$$,
  'P0002', 'No encontramos ese usuario.',
  'disabling an unknown account reports it missing'
);
select throws_ok(
  $$select * from public.admin_delete_user('30000000-0000-4000-8000-0000000000ff')$$,
  'P0002', 'No encontramos ese usuario.',
  'deleting an unknown account reports it missing'
);

-- Read model before any change
select results_eq(
  $$select distinct user_is_disabled, user_is_admin
    from public.list_admin_marketplace_users()
    where email = 'clean-seller@test.local'$$,
  $$values (false, false)$$,
  'an ordinary account is listed as enabled and not an administrator'
);
select results_eq(
  $$select distinct user_is_admin from public.list_admin_marketplace_users()
    where email = 'other-admin-accounts@test.local'$$,
  array[true],
  'an administrator account is listed as such'
);

-- Disable
select results_eq(
  $$select user_id, is_disabled, shop_slugs, product_slugs
    from public.set_user_disabled('30000000-0000-4000-8000-000000000003', true)$$,
  $$values ('30000000-0000-4000-8000-000000000003'::uuid, true,
            array['tienda-limpia'], array['producto-publicado'])$$,
  'disabling returns the shops and published listings that left the catalog'
);
select results_eq(
  $$select distinct user_is_disabled from public.list_admin_marketplace_users()
    where email = 'clean-seller@test.local'$$,
  array[true],
  'a disabled account is listed as disabled'
);

set local role postgres;
select ok(
  (select banned_until > now() + interval '50 years' from auth.users
   where id = '30000000-0000-4000-8000-000000000003'),
  'disabling bans the account far into the future'
);
select is(
  (select count(*)::integer from auth.sessions
   where user_id = '30000000-0000-4000-8000-000000000003'),
  0, 'disabling ends every session of the account'
);
select is(
  (select count(*)::integer from auth.sessions
   where user_id = '30000000-0000-4000-8000-000000000004'),
  1, 'disabling leaves other accounts signed in'
);
select is(
  (select is_publishing_approved from public.shops where id = 9301),
  false, 'disabling withdraws publishing approval from the account''s shops'
);
select results_eq(
  $$select status, expires_at is null from public.products where id = 9401$$,
  $$values ('published'::text, true)$$,
  'disabling keeps the seller''s publication decision but closes its window'
);
select results_eq(
  $$select actor_id, target_user_id, metadata -> 'shop_ids'
    from private.admin_audit_events where action = 'user_disabled'
      and actor_id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('30000000-0000-4000-8000-000000000001'::uuid,
            '30000000-0000-4000-8000-000000000003'::uuid, '[9301]'::jsonb)$$,
  'disabling is audited with the affected shops'
);

set local role authenticated;
select results_eq(
  $$select is_disabled, shop_slugs, product_slugs
    from public.set_user_disabled('30000000-0000-4000-8000-000000000003', true)$$,
  $$values (true, '{}'::text[], '{}'::text[])$$,
  'disabling an already disabled account changes no shop'
);

set local role postgres;
select is(
  (select count(*)::integer from private.admin_audit_events
   where action = 'user_disabled'
     and actor_id = '30000000-0000-4000-8000-000000000001'),
  1, 'repeating a disable writes no second audit event'
);

-- Enable
set local role authenticated;
select results_eq(
  $$select user_id, is_disabled, shop_slugs, product_slugs
    from public.set_user_disabled('30000000-0000-4000-8000-000000000003', false)$$,
  $$values ('30000000-0000-4000-8000-000000000003'::uuid, false,
            '{}'::text[], '{}'::text[])$$,
  'enabling reports the account as enabled'
);
select lives_ok(
  $$select * from public.set_user_disabled('30000000-0000-4000-8000-000000000003', false)$$,
  'enabling an already enabled account is not an error'
);

set local role postgres;
select is(
  (select banned_until from auth.users
   where id = '30000000-0000-4000-8000-000000000003'),
  null, 'enabling lifts the ban'
);
select is(
  (select is_publishing_approved from public.shops where id = 9301),
  false, 'enabling leaves shops pending for a fresh approval'
);
select results_eq(
  $$select actor_id, target_user_id
    from private.admin_audit_events where action = 'user_enabled'
      and actor_id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('30000000-0000-4000-8000-000000000001'::uuid,
            '30000000-0000-4000-8000-000000000003'::uuid)$$,
  'enabling is audited once'
);

-- Delete is refused while someone else's history depends on the account
set local role authenticated;
select throws_ok(
  $$select * from public.admin_delete_user('30000000-0000-4000-8000-000000000004')$$,
  '23503',
  'Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla.',
  'an account that bought something cannot be deleted'
);
select throws_ok(
  $$select * from public.admin_delete_user('30000000-0000-4000-8000-000000000005')$$,
  '23503',
  'Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla.',
  'an account whose shop sold something cannot be deleted'
);

set local role postgres;
select is(
  (select count(*)::integer from auth.users
   where id in ('30000000-0000-4000-8000-000000000004',
                '30000000-0000-4000-8000-000000000005')),
  2, 'a refused deletion leaves the accounts in place'
);
select is(
  (select count(*)::integer from public.shops where id = 9302),
  1, 'a refused deletion leaves the shop in place'
);
select is(
  (select count(*)::integer from private.admin_audit_events
   where action = 'user_deleted'
     and actor_id = '30000000-0000-4000-8000-000000000001'),
  0, 'a refused deletion is not audited as a deletion'
);

-- Delete
set local role authenticated;
create temporary table deleted_account on commit drop as
  select * from public.admin_delete_user('30000000-0000-4000-8000-000000000003');
grant select on deleted_account to postgres;

select results_eq(
  $$select user_id, shop_slugs, product_slugs from deleted_account$$,
  $$values ('30000000-0000-4000-8000-000000000003'::uuid,
            array['tienda-limpia'], array['producto-publicado'])$$,
  'deleting returns the shops and published listings that left the catalog'
);
select ok(
  (select image_keys @> array[
     'shops/30000000-0000-4000-8000-000000000003/logo.webp',
     'products/30000000-0000-4000-8000-000000000003/9401/a.webp',
     'tests/cover.webp'
   ] from deleted_account),
  'deleting returns the shop picture, covers, and gallery keys to clean up'
);
select is(
  (select cardinality(image_keys) from deleted_account),
  (select count(distinct key)::integer from unnest(
     (select image_keys from deleted_account)) as key),
  'image keys are returned once each'
);

delete from storage.objects
where bucket_id = 'catalogo'
  and name = 'products/30000000-0000-4000-8000-000000000003/9401/a.webp';

set local role postgres;
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'catalogo'
     and name = 'products/30000000-0000-4000-8000-000000000003/9401/a.webp'),
  0,
  'an administrator can remove a deleted account''s catalog image'
);
select is(
  (select count(*)::integer from auth.users
   where id = '30000000-0000-4000-8000-000000000003'),
  0, 'deleting removes the account'
);
select is(
  (select count(*)::integer from public.shops where id = 9301),
  0, 'deleting removes the account''s shops'
);
select is(
  (select count(*)::integer from public.products where id in (9401, 9402)),
  0, 'deleting removes the account''s listings'
);
select is(
  (select count(*)::integer from public.product_images where product_id = 9401),
  0, 'deleting removes the listings'' gallery rows'
);
select results_eq(
  $$select actor_id, target_user_id, metadata ->> 'user_id', metadata ->> 'email',
           (metadata ->> 'shop_count')::integer
    from private.admin_audit_events where action = 'user_deleted'
      and actor_id = '30000000-0000-4000-8000-000000000001'$$,
  $$values ('30000000-0000-4000-8000-000000000001'::uuid, null::uuid,
            '30000000-0000-4000-8000-000000000003', 'clean-seller@test.local', 1)$$,
  'deleting is audited with a snapshot of the removed account'
);

select * from finish();

rollback;
