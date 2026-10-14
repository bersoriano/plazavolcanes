begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

-- Shape and privileges
select has_function('public', 'submit_contact_message',
  array['text', 'text', 'text', 'text'], 'sending RPC exists');
select has_function('public', 'list_contact_messages', 'listing RPC exists');
select has_function('public', 'mark_contact_message_attended', array['uuid'], 'attending RPC exists');

select is(
  has_function_privilege('anon', 'public.submit_contact_message(text, text, text, text)', 'EXECUTE'),
  true, 'a visitor may write without an account'
);
select is(
  has_function_privilege('authenticated', 'public.submit_contact_message(text, text, text, text)', 'EXECUTE'),
  true, 'a signed-in person may write'
);
select is(
  has_function_privilege('anon', 'public.list_contact_messages()', 'EXECUTE'),
  false, 'anonymous role cannot execute the listing RPC'
);
select is(
  has_function_privilege('anon', 'public.mark_contact_message_attended(uuid)', 'EXECUTE'),
  false, 'anonymous role cannot execute the attending RPC'
);
select is(
  has_table_privilege('authenticated', 'private.contact_messages', 'SELECT')
    or has_table_privilege('authenticated', 'private.contact_messages', 'INSERT')
    or has_table_privilege('authenticated', 'private.contact_messages', 'UPDATE')
    or has_table_privilege('authenticated', 'private.contact_messages', 'DELETE'),
  false, 'a signed-in person holds no privilege on what was sent'
);
select is(
  has_table_privilege('anon', 'private.contact_messages', 'SELECT')
    or has_table_privilege('anon', 'private.contact_messages', 'INSERT'),
  false, 'the anonymous role holds no privilege on what was sent'
);
select is(
  has_table_privilege('authenticated', 'private.contact_rate_limits', 'SELECT')
    or has_table_privilege('authenticated', 'private.contact_rate_limits', 'UPDATE')
    or has_table_privilege('anon', 'private.contact_rate_limits', 'UPDATE'),
  false, 'nobody outside the database reaches the counters'
);

-- Fixtures: an administrator, a sender with a name and a phone on file, and a
-- sender with neither.
insert into auth.users (id, email, created_at) values
  ('41000000-0000-4000-8000-000000000001', 'admin-contact@test.local', now()),
  ('41000000-0000-4000-8000-000000000002', 'sender-contact@test.local', now()),
  ('41000000-0000-4000-8000-000000000003', 'bare-contact@test.local', now());

insert into private.admin_users (user_id, granted_by) values
  ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001');

insert into public.user_display_names (user_id, display_name)
values ('41000000-0000-4000-8000-000000000002', 'Ana Contacto')
on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.user_contact_details (user_id, phone)
values ('41000000-0000-4000-8000-000000000002', '+525512345678')
on conflict (user_id) do update set phone = excluded.phone;

delete from public.user_display_names
where user_id = '41000000-0000-4000-8000-000000000003';
update public.user_contact_details set phone = null
where user_id = '41000000-0000-4000-8000-000000000003';

-- The hour's counters start empty, whatever else the local database has seen.
delete from private.contact_rate_limits;

create temp table sent (label text primary key, id uuid);
grant select, insert on sent to anon, authenticated;

-- A visitor without an account
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select public.submit_contact_message('  Hola  ', 'Luis Pérez', 'visitor-contact@test.local', '+525587654321')$$,
  '22023', 'El mensaje debe tener entre 10 y 2000 caracteres.', 'a message too short to say anything is refused'
);
select throws_ok(
  format(
    $$select public.submit_contact_message(%L, 'Luis Pérez', 'visitor-contact@test.local', '+525587654321')$$,
    repeat('a', 2001)
  ),
  '22023', 'El mensaje debe tener entre 10 y 2000 caracteres.', 'an overlong message is refused'
);
select throws_ok(
  $$select public.submit_contact_message('No llegó mi pedido.', ' ', 'visitor-contact@test.local', '+525587654321')$$,
  '22023', 'Escribe tu nombre.', 'a visitor must say who they are'
);
select throws_ok(
  $$select public.submit_contact_message('No llegó mi pedido.', 'Luis Pérez', 'sin-arroba', '+525587654321')$$,
  '22023', 'Escribe un correo válido.', 'a visitor must leave an email'
);
select throws_ok(
  $$select public.submit_contact_message('No llegó mi pedido.', 'Luis Pérez', 'visitor-contact@test.local', '5587654321')$$,
  '22023', 'Escribe tu teléfono móvil a 10 dígitos.', 'a visitor must leave a phone in its stored form'
);
select lives_ok(
  $$insert into sent
    select 'visitor', public.submit_contact_message(
      '  No llegó mi pedido.  ', '  Luis Pérez ', ' visitor-contact@test.local ', '+525587654321'
    )$$,
  'a visitor sends a message'
);

set local role postgres;

select results_eq(
  $$select user_id, name, email, phone, message, attended_at is null
    from private.contact_messages where id = (select id from sent where label = 'visitor')$$,
  $$values (null::uuid, 'Luis Pérez', 'visitor-contact@test.local', '+525587654321',
            'No llegó mi pedido.', true)$$,
  'what the visitor typed is stored trimmed, with no account and not yet attended'
);
select is(
  (select sent_count from private.contact_rate_limits where sender = 'anon'),
  1, 'refused sends count for nothing'
);

-- A signed-in person
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$insert into sent
    select 'ana', public.submit_contact_message(
      'El vendedor no responde.', 'Otra Persona', 'otra@evil.test', '+525500000000'
    )$$,
  'a signed-in person sends a message'
);
select throws_ok(
  $$select public.submit_contact_message('Hola', null, null, null)$$,
  '22023', 'El mensaje debe tener entre 10 y 2000 caracteres.',
  'a signed-in person is held to the same message length'
);

set local request.jwt.claims =
  '{"sub":"41000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok(
  $$insert into sent
    select 'bare', public.submit_contact_message('¿Cómo cambio mi correo?', null, null, null)$$,
  'a signed-in person needs to type nothing but the message'
);

set local role postgres;

select results_eq(
  $$select user_id, name, email, phone
    from private.contact_messages where id = (select id from sent where label = 'ana')$$,
  $$values ('41000000-0000-4000-8000-000000000002'::uuid, 'Ana Contacto',
            'sender-contact@test.local', '+525512345678')$$,
  'the account says who wrote, whatever the form carried'
);
select results_eq(
  $$select user_id, name, email, phone
    from private.contact_messages where id = (select id from sent where label = 'bare')$$,
  $$values ('41000000-0000-4000-8000-000000000003'::uuid, null::text,
            'bare-contact@test.local', null::text)$$,
  'an account without a name or a phone still leaves its email'
);

-- Limits
insert into private.contact_rate_limits (sender, window_hour, sent_count)
values ('41000000-0000-4000-8000-000000000009', now() - interval '48 hours', 3);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$select public.submit_contact_message('Mensaje de relleno ' || n, null, null, null)
    from generate_series(1, 4) n$$,
  'an account may send five messages in an hour'
);
select throws_ok(
  $$select public.submit_contact_message('Uno más de la cuenta.', null, null, null)$$,
  'P0001', 'Recibimos demasiados mensajes. Intenta de nuevo en un rato.',
  'the sixth in an hour is refused'
);

set local request.jwt.claims =
  '{"sub":"41000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok(
  $$select public.submit_contact_message('Otra cuenta, otro límite.', null, null, null)$$,
  'one account reaching its limit does not silence another'
);

set local role postgres;

select is(
  (select count(*)::integer from private.contact_rate_limits
   where window_hour < now() - interval '24 hours'),
  0, 'old counters are cleared as messages arrive'
);

update private.contact_rate_limits set sent_count = 30 where sender = 'anon';

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select public.submit_contact_message('No llegó mi pedido.', 'Luis Pérez', 'visitor-contact@test.local', '+525587654321')$$,
  'P0001', 'Recibimos demasiados mensajes. Intenta de nuevo en un rato.',
  'visitors share one hourly limit'
);

-- Keep the three labelled messages, an hour apart, so the order below is theirs.
set local role postgres;

delete from private.contact_messages
where email like '%-contact@test.local' and id not in (select id from sent);
update private.contact_messages set created_at = now() - interval '3 hours'
where id = (select id from sent where label = 'visitor');
update private.contact_messages set created_at = now() - interval '2 hours'
where id = (select id from sent where label = 'ana');
update private.contact_messages set created_at = now() - interval '1 hour'
where id = (select id from sent where label = 'bare');

-- Administration
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select * from public.list_contact_messages()$$,
  '42501', 'Solo administración puede leer los mensajes de contacto.',
  'a person who is not an administrator cannot read what was sent'
);
select throws_ok(
  format($$select public.mark_contact_message_attended(%L)$$, (select id from sent where label = 'ana')),
  '42501', 'Solo administración puede atender mensajes de contacto.',
  'a person who is not an administrator cannot mark a message, even their own'
);

set local request.jwt.claims =
  '{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$select id, has_account, name, email, phone, message, attended_at is null
    from public.list_contact_messages()
    where email like '%-contact@test.local'$$,
  $$values
    ((select id from sent where label = 'bare'), true, null::text,
     'bare-contact@test.local', null::text, '¿Cómo cambio mi correo?', true),
    ((select id from sent where label = 'ana'), true, 'Ana Contacto',
     'sender-contact@test.local', '+525512345678', 'El vendedor no responde.', true),
    ((select id from sent where label = 'visitor'), false, 'Luis Pérez',
     'visitor-contact@test.local', '+525587654321', 'No llegó mi pedido.', true)$$,
  'an administrator reads everything, newest first, with how to answer'
);
select lives_ok(
  format($$select public.mark_contact_message_attended(%L)$$, (select id from sent where label = 'bare')),
  'an administrator marks a message as attended'
);
select results_eq(
  $$select id, attended_at is null
    from public.list_contact_messages()
    where email like '%-contact@test.local'$$,
  $$values
    ((select id from sent where label = 'ana'), true),
    ((select id from sent where label = 'visitor'), true),
    ((select id from sent where label = 'bare'), false)$$,
  'what still waits comes before what was attended'
);
select lives_ok(
  format($$select public.mark_contact_message_attended(%L)$$, (select id from sent where label = 'bare')),
  'marking a message twice is not an error'
);
select throws_ok(
  $$select public.mark_contact_message_attended('49999999-0000-4000-8000-000000000000')$$,
  'P0002', 'No encontramos ese mensaje.', 'an unknown message is refused'
);

set local role postgres;

select results_eq(
  $$select attended_by, attended_at is not null
    from private.contact_messages where id = (select id from sent where label = 'bare')$$,
  $$values ('41000000-0000-4000-8000-000000000001'::uuid, true)$$,
  'the message records who attended it'
);

-- An account that is deleted leaves its message, and the way to answer it.
select lives_ok(
  $$delete from auth.users where id = '41000000-0000-4000-8000-000000000003'$$,
  'a message never stands in the way of deleting an account'
);
select results_eq(
  $$select user_id, email
    from private.contact_messages where id = (select id from sent where label = 'bare')$$,
  $$values (null::uuid, 'bare-contact@test.local')$$,
  'the message outlives the account'
);

set local role authenticated;

select is(
  (select has_account from public.list_contact_messages()
   where id = (select id from sent where label = 'bare')),
  false, 'administration is told the account is gone'
);

select * from finish();
rollback;
