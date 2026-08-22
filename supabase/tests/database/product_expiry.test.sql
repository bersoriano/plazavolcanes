begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_column('public', 'products', 'expires_at', 'products carry an expiry');

insert into auth.users (id, email, created_at) values
  ('cafe1111-cafe-4afe-8afe-cafe11111111', 'expiry-seller@test.local', now()),
  ('cafe2222-cafe-4afe-8afe-cafe22222222', 'expiry-buyer@test.local', now());

insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('cafe1111-cafe-4afe-8afe-cafe11111111', 'Caduca', 'caduca', 'Descripción completa de la tienda que caduca.', 'MX', array['MX-JAL']);

insert into public.products (shop_id, name, description, price_mxn, status, category_id) values
  ((select id from public.shops where slug='caduca'), 'Borrador quieto', 'Descripción completa del borrador quieto.', 100, 'draft', null),
  ((select id from public.shops where slug='caduca'), 'Publicado fresco', 'Descripción completa del producto fresco.', 200, 'published', (select id from public.categories where slug='celulares-y-accesorios'));

select is(
  (select expires_at from public.products where name = 'Borrador quieto'),
  null,
  'a draft never carries an expiry'
);

select ok(
  (select expires_at from public.products where name = 'Publicado fresco') between now() + interval '29 days' and now() + interval '31 days',
  'publishing starts a thirty day window'
);

-- Age the listing past its window.
update public.products set expires_at = now() - interval '1 hour' where name = 'Publicado fresco';

select results_eq(
  $$select private.expire_due_products()$$,
  array[1],
  'the scheduled sweep expires listings whose window has closed'
);

select results_eq(
  $$select status from public.products where name = 'Publicado fresco'$$,
  array['expired'::text],
  'the listing is now expired'
);

select results_eq(
  $$select private.expire_due_products()$$,
  array[0],
  'a second sweep has nothing left to do'
);

set local role anon;

select results_eq(
  $$select count(*) from public.products where name = 'Publicado fresco'$$,
  array[0::bigint],
  'an expired listing leaves the public catalogue'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "cafe2222-cafe-4afe-8afe-cafe22222222", "role": "authenticated"}';

select throws_ok(
  $$select public.add_cart_item((select id from public.products where slug = 'publicado-fresco'), 1)$$,
  'P0002',
  'Producto no disponible.',
  'an expired listing cannot be added to a cart'
);

set local role postgres;

-- Bringing it back gives a fresh window.
update public.products set status = 'published' where name = 'Publicado fresco';

select ok(
  (select expires_at from public.products where name = 'Publicado fresco') between now() + interval '29 days' and now() + interval '31 days',
  'reactivating a listing starts a new window'
);

-- Editing a live listing must not extend it.
update public.products set expires_at = now() + interval '2 days' where name = 'Publicado fresco';
update public.products set price_mxn = 250 where name = 'Publicado fresco';

select ok(
  (select expires_at from public.products where name = 'Publicado fresco') < now() + interval '3 days',
  'editing a live listing leaves its window alone'
);

select results_eq(
  $$select count(*) from cron.job where jobname = 'plaza-expire-listings'$$,
  array[1::bigint],
  'the sweep is scheduled'
);

select * from finish();
rollback;
