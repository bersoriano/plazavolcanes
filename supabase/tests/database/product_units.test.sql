begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_column('public', 'products', 'units_available', 'products state how many units are available');

insert into auth.users (id, email, created_at) values
  ('dddd4444-dddd-4ddd-8ddd-dddd44444444', 'units-seller@test.local', now()),
  ('eeee5555-eeee-4eee-8eee-eeee55555555', 'units-buyer@test.local', now());

insert into public.shops (owner_id, name, slug, description, country_code, administrative_area_codes) values
  ('dddd4444-dddd-4ddd-8ddd-dddd44444444', 'Unidades', 'unidades', 'Descripción completa de la tienda de unidades.', 'MX', array['MX-JAL']);

update public.shops set is_publishing_approved = true where slug = 'unidades';

insert into public.products (shop_id, name, description, price_mxn, status, category_id, units_available) values
  ((select id from public.shops where slug='unidades'), 'Taza limitada', 'Descripción completa de la taza limitada.', 100, 'published', (select id from public.categories where slug='celulares-y-accesorios'), 3);

insert into public.products (shop_id, name, description, price_mxn, status) values
  ((select id from public.shops where slug='unidades'), 'Sin unidades declaradas', 'Descripción completa del producto sin unidades.', 100, 'draft');

select results_eq(
  $$select units_available from public.products where name = 'Sin unidades declaradas'$$,
  array[1::smallint],
  'a listing covers a single unit unless the seller says otherwise'
);

select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status, units_available) values ((select id from public.shops where slug='unidades'), 'Demasiadas', 'Descripción completa del producto con exceso.', 100, 'draft', 11)$$,
  '23514',
  null,
  'a listing may not claim more than ten units'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "eeee5555-eeee-4eee-8eee-eeee55555555", "role": "authenticated"}';

select throws_ok(
  $$select public.add_cart_item((select id from public.products where slug='taza-limitada'), 4)$$,
  '22023',
  'Solo hay 3 unidades disponibles.',
  'a buyer cannot add more units than the listing covers'
);

select lives_ok(
  $$select public.add_cart_item((select id from public.products where slug='taza-limitada'), 3)$$,
  'a buyer may add exactly the available units'
);

select lives_ok(
  $$select public.add_cart_item((select id from public.products where slug='taza-limitada'), 3)$$,
  'adding a second time is allowed'
);

select results_eq(
  $$select quantity from public.cart_items ci join public.carts c on c.id = ci.cart_id where c.buyer_id = 'eeee5555-eeee-4eee-8eee-eeee55555555'$$,
  array[3],
  'adding again does not accumulate past the available units'
);

select throws_ok(
  $$select public.set_cart_item_quantity((select ci.id from public.cart_items ci join public.carts c on c.id = ci.cart_id where c.buyer_id = 'eeee5555-eeee-4eee-8eee-eeee55555555'), 5)$$,
  '22023',
  'Solo hay 3 unidades disponibles.',
  'a buyer cannot raise a cart line past the available units'
);

select * from finish();
rollback;
