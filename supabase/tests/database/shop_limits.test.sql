begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_table('private', 'user_shop_limits',
  'private user shop limit overrides exist');
select has_column('private', 'user_shop_limits', 'user_id',
  'shop limit override belongs to an auth user');
select has_column('private', 'user_shop_limits', 'shop_limit',
  'shop limit override stores allowed shop count');
select has_function('public', 'current_user_shop_limit', array[]::text[],
  'seller can read current shop limit');
select has_function('public', 'set_user_shop_limit', array['uuid', 'integer'],
  'administrator can set a user shop limit');
select has_trigger('public', 'shops', 'enforce_user_shop_limit',
  'shop writes enforce user shop limit');

insert into auth.users (id, email, created_at) values
  ('20000000-0000-4000-8000-000000000001', 'admin-limits@test.local', now()),
  ('20000000-0000-4000-8000-000000000002', 'seller-limits@test.local', now());

insert into private.admin_users (user_id, granted_by) values
  ('20000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(public.current_user_shop_limit(), 1,
  'seller without override receives default limit of one');

insert into public.shops (owner_id, name, slug, description)
values (
  '20000000-0000-4000-8000-000000000002',
  'Primera tienda',
  'primera-tienda-limite',
  'Descripción suficientemente larga para primera tienda.'
);

select is(
  (select count(*)::integer from public.shops
   where owner_id = '20000000-0000-4000-8000-000000000002'),
  1,
  'seller creates first shop'
);

select throws_ok(
  $$insert into public.shops (owner_id, name, slug, description)
    values (
      '20000000-0000-4000-8000-000000000002',
      'Segunda tienda',
      'segunda-tienda-bloqueada',
      'Descripción suficientemente larga para segunda tienda.'
    )$$,
  'P0001',
  'Alcanzaste el límite de tiendas.',
  'default limit blocks second shop'
);

select throws_ok(
  $$select public.set_user_shop_limit(
      '20000000-0000-4000-8000-000000000002', 2)$$,
  '42501',
  'Solo administración puede cambiar límites de tiendas.',
  'non-administrator cannot change shop limits'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.set_user_shop_limit(
    '20000000-0000-4000-8000-000000000002', 2
  ),
  2,
  'administrator raises seller limit'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(public.current_user_shop_limit(), 2,
  'seller sees administrator override');

insert into public.shops (owner_id, name, slug, description)
values (
  '20000000-0000-4000-8000-000000000002',
  'Segunda tienda',
  'segunda-tienda-permitida',
  'Descripción suficientemente larga para segunda tienda.'
);

select is(
  (select count(*)::integer from public.shops
   where owner_id = '20000000-0000-4000-8000-000000000002'),
  2,
  'raised limit permits second shop'
);

select throws_ok(
  $$insert into public.shops (owner_id, name, slug, description)
    values (
      '20000000-0000-4000-8000-000000000002',
      'Tercera tienda',
      'tercera-tienda-bloqueada',
      'Descripción suficientemente larga para tercera tienda.'
    )$$,
  'P0001',
  'Alcanzaste el límite de tiendas.',
  'raised limit blocks next shop'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.set_user_shop_limit(
    '20000000-0000-4000-8000-000000000002', 0
  ),
  0,
  'administrator lowers limit below current count'
);

select is(
  (select count(*)::integer from public.shops
   where owner_id = '20000000-0000-4000-8000-000000000002'),
  2,
  'lowering limit preserves existing shops'
);

set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$insert into public.shops (owner_id, name, slug, description)
    values (
      '20000000-0000-4000-8000-000000000002',
      'Tienda después de bajar límite',
      'tienda-despues-de-bajar-limite',
      'Descripción suficientemente larga para tienda bloqueada.'
    )$$,
  'P0001',
  'Alcanzaste el límite de tiendas.',
  'lowered limit blocks every future shop creation'
);

update public.shops
set description = 'Descripción actualizada sin cambiar propiedad.'
where owner_id = '20000000-0000-4000-8000-000000000002'
  and slug = 'primera-tienda-limite';

select results_eq(
  $$select description from public.shops
    where slug = 'primera-tienda-limite'$$,
  array['Descripción actualizada sin cambiar propiedad.'::text],
  'lowered limit does not block edits to existing shops'
);

set local role postgres;

select results_eq(
  $$select actor_id, target_user_id, action,
           (metadata ->> 'previous_limit')::integer,
           (metadata ->> 'new_limit')::integer
    from private.admin_audit_events
    where action = 'shop_limit_changed'
      and target_user_id = '20000000-0000-4000-8000-000000000002'
    order by id$$,
  $$values
    ('20000000-0000-4000-8000-000000000001'::uuid,
     '20000000-0000-4000-8000-000000000002'::uuid,
     'shop_limit_changed'::text, 1, 2),
    ('20000000-0000-4000-8000-000000000001'::uuid,
     '20000000-0000-4000-8000-000000000002'::uuid,
     'shop_limit_changed'::text, 2, 0)$$,
  'every administrator limit change is audited with old and new values'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select public.set_user_shop_limit(
      '20000000-0000-4000-8000-000000000002', -1)$$,
  '22023',
  'El límite de tiendas debe ser un número entero mayor o igual a cero.',
  'negative shop limit is rejected'
);

set local role postgres;

select is(
  has_function_privilege('anon', 'public.current_user_shop_limit()', 'EXECUTE'),
  false,
  'anonymous role cannot execute current limit RPC'
);
select is(
  has_function_privilege('anon', 'public.set_user_shop_limit(uuid, integer)', 'EXECUTE'),
  false,
  'anonymous role cannot execute admin limit RPC'
);
select is(
  has_table_privilege('authenticated', 'private.user_shop_limits', 'SELECT'),
  false,
  'authenticated role cannot read private overrides directly'
);

select * from finish();
rollback;
