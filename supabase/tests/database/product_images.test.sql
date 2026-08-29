begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_table('public', 'product_images', 'product images table exists');

insert into auth.users (id, email, created_at) values
  ('11112222-1111-4111-8111-111122223333', 'gallery-owner@test.local', now()),
  ('22223333-2222-4222-8222-222233334444', 'gallery-stranger@test.local', now());

insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('11112222-1111-4111-8111-111122223333', 'Galería', 'galeria', 'Descripción completa de la tienda con galería.', 'MX', array['MX-JAL']);

update public.shops
set is_publishing_approved = true
where slug = 'galeria';

insert into public.products (shop_id, name, description, price_mxn, status, category_id, image_path) values
  ((select id from public.shops where slug='galeria'), 'Con imagen previa', 'Descripción completa del producto con imagen.', 100, 'published', (select id from public.categories where slug='celulares-y-accesorios'), 'owner/products/vieja.jpg'),
  ((select id from public.shops where slug='galeria'), 'Borrador con galería', 'Descripción completa del borrador con galería.', 200, 'draft', null, null);

insert into public.product_images (product_id, storage_path, position) values
  ((select id from public.products where name='Con imagen previa'), 'owner/products/publicada.jpg', 0);

select results_eq(
  $$select image_path from public.products where name='Con imagen previa'$$,
  array['owner/products/publicada.jpg'::text],
  'adding a gallery image sets the product cover'
);

insert into public.product_images (product_id, storage_path, position) values
  ((select id from public.products where name='Borrador con galería'), 'owner/products/b.jpg', 1),
  ((select id from public.products where name='Borrador con galería'), 'owner/products/a.jpg', 0);

select results_eq(
  $$select image_path from public.products where name='Borrador con galería'$$,
  array['owner/products/a.jpg'::text],
  'the lowest position becomes the product cover'
);

select throws_ok(
  $$insert into public.product_images (product_id, storage_path, position) values ((select id from public.products where name='Borrador con galería'), 'owner/products/c.jpg', 5)$$,
  '23514',
  null,
  'a gallery holds at most five positions'
);

select throws_ok(
  $$insert into public.product_images (product_id, storage_path, position) values ((select id from public.products where name='Borrador con galería'), 'owner/products/d.jpg', 0)$$,
  '23505',
  null,
  'two images cannot claim the same position'
);

delete from public.product_images
where product_id = (select id from public.products where name='Borrador con galería') and position = 0;

select results_eq(
  $$select image_path from public.products where name='Borrador con galería'$$,
  array['owner/products/b.jpg'::text],
  'removing the cover promotes the next image'
);

set local role anon;

select results_eq(
  $$select count(*) from public.product_images$$,
  array[1::bigint],
  'anonymous visitors see gallery images of published products only'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "22223333-2222-4222-8222-222233334444", "role": "authenticated"}';

select results_eq(
  $$select count(*) from public.product_images$$,
  array[1::bigint],
  'a stranger cannot see images belonging to somebody else''s draft'
);

select throws_ok(
  $$insert into public.product_images (product_id, storage_path, position) values ((select id from public.products where name='Con imagen previa'), 'stranger/products/x.jpg', 3)$$,
  '42501',
  null,
  'a stranger cannot add images to a product they do not own'
);

reset role;
update public.products
set is_admin_enabled = false
where name = 'Con imagen previa';

set local role anon;

select results_eq(
  $$select count(*) from public.product_images where storage_path = 'owner/products/publicada.jpg'$$,
  array[0::bigint],
  'product images leave the public catalogue when the product visibility gate closes'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11112222-1111-4111-8111-111122223333", "role": "authenticated"}';

select results_eq(
  $$select count(*) from public.product_images where storage_path = 'owner/products/publicada.jpg'$$,
  array[1::bigint],
  'the owner retains gallery access after the parent product becomes hidden'
);

select * from finish();
rollback;
