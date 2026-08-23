begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba',
  'Descripción completa para probar la caducidad de conversaciones.');

insert into public.orders (id, buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days, handling_time_zone)
overriding system value
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 900, gen_random_uuid(), 'MXN', 100, 1, 'America/Mexico_City');

-- Creating the order also creates its own conversation, through the trigger in
-- the fulfillment migration.
insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

insert into public.messages (id, conversation_id, sender_id, body, idempotency_key)
overriding system value
values (9001, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Viejo', gen_random_uuid());

insert into public.conversation_reads (conversation_id, user_id, last_read_message_id)
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 9001);

-- Ageing happens last: sending a message bumps updated_at to the moment it was
-- sent, so a thread aged before its messages exist would look busy again.
update public.conversations set updated_at = now() - interval '200 days' where id = 900;
update public.conversations set updated_at = now() - interval '400 days' where type = 'order';

select lives_ok(
  $$select private.purge_idle_pre_sale_conversations()$$,
  'the purge runs even with read rows and messages referencing the conversation'
);

select is_empty(
  $$select 1 from public.conversations where id = 900$$,
  'an idle pre-sale conversation is purged'
);

select is_empty(
  $$select 1 from public.messages where conversation_id = 900$$,
  'its messages go with it'
);

select isnt_empty(
  $$select 1 from public.conversations where type = 'order'$$,
  'an order conversation is kept however old it is, because disputes depend on it'
);

select lives_ok(
  $$select private.run_messaging_maintenance()$$,
  'the scheduled job runs both the purge and the counter pruning'
);

select is(
  (select count(*) from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages')::integer,
  1,
  'messages are published for realtime delivery'
);

select * from finish();

rollback;
