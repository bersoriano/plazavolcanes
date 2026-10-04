begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- The seller actions renew a listing by changing its status, never its date:
-- these are the database rules that path depends on.

insert into auth.users (id, email, created_at) values
  ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', 'renewal-seller@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code)
overriding system value
values (960, 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', 'Tienda Renueva', 'tienda-renueva',
  'Descripción completa de la tienda para probar renovaciones.', 'MX');
update public.shops set is_publishing_approved = true where id = 960;

insert into public.products (id, shop_id, name, description, price_mxn, status, units_available, category_id, image_path)
overriding system value
values
  (860, 960, 'Vencido', 'Descripción completa del producto vencido.', 100, 'published', 1,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'f1/vencido.webp'),
  (861, 960, 'Lapsado', 'Descripción completa del producto lapsado.', 100, 'published', 1,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'f1/lapsado.webp'),
  (862, 960, 'Sin portada', 'Descripción completa del producto sin portada.', 100, 'published', 1,
    (select id from public.categories where slug = 'celulares-y-accesorios'), 'f1/temporal.webp');

update public.products set status = 'expired', expires_at = now() - interval '2 days' where id = 860;
update public.products set expires_at = now() - interval '1 hour' where id in (861, 862);
update public.products set image_path = null where id = 862;

select set_config('request.jwt.claims', '{"sub":"f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$update public.products set status = 'published', expires_at = null where id = 860$$,
  '42501',
  'La moderación y vigencia del producto son administradas por el sistema.',
  'a seller cannot write a listing''s date'
);

select lives_ok(
  $$update public.products set status = 'published' where id = 860$$,
  'a seller brings an expired listing back by its status alone'
);

select ok(
  (select expires_at > now() + interval '29 days' from public.products where id = 860),
  'bringing it back grants a fresh 30 days'
);

select lives_ok(
  $$update public.products set status = 'expired' where id = 861;
    update public.products set status = 'published' where id = 861$$,
  'a lapsed listing still marked published is filed as expired, then published'
);

select ok(
  (select status = 'published' and expires_at > now() + interval '29 days' from public.products where id = 861),
  'and comes back with a fresh 30 days'
);

update public.products set status = 'expired' where id = 862;
select throws_ok(
  $$update public.products set status = 'published' where id = 862$$,
  'P0001',
  'Agrega una imagen de portada antes de publicar.',
  'a lapsed listing without a cover cannot be renewed'
);

select * from finish();
rollback;
