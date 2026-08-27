begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select has_table('public', 'legal_documents', 'the document type registry exists');
select has_table('public', 'legal_document_versions', 'document versions exist');

select results_eq(
  $$select count(*) from public.legal_documents where is_required$$,
  array[10::bigint],
  'ten required document types are seeded'
);

insert into auth.users (id, email, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@test.local', now()),
  ('a0000000-0000-4000-8000-000000000002', 'buyer@test.local', now());

insert into private.admin_users (user_id, granted_by)
values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001');

insert into public.legal_document_versions
  (id, document_type, version, status, title, body, change_summary, effective_at, approved_by, approved_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'platform_terms', 1, 'draft',
   'Terminos borrador', '{"sections": []}'::jsonb, 'primera version', now(), null, null),
  ('b0000000-0000-4000-8000-000000000002', 'privacy_notice', 1, 'approved',
   'Aviso aprobado', '{"sections": []}'::jsonb, 'primera version', now(), 'Lic. Prueba', now()),
  -- Fixtures for the publish-time validation tests below: an otherwise-valid
  -- approved version reused across the identity-shape assertions (they all
  -- fail before the function ever inspects the body), plus one version each
  -- for the two body-shape failures and one for the fully valid case.
  ('b0000000-0000-4000-8000-000000000004', 'returns_policy', 1, 'approved',
   'Devoluciones aprobado', '{"sections": []}'::jsonb, 'primera version', now(), 'Lic. Prueba', now()),
  ('b0000000-0000-4000-8000-000000000005', 'warranty_policy', 1, 'approved',
   'Garantias aprobado', '{"foo": "bar"}'::jsonb, 'primera version', now(), 'Lic. Prueba', now()),
  ('b0000000-0000-4000-8000-000000000006', 'shipping_policy', 1, 'approved',
   'Envios aprobado',
   '{"sections": [{"id": "s1", "paragraphs": ["hola"]}]}'::jsonb,
   'primera version', now(), 'Lic. Prueba', now()),
  ('b0000000-0000-4000-8000-000000000007', 'security_guidance', 1, 'approved',
   'Seguridad aprobado',
   '{"sections": [{"id": "s1", "heading": "Encabezado", "paragraphs": ["Parrafo uno."]}]}'::jsonb,
   'primera version', now(), 'Lic. Prueba', now());

-- A version can never be minted as published by a bare INSERT: the trigger
-- rejects this unconditionally, regardless of who is writing, which is why
-- this runs at the default (table owner) connection role -- proving the
-- trigger itself is the one stopping it here, not a missing grant.
select throws_ok(
  $$insert into public.legal_document_versions (document_type, version, status, title, change_summary)
    values ('returns_policy', 1, 'published', 'Bypass', 'intento de bypass')$$,
  '42501', null, 'a version cannot be inserted directly as published'
);

-- A draft can never be flipped straight to retired either: there is no
-- predecessor being superseded, so publish_legal_version() never performs
-- this transition and the trigger grants it no owner exception at all.
select throws_ok(
  $$update public.legal_document_versions set status = 'retired'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a draft cannot be flipped straight to retired'
);

-- service_role holds no INSERT/UPDATE/DELETE grant on this table (the actual
-- fix for the demonstrated exploit: forging a publish by setting status and
-- issuer_identity/content_hash directly). These two fail at the grant layer
-- -- permission denied, 42501 -- before the trigger ever runs, which is a
-- different failure path than the owner-context checks above and needs its
-- own coverage.
set local role service_role;
select throws_ok(
  $$update public.legal_document_versions set status = 'published',
    content_hash = 'not-a-real-hash', issuer_identity = '{"forged":true}'::jsonb
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'service_role cannot forge a publish directly (no write grant)'
);
reset role;

set local role service_role;
select throws_ok(
  $$insert into public.legal_document_versions (document_type, version, status, title, change_summary)
    values ('warranty_policy', 1, 'published', 'Bypass', 'intento de bypass')$$,
  '42501', null, 'service_role cannot insert a published version directly (no write grant)'
);
reset role;

-- anonymous visitors see nothing that is not published
set local role anon;
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[0::bigint],
  'anonymous visitors cannot read drafts or approved versions'
);
reset role;

-- the same drafts/approved versions are invisible to a non-admin authenticated
-- user, and visible to an admin -- both halves of the read guarantee.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[0::bigint],
  'a non-admin authenticated user cannot read drafts or approved versions'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[6::bigint],
  'an admin reads every version regardless of status'
);
reset role;

-- only an admin may publish
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000002', '{"entityName":"Test SA de CV","rfc":"XAXX010101000","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  '42501', null, 'a non-admin cannot publish a legal version'
);
reset role;

-- a draft cannot be published
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000001', '{"entityName":"Test SA de CV","rfc":"XAXX010101000","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  '22023', null, 'a draft cannot be published'
);

select lives_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000002', '{"entityName":"Test SA de CV","rfc":"XAXX010101000","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  'an approved version publishes'
);
reset role;

select isnt(
  (select content_hash from public.legal_document_versions where id = 'b0000000-0000-4000-8000-000000000002'),
  null,
  'publishing computes a content hash'
);

-- published versions are immutable
select throws_ok(
  $$update public.legal_document_versions set title = 'otro' where id = 'b0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'a published version cannot be edited'
);

select throws_ok(
  $$delete from public.legal_document_versions where id = 'b0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'a legal version cannot be deleted'
);

-- published versions are public, and resolve
set local role anon;
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[1::bigint],
  'anonymous visitors read exactly the published version'
);

select results_eq(
  $$select (public.current_legal_document('privacy_notice')).version$$,
  array[1::integer],
  'the resolver returns the published version'
);
reset role;

-- publishing a second version of the same document type must retire the
-- first: the guard's permitted-transition branch and publish_legal_version's
-- supersession path were previously never exercised by any test.
insert into public.legal_document_versions
  (id, document_type, version, status, title, body, change_summary, effective_at, approved_by, approved_at)
values
  ('b0000000-0000-4000-8000-000000000003', 'privacy_notice', 2, 'approved',
   'Aviso aprobado v2', '{"sections": []}'::jsonb, 'segunda version', now(), 'Lic. Prueba', now());

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000003', '{"entityName":"Test SA de CV","rfc":"XAXX010101000","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  'publishing a second version succeeds'
);
reset role;

select results_eq(
  $$select status::text from public.legal_document_versions where id = 'b0000000-0000-4000-8000-000000000002'$$,
  array['retired'],
  'the superseded version is retired'
);

select ok(
  (select retired_at is not null from public.legal_document_versions where id = 'b0000000-0000-4000-8000-000000000002'),
  'the superseded version records when it was retired'
);

select results_eq(
  $$select supersedes_version_id from public.legal_document_versions where id = 'b0000000-0000-4000-8000-000000000003'$$,
  array['b0000000-0000-4000-8000-000000000002'::uuid],
  'the new version records which version it supersedes'
);

set local role anon;
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[1::bigint],
  'anonymous visitors read exactly one published version after supersession'
);
reset role;

-- publish_legal_version() validates the issuer identity and the document
-- body before publishing: an identity missing a required key, an identity
-- with an empty-string value, a malformed body, or a section missing a
-- required field must all be rejected, and a fully valid publish must still
-- succeed.
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000004',
    '{"entityName":"Test SA de CV","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  '22023', null, 'an identity missing a required key is rejected'
);

select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000004',
    '{"entityName":"Test SA de CV","rfc":"","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  '22023', null, 'an identity with an empty-string value is rejected'
);

select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000005', '{"entityName":"Test SA de CV","rfc":"XAXX010101000","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  '22023', null, 'a body that is not {"sections": [...]} is rejected'
);

select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000006', '{"entityName":"Test SA de CV","rfc":"XAXX010101000","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  '22023', null, 'a section missing heading is rejected'
);

select lives_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000007', '{"entityName":"Test SA de CV","rfc":"XAXX010101000","address":"Calle Falsa 123, CDMX","email":"test@example.com","phone":"+525555555555","attentionHours":"L-V 9:00-18:00","privacyContact":"privacidad@example.com"}'::jsonb)$$,
  'a fully valid publish still succeeds'
);
reset role;

select * from finish();
rollback;
