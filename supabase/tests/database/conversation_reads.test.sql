begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_table('public', 'conversation_reads', 'read tracking table exists');

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'stranger@test.local', now());

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba',
  'Descripción completa para probar el seguimiento de lectura.');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

insert into public.messages (id, conversation_id, sender_id, body, idempotency_key)
overriding system value
values
  (9001, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Hola', gen_random_uuid()),
  (9002, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sigo aquí', gen_random_uuid()),
  (9003, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Gracias', gen_random_uuid());

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(public.unread_message_count(), 2, 'with no read row every message from the other party is unread');

select lives_ok(
  $$select public.mark_conversation_read(900, 9001)$$,
  'a participant may mark their own read position'
);

select is(public.unread_message_count(), 1, 'marking read clears the messages up to that point');

select lives_ok(
  $$select public.mark_conversation_read(900, 9001)$$,
  'an out of order call is accepted'
);

select is(
  (select last_read_message_id from public.conversation_reads
   where conversation_id = 900 and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  9001::bigint,
  'a repeated older position never regresses the stored one'
);

set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select throws_ok(
  $$select public.mark_conversation_read(900, 9001)$$,
  '42501',
  null,
  'a stranger cannot mark a conversation read'
);

select * from finish();

rollback;
