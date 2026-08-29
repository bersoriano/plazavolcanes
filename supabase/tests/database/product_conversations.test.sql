begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'other-buyer@test.local', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'other-seller@test.local', now());

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values
  (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba',
    'Descripción completa para probar conversaciones por producto.'),
  (901, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Otra Tienda', 'otra-tienda',
    'Descripción completa de la tienda que no participa en la conversación.');

update public.shops
set is_publishing_approved = true
where id in (900, 901);

insert into public.products (id, shop_id, name, description, price_mxn, status, image_path, units_available, category_id)
overriding system value
values
  (800, 900, 'Taza de barro', 'Descripción completa de la taza de barro artesanal.', 250, 'published', 'tienda/taza.jpg', 3,
    (select id from public.categories where slug = 'celulares-y-accesorios')),
  (801, 900, 'Plato de barro', 'Descripción completa del plato de barro artesanal.', 400, 'published', null, 2,
    (select id from public.categories where slug = 'celulares-y-accesorios')),
  (802, 901, 'Jarra ajena', 'Descripción completa de la jarra de la otra tienda.', 150, 'published', null, 1,
    (select id from public.categories where slug = 'celulares-y-accesorios')),
  (803, 900, 'Borrador privado', 'Descripción completa del borrador que nadie puede ver.', 90, 'draft', null, 1, null);

-- A pre-sale thread from before product context existed. It must survive the
-- migration as that shop's general enquiry, untouched.
insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'pre_sale');

-- An order carries its own conversation, opened by the trigger on orders.
insert into public.orders (id, buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone, fulfillment_method)
overriding system value
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 900, gen_random_uuid(), 'MXN', 250, 1, 'America/Mexico_City', 'shipping');

create temp table order_thread as
select id from public.conversations where order_id = 900;

grant select on order_thread to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Two product pages and the shop's own page. Opening the threads is a statement of
-- its own: a call that inserts cannot see its own row from inside the same query.
select public.start_pre_sale_conversation(900, 800);
select public.start_pre_sale_conversation(900, 801);
select public.start_pre_sale_conversation(900);

select results_eq(
  $$select type, product_id from public.conversations
    where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and shop_id = 900 and product_id is not null
    order by product_id$$,
  $$values ('pre_sale'::text, 800::bigint), ('pre_sale'::text, 801::bigint)$$,
  'a thread opened from a product page carries that product'
);

select is(
  public.start_pre_sale_conversation(900, 800),
  public.start_pre_sale_conversation(900, 800),
  'contacting the same product again reopens the thread that exists'
);

select isnt(
  public.start_pre_sale_conversation(900, 801),
  public.start_pre_sale_conversation(900, 800),
  'a second product from the same shop gets its own thread'
);

select isnt(
  public.start_pre_sale_conversation(900),
  public.start_pre_sale_conversation(900, 800),
  'the general enquiry never merges with a product thread'
);

select is(
  public.start_pre_sale_conversation(900),
  (select id from public.conversations
   where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and shop_id = 900 and type = 'pre_sale' and product_id is null),
  'the shop page reopens the thread that carries no product association'
);

select is(
  public.start_pre_sale_conversation(900),
  public.start_pre_sale_conversation(900),
  'a second general enquiry reopens the only one there is'
);

select is(
  (select count(*)::integer from public.conversations
   where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and type = 'pre_sale'),
  3,
  'two product threads and one general enquiry, and nothing collapsed'
);

-- The order conversation is none of those.
select isnt(
  public.start_pre_sale_conversation(900, 800),
  (select id from order_thread),
  'an order thread is never returned as a pre-sale thread'
);

select is(
  (select product_id from public.conversations where id = (select id from order_thread)),
  null::bigint,
  'an order thread carries no product even when the order holds one'
);

-- A mismatched shop and product is refused, and so is a listing nobody can reach.
select throws_ok(
  $$select public.start_pre_sale_conversation(900, 802)$$,
  'P0002',
  'Producto no encontrado.',
  'a product belonging to another shop is rejected'
);

select throws_ok(
  $$select public.start_pre_sale_conversation(900, 803)$$,
  'P0002',
  'Producto no encontrado.',
  'a draft nobody can reach is refused the same way a missing product is'
);

reset role;

create temp table buyer_threads as
select
  (select id from public.conversations
   where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and product_id = 800) as taza,
  (select id from public.conversations
   where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and product_id = 801) as plato,
  (select id from public.conversations
   where buyer_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and type = 'pre_sale' and product_id is null) as general;

grant select on buyer_threads to authenticated;

select is(
  (select coalesce(sum(conversations_opened), 0) from private.message_rate_limits
   where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3::bigint,
  'each genuinely new thread spends quota and every reopening spends none'
);

-- The seller answers on the product thread, so the inbox has something to count.
insert into public.messages (conversation_id, sender_id, body, idempotency_key)
values
  ((select taza from buyer_threads), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sí, sigue disponible', gen_random_uuid()),
  ((select taza from buyer_threads), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '¿Te la aparto?', gen_random_uuid());

-- The pre-sale thread that predates product context still answers the shop-only call.
set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select is(
  public.start_pre_sale_conversation(900),
  900::bigint,
  'a conversation from before product context reopens as the general enquiry'
);

select isnt(
  public.start_pre_sale_conversation(900, 800),
  (select taza from buyer_threads),
  'each buyer gets their own thread for the same product'
);

select is_empty(
  $$select 1 from public.conversations where id = (select taza from buyer_threads)$$,
  'a buyer cannot read another buyer''s conversation'
);

-- A seller reaches only their own shop's threads.
set local request.jwt.claims = '{"sub": "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "role": "authenticated"}';

select is_empty(
  $$select 1 from public.conversations where id = (select taza from buyer_threads)$$,
  'a seller cannot read another shop''s conversation'
);

select throws_ok(
  $$select public.start_pre_sale_conversation(901)$$,
  'P0001',
  'No puedes abrir una conversación contigo.',
  'a seller cannot message their own shop'
);

-- The inbox carries current product data rather than a copy taken at creation.
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq(
  $$select product_id, product_name, product_price, product_currency_code, product_image_path, product_status
    from public.list_conversations('buyer')
    where product_id = 800$$,
  $$values (800::bigint, 'Taza de barro'::text, 250.00::numeric, 'MXN'::text, 'tienda/taza.jpg'::text, 'published'::text)$$,
  'a product thread arrives with the product as it stands now'
);

select results_eq(
  $$select unread_count, last_message_body from public.list_conversations('buyer')
    where product_id = 800$$,
  $$values (2, '¿Te la aparto?'::text)$$,
  'the product row carries its unread count and its newest message'
);

select results_eq(
  $$select product_id, product_slug is not null, product_units_available
    from public.list_conversations('buyer')
    where product_id = 801$$,
  $$values (801::bigint, true, 2)$$,
  'the slug and the units on hand travel with the row'
);

select results_eq(
  $$select product_id from public.list_conversations('buyer')
    where conversation_id = (select general from buyer_threads)$$,
  array[null::bigint],
  'a general enquiry reports no product'
);

reset role;
update public.products set price_mxn = 275 where id = 800;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq(
  $$select product_price from public.list_conversations('buyer') where product_id = 800$$,
  array[275.00::numeric],
  'a price change shows up without rewriting the conversation'
);

-- A listing that leaves the plaza keeps its conversation and its context.
reset role;
update public.products set status = 'deleted' where id = 800;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq(
  $$select product_status, product_name from public.list_conversations('buyer') where product_id = 800$$,
  $$values ('deleted'::text, 'Taza de barro'::text)$$,
  'a removed listing still names itself in the inbox'
);

select is(
  (select count(*)::integer from public.list_conversations('buyer')),
  4,
  'no conversation disappears when a listing does'
);

reset role;
update public.products
set is_admin_enabled = false
where id = 801;

set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select throws_ok(
  $$select public.start_pre_sale_conversation(900, 801)$$,
  'P0002',
  'Producto no encontrado.',
  'a hidden product cannot start a new pre-sale conversation'
);

set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq(
  $$select product_status, product_name from public.list_conversations('buyer') where product_id = 800$$,
  $$values ('deleted'::text, 'Taza de barro'::text)$$,
  'historical product conversations stay readable after catalogue visibility ends'
);

-- Uniqueness and integrity are the database's job, not the function's.
reset role;

select throws_ok(
  $$delete from public.products where id = 800$$,
  '23503',
  null,
  'a product a conversation points at cannot be deleted'
);

select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, type, product_id)
    values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale', 800)$$,
  '23505',
  null,
  'a duplicate product thread is refused'
);

select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, type)
    values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale')$$,
  '23505',
  null,
  'a duplicate general thread is refused'
);

select throws_ok(
  $$insert into public.conversations (shop_id, buyer_id, type, product_id)
    values (901, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale', 800)$$,
  '23503',
  null,
  'a thread may not pair a shop with a product that is not its own'
);

select throws_ok(
  $$update public.conversations set product_id = 801 where id = (select id from order_thread)$$,
  '23514',
  null,
  'an order thread may not become a product enquiry'
);

select * from finish();

rollback;
