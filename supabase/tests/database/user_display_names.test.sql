begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_table('public', 'user_display_names', 'display name table exists');

insert into auth.users (id, email, created_at, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'named@test.local', now(), '{"display_name": "Ana Ruiz"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'blank@test.local', now(), '{"display_name": " "}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'none@test.local', now(), '{}'::jsonb);

select results_eq(
  $$select display_name from public.user_display_names where user_id = '11111111-1111-4111-8111-111111111111'$$,
  array['Ana Ruiz'::text],
  'registration metadata becomes a display name'
);

select is_empty(
  $$select 1 from public.user_display_names where user_id = '22222222-2222-4222-8222-222222222222'$$,
  'unusable sign-up metadata stores no row instead of failing account creation'
);

select is(
  private.display_label('33333333-3333-4333-8333-333333333333', null),
  'Comprador #3333',
  'a person with no name gets a stable handle'
);

select is(
  private.display_label('11111111-1111-4111-8111-111111111111', 'Ana Ruiz'),
  'Ana Ruiz',
  'a person with a name gets their name'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select throws_ok(
  $$select display_name from public.user_display_names$$,
  '42501',
  null,
  'display names are not readable through row level security'
);

select lives_ok(
  $$select public.set_display_name('Carlos Vega')$$,
  'a person may set their own display name'
);

select is(
  public.my_display_name(),
  'Carlos Vega',
  'a person reads back the name they set'
);

select * from finish();

rollback;
