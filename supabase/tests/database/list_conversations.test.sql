begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'nameless@test.local', now());

insert into public.user_display_names (user_id, display_name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ana Ruiz');

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba',
  'Descripción completa para probar la bandeja de entrada.');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values
  (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale'),
  (901, 900, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'pre_sale');

-- An order with two lines, the second of which outlived its listing. The order
-- opens its own conversation through the trigger on orders.
insert into public.products (id, shop_id, name, description, price_mxn, status, image_path, units_available, category_id)
overriding system value
values
  (900, 900, 'Reloj de cuerda', 'Descripción completa del reloj de cuerda de la prueba.', 1200, 'draft', 'tienda/reloj.jpg', 2,
    (select id from public.categories where slug = 'celulares-y-accesorios'));

insert into public.orders (id, buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, fulfillment_method)
overriding system value
values
  (900, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 900, gen_random_uuid(), 'MXN', 1450, 1, 'America/Mexico_City', 'shipping'),
  (901, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 900, gen_random_uuid(), 'MXN', 250, 1, 'America/Mexico_City', 'shipping');

insert into public.order_items (id, order_id, product_id, product_name, unit_price, currency_code, quantity, line_total, handling_days)
overriding system value
values
  (9001, 900, 900, 'Reloj de cuerda', 1200, 'MXN', 1, 1200, 1),
  (9002, 900, null, 'Taza retirada', 250, 'MXN', 1, 250, 1),
  (9003, 901, null, 'Taza retirada', 250, 'MXN', 1, 250, 1);

create temp table order_threads as
select order_id, id from public.conversations where order_id in (900, 901);

grant select on order_threads to authenticated;

insert into public.messages (id, conversation_id, sender_id, body, idempotency_key)
overriding system value
values
  (9001, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Hola', gen_random_uuid()),
  (9002, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sigo aquí', gen_random_uuid());

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq(
  $$select counterpart_label from public.list_conversations('buyer')$$,
  array['Tienda Prueba'::text],
  'a buyer sees the shop name'
);

select results_eq(
  $$select last_message_body from public.list_conversations('buyer')$$,
  array['Sigo aquí'::text],
  'the newest message is the one shown'
);

select results_eq(
  $$select unread_count from public.list_conversations('buyer')$$,
  array[2],
  'unread counts arrive with the row'
);

select is_empty(
  $$select 1 from public.list_conversations('seller')$$,
  'a buyer asking for seller threads gets none'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';

select results_eq(
  $$select counterpart_label from public.list_conversations('seller')
    where conversation_id in (900, 901) order by conversation_id$$,
  array['Ana Ruiz'::text, 'Comprador #EEEE'::text],
  'a seller sees a display name, or a handle for whoever has not set one'
);

select results_eq(
  $$select last_message_body from public.list_conversations('seller') where conversation_id = 901$$,
  array[null::text],
  'a thread nobody has written in yet has no message to preview'
);

select results_eq(
  $$select order_item_name, order_item_image_path, order_item_count
    from public.list_conversations('seller')
    where conversation_id = (select id from order_threads where order_id = 900)$$,
  $$values ('Reloj de cuerda'::text, 'tienda/reloj.jpg'::text, 2)$$,
  'an order thread carries its first line, that product''s cover and the line count'
);

select results_eq(
  $$select order_item_name, order_item_image_path, order_item_count
    from public.list_conversations('seller')
    where conversation_id = (select id from order_threads where order_id = 901)$$,
  $$values ('Taza retirada'::text, null::text, 1)$$,
  'a line whose listing is gone keeps its recorded name and has no cover'
);

select results_eq(
  $$select order_item_name, order_item_image_path, order_item_count
    from public.list_conversations('seller')
    where conversation_id = 900$$,
  $$values (null::text, null::text, null::integer)$$,
  'a conversation that is not about an order carries no order line'
);

select results_eq(
  $$select count(*)::integer from public.list_conversations('seller')$$,
  array[4],
  'an order with several lines is still one row'
);

set local request.jwt.claims = '{"sub": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "role": "authenticated"}';

select results_eq(
  $$select order_item_name from public.list_conversations('buyer')
    where conversation_id = (select id from order_threads where order_id = 900)$$,
  array['Reloj de cuerda'::text],
  'the buyer sees the same first line'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.list_conversations('admin')$$,
  '22023',
  null,
  'an unknown role is refused'
);

select * from finish();

rollback;
