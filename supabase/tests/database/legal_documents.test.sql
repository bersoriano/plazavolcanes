begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

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
   'Aviso aprobado', '{"sections": []}'::jsonb, 'primera version', now(), 'Lic. Prueba', now());

-- a version can never be minted as published (or retired) by a bare write --
-- only publish_legal_version may reach that status. This is reachable by
-- service_role or a future migration, so it is tested at the default
-- (superuser, RLS-bypassing) connection role, not through anon/authenticated.
select throws_ok(
  $$insert into public.legal_document_versions (document_type, version, status, title, change_summary)
    values ('returns_policy', 1, 'published', 'Bypass', 'intento de bypass')$$,
  '42501', null, 'a version cannot be inserted directly as published'
);

select throws_ok(
  $$update public.legal_document_versions set status = 'published'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a draft cannot be flipped to published outside publish_legal_version'
);

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
  array[2::bigint],
  'an admin reads every version regardless of status'
);
reset role;

-- only an admin may publish
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000002', '{"rfc":"X"}'::jsonb)$$,
  '42501', null, 'a non-admin cannot publish a legal version'
);
reset role;

-- a draft cannot be published
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000001', '{"rfc":"X"}'::jsonb)$$,
  '22023', null, 'a draft cannot be published'
);

select lives_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000002', '{"rfc":"XAXX010101000"}'::jsonb)$$,
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
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000003', '{"rfc":"XAXX010101000"}'::jsonb)$$,
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

select * from finish();
rollback;
