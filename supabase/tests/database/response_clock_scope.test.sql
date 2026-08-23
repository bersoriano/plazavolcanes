begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba',
  'Descripción completa para probar el reloj de respuesta.');

insert into public.conversations (id, shop_id, buyer_id, type, updated_at)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale', '2020-01-01T00:00:00Z');

insert into public.messages (conversation_id, sender_id, body, idempotency_key)
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '¿Tienes talla 8?', gen_random_uuid());

insert into public.messages (conversation_id, sender_id, body, idempotency_key)
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sí, tenemos', gen_random_uuid());

select is_empty(
  $$select 1 from public.seller_response_events where conversation_id = 900$$,
  'a pre-sale message starts no seller response clock'
);

select isnt(
  (select updated_at from public.conversations where id = 900),
  '2020-01-01T00:00:00Z'::timestamptz,
  'a pre-sale message still bumps the conversation so the inbox sorts by it'
);

select is_empty(
  $$select 1 from public.seller_activity_events
    where shop_id = 900 and activity_type = 'seller_message'$$,
  'a pre-sale exchange records no seller activity'
);

select * from finish();

rollback;
