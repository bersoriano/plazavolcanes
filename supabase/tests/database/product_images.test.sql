begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_table('public', 'product_images', 'product images table exists');

insert into auth.users (id, email, created_at) values
  ('11112222-1111-4111-8111-111122223333', 'gallery-owner@test.local', now()),
  ('22223333-2222-4222-8222-222233334444', 'gallery-stranger@test.local', now()),
  ('33334444-3333-4333-8333-333344445555', 'gallery-admin@test.local', now());

insert into private.admin_users (user_id, granted_by)
values (
  '33334444-3333-4333-8333-333344445555',
  '33334444-3333-4333-8333-333344445555'
);

insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('11112222-1111-4111-8111-111122223333', 'Galería', 'galeria', 'Descripción completa de la tienda con galería.', 'MX', array['MX-JAL']);

update public.shops
set is_publishing_approved = true,
    image_path = 'owner/shops/galeria.jpg'
where slug = 'galeria';

insert into public.products (shop_id, name, description, price_mxn, status, category_id, image_path) values
  ((select id from public.shops where slug='galeria'), 'Con imagen previa', 'Descripción completa del producto con imagen.', 100, 'published', (select id from public.categories where slug='celulares-y-accesorios'), 'owner/products/vieja.jpg'),
  ((select id from public.shops where slug='galeria'), 'Borrador con galería', 'Descripción completa del borrador con galería.', 200, 'draft', null, null);

insert into public.product_images (product_id, storage_path, position) values
  ((select id from public.products where name='Con imagen previa'), 'owner/products/publicada.jpg', 0);

insert into storage.objects (bucket_id, name, owner_id) values
  ('catalogo', 'owner/shops/galeria.jpg', '11112222-1111-4111-8111-111122223333'),
  ('catalogo', 'owner/products/publicada.jpg', '11112222-1111-4111-8111-111122223333'),
  ('catalogo', 'owner/products/a.jpg', '11112222-1111-4111-8111-111122223333'),
  ('catalogo', 'owner/products/b.jpg', '11112222-1111-4111-8111-111122223333');

select is(
  (select public from storage.buckets where id = 'catalogo'),
  true,
  'catalog bucket is public'
);

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
set local "storage.operation" = 'storage.object.get_authenticated';

select results_eq(
  $$select count(*) from public.product_images$$,
  array[1::bigint],
  'anonymous visitors see gallery images of published products only'
);

select results_eq(
  $$select name from storage.objects where bucket_id = 'catalogo' order by name$$,
  $$values ('owner/products/a.jpg'::text), ('owner/products/b.jpg'::text), ('owner/products/publicada.jpg'::text), ('owner/shops/galeria.jpg'::text)$$,
  'a public bucket serves every catalog object to anonymous visitors'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "22223333-2222-4222-8222-222233334444", "role": "authenticated"}';
set local "storage.operation" = 'storage.object.get_authenticated';

select results_eq(
  $$select count(*) from public.product_images$$,
  array[1::bigint],
  'a stranger cannot see images belonging to somebody else''s draft'
);

select results_eq(
  $$select name from storage.objects where bucket_id = 'catalogo' order by name$$,
  $$values ('owner/products/a.jpg'::text), ('owner/products/b.jpg'::text), ('owner/products/publicada.jpg'::text), ('owner/shops/galeria.jpg'::text)$$,
  'object reads no longer depend on who is asking'
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
set local "storage.operation" = 'storage.object.get_authenticated';

select results_eq(
  $$select count(*) from public.product_images where storage_path = 'owner/products/publicada.jpg'$$,
  array[0::bigint],
  'product images leave the public catalogue when the product visibility gate closes'
);

select results_eq(
  $$select name from storage.objects where bucket_id = 'catalogo' order by name$$,
  $$values ('owner/products/a.jpg'::text), ('owner/products/b.jpg'::text), ('owner/products/publicada.jpg'::text), ('owner/shops/galeria.jpg'::text)$$,
  'closing product visibility hides the row, not the object'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11112222-1111-4111-8111-111122223333", "role": "authenticated"}';
set local "storage.operation" = 'storage.object.get_authenticated';

select results_eq(
  $$select count(*) from public.product_images where storage_path = 'owner/products/publicada.jpg'$$,
  array[1::bigint],
  'the owner retains gallery access after the parent product becomes hidden'
);

select results_eq(
  $$select name from storage.objects where bucket_id = 'catalogo' order by name$$,
  $$values ('owner/products/a.jpg'::text), ('owner/products/b.jpg'::text), ('owner/products/publicada.jpg'::text), ('owner/shops/galeria.jpg'::text)$$,
  'the owner reads every object belonging to the shop'
);

set local request.jwt.claims = '{"sub": "33334444-3333-4333-8333-333344445555", "role": "authenticated"}';

select results_eq(
  $$select name from storage.objects where bucket_id = 'catalogo' order by name$$,
  $$values ('owner/products/a.jpg'::text), ('owner/products/b.jpg'::text), ('owner/products/publicada.jpg'::text), ('owner/shops/galeria.jpg'::text)$$,
  'an administrator reads hidden product objects for moderation'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11112222-1111-4111-8111-111122223333", "role": "authenticated"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('catalogo', 'products/11112222-1111-4111-8111-111122223333/1/nueva.jpg', '11112222-1111-4111-8111-111122223333')$$,
  'an owner writes an object under the product key layout'
);

set local request.jwt.claims = '{"sub": "22223333-2222-4222-8222-222233334444", "role": "authenticated"}';

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('catalogo', 'products/11112222-1111-4111-8111-111122223333/1/ajena.jpg', '22223333-2222-4222-8222-222233334444')$$,
  '42501',
  null,
  'a stranger cannot write under somebody else''s product folder'
);

select * from finish();
rollback;
