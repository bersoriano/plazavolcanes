begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

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

-- anonymous visitors see nothing that is not published
set local role anon;
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[0::bigint],
  'anonymous visitors cannot read drafts or approved versions'
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

select * from finish();
rollback;
