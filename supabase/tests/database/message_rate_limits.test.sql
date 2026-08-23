begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba',
  'Descripción completa para probar los límites de mensajes.');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Burn the hourly allowance.
do $$
declare i integer;
begin
  for i in 1..60 loop
    perform public.send_conversation_message(900, 'mensaje ' || i, gen_random_uuid());
  end loop;
end;
$$;

select throws_ok(
  $$select public.send_conversation_message(900, 'uno de más', gen_random_uuid())$$,
  'P0001',
  'Enviaste demasiados mensajes. Intenta de nuevo en un rato.',
  'the sixty-first message in an hour is refused'
);

select lives_ok(
  $$select public.send_conversation_message(
      900,
      'mensaje 1',
      (select idempotency_key from public.messages where conversation_id = 900 order by id limit 1)
    )$$,
  'replaying a message the server already stored is accepted even at the limit'
);

-- Opening threads is bounded separately, and re-opening an existing one is free.
select is(
  public.start_pre_sale_conversation(900),
  900::bigint,
  'reopening a thread returns the one that already exists'
);

select throws_ok(
  $$select sent_count from private.message_rate_limits$$,
  '42501',
  null,
  'a browser role cannot read the counters that throttle it'
);

reset role;

select is(
  (select sent_count from private.message_rate_limits
   where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and window_hour = date_trunc('hour', now())),
  60,
  'a refused send does not inflate the counter'
);

select is(
  (select count(*) from public.messages where conversation_id = 900)::integer,
  60,
  'neither the refusal nor the replay stored an extra message'
);

select is(
  (select coalesce(sum(conversations_opened), 0) from private.message_rate_limits
   where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'reopening an existing thread spends no quota'
);

select is(
  (select count(*) from private.message_rate_limits
   where window_hour < now() - interval '48 hours')::integer,
  0,
  'nothing older than the pruning window is left behind'
);

select * from finish();

rollback;
