begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'admin@test.local', now());

insert into private.admin_users (user_id, granted_by)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');

insert into public.user_display_names (user_id, display_name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ana Ruiz');

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba',
  'Descripción completa para probar la consulta de administración.');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

insert into public.messages (conversation_id, sender_id, body, idempotency_key)
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Nunca llegó', gen_random_uuid());

set local role authenticated;
set local request.jwt.claims = '{"sub": "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "role": "authenticated"}';

select is_empty(
  $$select 1 from public.messages$$,
  'an administrator can no longer read messages straight through row level security'
);

select results_eq(
  $$select body from public.read_conversation_as_admin(900, 'Disputa 12: el comprador dice que no llegó')$$,
  array['Nunca llegó'::text],
  'an administrator reads the conversation through the audited path'
);

select results_eq(
  $$select sender_label from public.read_conversation_as_admin(900, 'Disputa 12, segunda lectura')$$,
  array['Ana Ruiz'::text],
  'messages are attributed to a person, not to a bare identifier'
);

select is(
  (select count(*) from public.admin_read_events where conversation_id = 900)::integer,
  2,
  'every read is recorded, including a repeat'
);

select throws_ok(
  $$select public.read_conversation_as_admin(900, '')$$,
  '22023',
  null,
  'a read without a reason is refused'
);

set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select throws_ok(
  $$select public.read_conversation_as_admin(900, 'curiosidad')$$,
  '42501',
  null,
  'a participant cannot use the administrator path'
);

select isnt_empty(
  $$select 1 from public.messages where conversation_id = 900$$,
  'a participant still reads their own conversation normally'
);

select * from finish();

rollback;
