begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, created_at) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'entregas@test.local', now());

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (910, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Casa Entregas', 'casa-entregas',
  'Tienda para probar la política de entregas.');

select is(
  (select delivery_policy from public.shops where id = 910),
  null,
  'a shop that predates the field starts with no delivery policy'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select lives_ok(
  $$update public.shops set delivery_policy = 'Entrego en persona los sábados.' where id = 910$$,
  'the first delivery policy a shop writes is never held back'
);

select isnt(
  (select delivery_policy_updated_at from public.shops where id = 910),
  null,
  'writing a policy stamps the clock the monthly limit reads'
);

select throws_ok(
  $$update public.shops set delivery_policy = 'Ahora entrego los martes.' where id = 910$$,
  'P0001',
  'Puedes actualizar la política de entregas una vez al mes.',
  'a second change inside the month is refused'
);

-- The rest of the shop stays freely editable: the clock guards one column.
select lives_ok(
  $$update public.shops set name = 'Casa Entregas y Envíos' where id = 910$$,
  'an ordinary shop edit is untouched while the policy is locked'
);

-- Only the trigger writes the timestamp, so a seller cannot buy themselves an
-- early turn by sending an older one — neither alongside a change...
select throws_ok(
  $$update public.shops
      set delivery_policy = 'Intento adelantado.',
          delivery_policy_updated_at = now() - interval '90 days'
    where id = 910$$,
  'P0001',
  'Puedes actualizar la política de entregas una vez al mes.',
  'a forged timestamp does not unlock the field'
);

-- ...nor on its own, ahead of a change sent a moment later.
update public.shops
  set delivery_policy_updated_at = now() - interval '90 days'
  where id = 910;

select ok(
  (select delivery_policy_updated_at from public.shops where id = 910) > now() - interval '1 hour',
  'an update that leaves the policy alone cannot move its clock'
);

-- Only a maintainer reaching past the trigger can age the clock, which is what
-- the passage of a month looks like to this test.
reset role;
alter table public.shops disable trigger shops_delivery_policy_cadence;
update public.shops
  set delivery_policy_updated_at = now() - interval '31 days'
  where id = 910;
alter table public.shops enable trigger shops_delivery_policy_cadence;

set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select lives_ok(
  $$update public.shops set delivery_policy = 'Ahora entrego los martes.' where id = 910$$,
  'the field opens again once a month has passed'
);

select * from finish();

rollback;
