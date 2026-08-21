begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_table('public', 'user_contact_details', 'contact details table exists');
select has_column('public', 'user_contact_details', 'phone', 'contact details store a phone');

insert into auth.users (id, email, created_at, raw_user_meta_data) values
  ('66666666-6666-4666-8666-666666666666', 'with-phone@test.local', now(), '{"phone": "3312345678"}'::jsonb),
  ('77777777-7777-4777-8777-777777777777', 'pasted-phone@test.local', now(), '{"phone": "+52 33 1234 5679"}'::jsonb),
  ('88888888-8888-4888-8888-888888888888', 'junk-phone@test.local', now(), '{"phone": "no soy un teléfono"}'::jsonb),
  ('99999999-9999-4999-8999-999999999999', 'no-phone@test.local', now(), '{}'::jsonb);

select results_eq(
  $$select phone from public.user_contact_details where user_id = '66666666-6666-4666-8666-666666666666'$$,
  array['+523312345678'::text],
  'registration metadata becomes an E.164 phone'
);

select results_eq(
  $$select phone from public.user_contact_details where user_id = '77777777-7777-4777-8777-777777777777'$$,
  array['+523312345679'::text],
  'a pasted country code is not stored twice'
);

select results_eq(
  $$select phone from public.user_contact_details where user_id = '88888888-8888-4888-8888-888888888888'$$,
  array[null::text],
  'unusable sign-up metadata is stored as no phone instead of failing the insert'
);

select results_eq(
  $$select count(*) from auth.users u where not exists (select 1 from public.user_contact_details c where c.user_id = u.id)$$,
  array[0::bigint],
  'every existing account has a contact row to fill in later'
);

select throws_ok(
  $$update public.user_contact_details set phone = '3312345678' where user_id = '99999999-9999-4999-8999-999999999999'$$,
  '23514',
  null,
  'a phone must be stored in E.164 form'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated"}';

select results_eq(
  $$select count(*) from public.user_contact_details$$,
  array[1::bigint],
  'a signed in user reads only their own contact details'
);

set local role anon;

select throws_ok(
  $$select count(*) from public.user_contact_details$$,
  '42501',
  null,
  'anonymous visitors are denied the table outright, before RLS is consulted'
);

select * from finish();
rollback;
