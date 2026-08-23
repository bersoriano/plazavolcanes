begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

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
  $$select counterpart_label from public.list_conversations('seller') order by conversation_id$$,
  array['Ana Ruiz'::text, 'Comprador #EEEE'::text],
  'a seller sees a display name, or a handle for whoever has not set one'
);

select results_eq(
  $$select last_message_body from public.list_conversations('seller') where conversation_id = 901$$,
  array[null::text],
  'a thread nobody has written in yet has no message to preview'
);

select throws_ok(
  $$select public.list_conversations('admin')$$,
  '22023',
  null,
  'an unknown role is refused'
);

select * from finish();

rollback;
