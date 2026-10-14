begin;

create extension if not exists pgtap with schema extensions;

select plan(70);

-- Shape and privileges
select has_function('public', 'send_platform_notice',
  array['text', 'uuid', 'text', 'text', 'text', 'text'], 'sending RPC exists');
select has_function('public', 'retract_platform_notice', array['uuid'], 'retracting RPC exists');
select has_function('public', 'platform_notice_audience_counts', 'audience count RPC exists');
select has_function('public', 'list_platform_notice_batches', 'history RPC exists');
select has_function('public', 'mark_platform_notice_read', array['bigint'], 'read RPC exists');

select is(
  has_function_privilege('anon', 'public.send_platform_notice(text, uuid, text, text, text, text)', 'EXECUTE'),
  false, 'anonymous role cannot execute the sending RPC'
);
select is(
  has_function_privilege('anon', 'public.retract_platform_notice(uuid)', 'EXECUTE'),
  false, 'anonymous role cannot execute the retracting RPC'
);
select is(
  has_table_privilege('authenticated', 'public.platform_notices', 'SELECT'),
  true, 'a signed-in person may read notices, subject to row-level security'
);
select is(
  has_table_privilege('authenticated', 'public.platform_notices', 'INSERT')
    or has_table_privilege('authenticated', 'public.platform_notices', 'UPDATE')
    or has_table_privilege('authenticated', 'public.platform_notices', 'DELETE'),
  false, 'a signed-in person holds no write privilege on notices'
);
select is(
  has_table_privilege('anon', 'public.platform_notices', 'SELECT'),
  false, 'the anonymous role cannot read notices'
);
select is(
  has_table_privilege('authenticated', 'private.platform_notice_batches', 'SELECT'),
  false, 'the record of who sent what is out of reach of signed-in people'
);
select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'platform_notices'
  ),
  'notices are published for live delivery'
);

-- Fixtures: an administrator who owns no shop, two sellers and two buyers, one
-- of each disabled.
insert into auth.users (id, email, created_at, banned_until) values
  ('40000000-0000-4000-8000-000000000001', 'admin-notices@test.local', now(), null),
  ('40000000-0000-4000-8000-000000000002', 'seller-notices@test.local', now(), null),
  ('40000000-0000-4000-8000-000000000003', 'disabled-seller-notices@test.local', now(), now() + interval '1 year'),
  ('40000000-0000-4000-8000-000000000004', 'buyer-notices@test.local', now(), null),
  ('40000000-0000-4000-8000-000000000005', 'disabled-buyer-notices@test.local', now(), now() + interval '1 year');

insert into private.admin_users (user_id, granted_by) values
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001');

insert into public.user_display_names (user_id, display_name)
values ('40000000-0000-4000-8000-000000000004', 'Ana Ruiz')
on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values
  (9501, '40000000-0000-4000-8000-000000000002', 'Tienda Avisos', 'tienda-avisos',
   'Tienda de prueba para la audiencia de quienes venden.'),
  (9502, '40000000-0000-4000-8000-000000000003', 'Tienda Deshabilitada', 'tienda-deshabilitada',
   'Tienda de prueba de una cuenta deshabilitada.');

-- The accounts of this test, so audience assertions hold whatever else the
-- local database has in it.
create temp table mine (id uuid primary key);
insert into mine
select id from auth.users where email like '%-notices@test.local';
grant select on mine to authenticated;

create temp table sent (label text primary key, batch_id uuid, recipient_count integer);
grant select, insert on sent to authenticated;

-- Authorization
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"40000000-0000-4000-8000-000000000004","role":"authenticated"}';

select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, 'Hola', 'Cuerpo', null, null)$$,
  '42501', 'Solo administración puede enviar avisos.',
  'a person who is not an administrator cannot send a notice'
);
select throws_ok(
  $$select public.retract_platform_notice(gen_random_uuid())$$,
  '42501', 'Solo administración puede retirar avisos.',
  'a person who is not an administrator cannot retract a notice'
);
select throws_ok(
  $$select * from public.platform_notice_audience_counts()$$,
  '42501', null, 'a person who is not an administrator cannot count audiences'
);
select throws_ok(
  $$select * from public.list_platform_notice_batches()$$,
  '42501', null, 'a person who is not an administrator cannot read the history'
);

-- Arguments
set local request.jwt.claims =
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select * from public.send_platform_notice('vecinos', null, 'Hola', 'Cuerpo', null, null)$$,
  '22023', 'Audiencia inválida.', 'an unknown audience is refused'
);
select throws_ok(
  $$select * from public.send_platform_notice('person', null, 'Hola', 'Cuerpo', null, null)$$,
  '22023', 'Indica a quién va el aviso.', 'a notice to one person needs the person'
);
select throws_ok(
  $$select * from public.send_platform_notice('everyone', '40000000-0000-4000-8000-000000000004', 'Hola', 'Cuerpo', null, null)$$,
  '22023', 'Un anuncio no lleva una persona destinataria.',
  'an announcement does not name one person'
);
select throws_ok(
  $$select * from public.send_platform_notice('person', '49999999-0000-4000-8000-000000000000', 'Hola', 'Cuerpo', null, null)$$,
  'P0002', 'No encontramos esa cuenta.', 'an unknown recipient is refused'
);
select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, '   ', 'Cuerpo', null, null)$$,
  '22023', 'El título debe tener entre 1 y 120 caracteres.', 'a blank title is refused'
);
select throws_ok(
  format(
    $$select * from public.send_platform_notice('everyone', null, 'Hola', %L, null, null)$$,
    repeat('a', 2001)
  ),
  '22023', 'El mensaje debe tener entre 1 y 2000 caracteres.', 'an overlong message is refused'
);
select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, 'Hola', 'Cuerpo', 'https://evil.test/x', 'Abrir')$$,
  '22023', 'El enlace debe quedarse dentro de la plaza.', 'a link to another site is refused'
);
select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, 'Hola', 'Cuerpo', '//evil.test/x', 'Abrir')$$,
  '22023', 'El enlace debe quedarse dentro de la plaza.', 'a protocol-relative link is refused'
);
select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, 'Hola', 'Cuerpo', E'/\t/evil.test', 'Abrir')$$,
  '22023', 'El enlace debe quedarse dentro de la plaza.',
  'a link a browser would collapse into another site is refused'
);
select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, 'Hola', 'Cuerpo', '/panel', null)$$,
  '22023', 'El enlace y el texto del botón van juntos.', 'a link needs its button text'
);
select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, 'Hola', 'Cuerpo', null, 'Abrir')$$,
  '22023', 'El enlace y el texto del botón van juntos.', 'button text needs its link'
);

-- One person
select lives_ok(
  $$insert into sent
    select 'direct', r.batch_id, r.recipient_count
    from public.send_platform_notice(
      'person', '40000000-0000-4000-8000-000000000004',
      '  Tu tienda necesita portada  ', 'Agrega una foto de portada.', '/panel', 'Ir a mi panel'
    ) r$$,
  'an administrator sends a notice to one person'
);
select is((select recipient_count from sent where label = 'direct'), 1, 'it reports one recipient');

set local role postgres;

select results_eq(
  $$select recipient_id, kind, title, body, action_href, action_label, read_at is null
    from public.platform_notices
    where batch_id = (select batch_id from sent where label = 'direct')$$,
  $$values ('40000000-0000-4000-8000-000000000004'::uuid, 'direct', 'Tu tienda necesita portada',
            'Agrega una foto de portada.', '/panel', 'Ir a mi panel', true)$$,
  'the person receives one unread direct notice, trimmed, with its link'
);
select results_eq(
  $$select audience, recipient_id, sent_by, recipient_count, retracted_at is null
    from private.platform_notice_batches
    where id = (select batch_id from sent where label = 'direct')$$,
  $$values ('person', '40000000-0000-4000-8000-000000000004'::uuid,
            '40000000-0000-4000-8000-000000000001'::uuid, 1, true)$$,
  'the send is recorded with who it went to and who sent it'
);
select results_eq(
  $$select target_user_id, metadata ->> 'audience', (metadata ->> 'recipient_count')::integer
    from private.admin_audit_events
    where action = 'notice_sent'
      and metadata ->> 'batch_id' = (select batch_id::text from sent where label = 'direct')$$,
  $$values ('40000000-0000-4000-8000-000000000004'::uuid, 'person', 1)$$,
  'the send is audited against the person'
);

set local role authenticated;

select lives_ok(
  $$select * from public.send_platform_notice(
      'person', '40000000-0000-4000-8000-000000000005', 'Sobre tu cuenta', 'Escríbenos.', null, null)$$,
  'a notice may be left for a disabled account'
);

-- Audiences
select lives_ok(
  $$insert into sent
    select 'sellers', r.batch_id, r.recipient_count
    from public.send_platform_notice('sellers', null, 'Nuevas categorías', 'Ya puedes usarlas.', null, null) r$$,
  'an administrator announces to people who sell'
);
select lives_ok(
  $$insert into sent
    select 'buyers', r.batch_id, r.recipient_count
    from public.send_platform_notice('buyers', null, 'Envíos', 'Cambian los tiempos.', null, null) r$$,
  'an administrator announces to people who only buy'
);
select lives_ok(
  $$insert into sent
    select 'everyone', r.batch_id, r.recipient_count
    from public.send_platform_notice('everyone', null, 'Mantenimiento', 'El sábado por la noche.', null, null) r$$,
  'an administrator announces to everyone'
);

set local role postgres;

select results_eq(
  $$select n.recipient_id from public.platform_notices n
    where n.batch_id = (select batch_id from sent where label = 'sellers')
      and n.recipient_id in (select id from mine)$$,
  array['40000000-0000-4000-8000-000000000002'::uuid],
  'sellers reaches the account that owns a shop and skips the disabled one'
);
select results_eq(
  $$select n.recipient_id from public.platform_notices n
    where n.batch_id = (select batch_id from sent where label = 'buyers')
      and n.recipient_id in (select id from mine)
    order by n.recipient_id$$,
  array['40000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000004'::uuid],
  'buyers reaches the accounts without a shop, the administrator included, and skips the disabled one'
);
select results_eq(
  $$select n.recipient_id from public.platform_notices n
    where n.batch_id = (select batch_id from sent where label = 'everyone')
      and n.recipient_id in (select id from mine)
    order by n.recipient_id$$,
  array['40000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000002'::uuid,
        '40000000-0000-4000-8000-000000000004'::uuid],
  'everyone reaches every account that is not disabled'
);
select is(
  (select count(distinct kind)::integer || ':' || min(kind) from public.platform_notices
   where batch_id in (select batch_id from sent where label <> 'direct')),
  '1:announcement', 'what goes to an audience is an announcement'
);
select is(
  (select count(*)::integer from public.platform_notices
   where batch_id = (select batch_id from sent where label = 'everyone')),
  (select recipient_count from sent where label = 'everyone'),
  'the reported count is the number of notices delivered'
);
select is(
  (select recipient_count from private.platform_notice_batches
   where id = (select batch_id from sent where label = 'everyone')),
  (select recipient_count from sent where label = 'everyone'),
  'and the same count is kept with the send'
);

set local role authenticated;

select results_eq(
  $$select audience, people from public.platform_notice_audience_counts() order by audience$$,
  $$select label, recipient_count from sent where label <> 'direct' order by label$$,
  'the counts shown before sending are the counts delivered'
);

-- Reading
set local request.jwt.claims =
  '{"sub":"40000000-0000-4000-8000-000000000004","role":"authenticated"}';

select is(
  (select count(*)::integer from public.platform_notices),
  3, 'a person sees the notices sent to them'
);
select is(
  (select count(*)::integer from public.platform_notices
   where recipient_id <> '40000000-0000-4000-8000-000000000004'),
  0, 'and nobody else''s'
);
select throws_ok(
  $$insert into public.platform_notices (recipient_id, batch_id, kind, title, body)
    select '40000000-0000-4000-8000-000000000004', batch_id, 'direct', 'Falso', 'Falso'
    from sent where label = 'direct'$$,
  '42501', null, 'a person cannot write a notice'
);
select throws_ok(
  $$update public.platform_notices set title = 'Cambiado'$$,
  '42501', null, 'a person cannot change a notice'
);
select throws_ok(
  $$delete from public.platform_notices$$,
  '42501', null, 'a person cannot remove a notice'
);
select is(
  public.unread_message_count(), 3, 'unread notices count toward the unread badge'
);
select lives_ok(
  $$select public.mark_platform_notice_read(
      (select id from public.platform_notices
       where batch_id = (select batch_id from sent where label = 'everyone')))$$,
  'a person marks their own notice read'
);
select is(
  (select count(*)::integer from public.platform_notices where read_at is not null),
  1, 'that notice is now read'
);
select is(public.unread_message_count(), 2, 'and no longer counts as unread');

set local role postgres;
create temp table foreign_notice as
select id from public.platform_notices
where batch_id = (select batch_id from sent where label = 'everyone')
  and recipient_id = '40000000-0000-4000-8000-000000000002';
grant select on foreign_notice to authenticated;
set local role authenticated;

select lives_ok(
  $$select public.mark_platform_notice_read((select id from foreign_notice))$$,
  'marking somebody else''s notice is not an error'
);

set local role postgres;
select is(
  (select read_at from public.platform_notices where id = (select id from foreign_notice)),
  null, 'and leaves it unread'
);

-- History
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$select audience, recipient_label, title, recipient_count, read_count, retracted_at is null
    from public.list_platform_notice_batches()
    where batch_id = (select batch_id from sent where label = 'everyone')$$,
  $$select 'everyone', null::text, 'Mantenimiento', recipient_count, 1, true
    from sent where label = 'everyone'$$,
  'the history reports how many received an announcement and how many read it'
);
select results_eq(
  $$select audience, recipient_label, action_href, read_count
    from public.list_platform_notice_batches()
    where batch_id = (select batch_id from sent where label = 'direct')$$,
  $$values ('person', 'Ana Ruiz', '/panel', 0)$$,
  'the history names the person a direct notice went to'
);

-- Retracting
select is(
  public.retract_platform_notice((select batch_id from sent where label = 'everyone')),
  (select recipient_count from sent where label = 'everyone'),
  'retracting reports how many notices it removed'
);

set local role postgres;
select is(
  (select count(*)::integer from public.platform_notices
   where batch_id = (select batch_id from sent where label = 'everyone')),
  0, 'the notices are gone from every inbox'
);
select results_eq(
  $$select retracted_at is not null, retracted_by, recipient_count
    from private.platform_notice_batches
    where id = (select batch_id from sent where label = 'everyone')$$,
  $$select true, '40000000-0000-4000-8000-000000000001'::uuid, recipient_count
    from sent where label = 'everyone'$$,
  'the send stays on record, marked retracted, with its original count'
);
set local role authenticated;

select is(
  public.retract_platform_notice((select batch_id from sent where label = 'everyone')),
  0, 'retracting again removes nothing'
);

set local role postgres;
select is(
  (select count(*)::integer from private.admin_audit_events
   where action = 'notice_retracted'
     and metadata ->> 'batch_id' = (select batch_id::text from sent where label = 'everyone')),
  1, 'and is audited once'
);
set local role authenticated;

select throws_ok(
  $$select public.retract_platform_notice('49999999-0000-4000-8000-000000000000')$$,
  'P0002', 'No encontramos ese envío.', 'an unknown send cannot be retracted'
);
select is(
  (select retracted_at is not null from public.list_platform_notice_batches()
   where batch_id = (select batch_id from sent where label = 'everyone')),
  true, 'the history shows it as retracted'
);

-- The table refuses on its own what the function refuses
set local role postgres;

select throws_ok(
  $$insert into public.platform_notices (recipient_id, batch_id, kind, title, body, action_href, action_label)
    select '40000000-0000-4000-8000-000000000004', batch_id, 'direct', 'Hola', 'Cuerpo', 'https://evil.test', 'Abrir'
    from sent where label = 'direct'$$,
  '23514', null, 'the table itself refuses a link to another site'
);
select throws_ok(
  $$insert into public.platform_notices (recipient_id, batch_id, kind, title, body, action_href)
    select '40000000-0000-4000-8000-000000000004', batch_id, 'direct', 'Hola', 'Cuerpo', '/panel'
    from sent where label = 'direct'$$,
  '23514', null, 'the table itself refuses a link without button text'
);

-- Account deletion
select lives_ok(
  $$delete from auth.users where id = '40000000-0000-4000-8000-000000000004'$$,
  'notices never stand in the way of deleting an account'
);
select is(
  (select count(*)::integer from public.platform_notices
   where recipient_id = '40000000-0000-4000-8000-000000000004'),
  0, 'the deleted account''s notices go with it'
);
select results_eq(
  $$select recipient_id, recipient_count from private.platform_notice_batches
    where id = (select batch_id from sent where label = 'direct')$$,
  $$values (null::uuid, 1)$$,
  'the send stays on record without the person'
);

-- An audience with nobody in it
update auth.users set banned_until = now() + interval '1 year';
set local role authenticated;

select throws_ok(
  $$select * from public.send_platform_notice('everyone', null, 'Sin nadie', 'Cuerpo', null, null)$$,
  'P0002', 'No hay personas en esa audiencia.', 'an empty audience is refused'
);

set local role postgres;
select is(
  (select count(*)::integer from private.platform_notice_batches where title = 'Sin nadie'),
  0, 'and nothing is recorded for it'
);

select * from finish();

rollback;
