begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_table('private', 'founders_program', 'the promotion window lives in a private table');
select has_table('private', 'shop_registrations', 'registration order is a private ledger');
select has_function('public', 'founders_status', 'anyone can read the founders counter');

-- A clean window around the test: three spots, opening an hour ago.
delete from private.founders_program;
insert into private.founders_program (starts_at, ends_at, cap)
values (now() - interval '1 hour', now() + interval '3 months', 3);

insert into auth.users (id, email, created_at) values
  ('40000000-0000-4000-8000-000000000001', 'founder-one@test.local', now()),
  ('40000000-0000-4000-8000-000000000002', 'founder-two@test.local', now()),
  ('40000000-0000-4000-8000-000000000003', 'founder-three@test.local', now()),
  ('40000000-0000-4000-8000-000000000004', 'too-late@test.local', now()),
  ('40000000-0000-4000-8000-000000000005', 'admin-founders@test.local', now());

insert into private.admin_users (user_id, granted_by) values
  ('40000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000005');

insert into private.user_shop_limits (user_id, shop_limit) values
  ('40000000-0000-4000-8000-000000000001', 2);

-- The ledger is keyed by owner, so an old store from before the window stays
-- out of it once its owner is recorded.
insert into public.shops (id, owner_id, name, slug, description, created_at)
overriding system value values
  (9301, '40000000-0000-4000-8000-000000000001', 'Primera', 'fundadora-primera', 'Descripción suficientemente larga para la tienda.', now() - interval '30 minutes'),
  (9302, '40000000-0000-4000-8000-000000000002', 'Segunda', 'fundadora-segunda', 'Descripción suficientemente larga para la tienda.', now() - interval '20 minutes'),
  (9303, '40000000-0000-4000-8000-000000000003', 'Tercera', 'fundadora-tercera', 'Descripción suficientemente larga para la tienda.', now() - interval '10 minutes'),
  (9304, '40000000-0000-4000-8000-000000000004', 'Cuarta', 'fundadora-cuarta', 'Descripción suficientemente larga para la tienda.', now() - interval '5 minutes');

select is(
  (select taken from public.founders_status()),
  3,
  'the counter stops at the cap'
);
select is((select is_open from public.founders_status()), false, 'a full house closes the promotion');

select ok(public.is_founding_shop(9301), 'the first store is a founder');
select ok(public.is_founding_shop(9303), 'the third store is a founder');
select ok(not public.is_founding_shop(9304), 'the store after the cap is not');

select is((select listing_limit from public.shops where id = 9301), 50, 'a founder starts with 50 articles');
select ok((select is_premium from public.shops where id = 9301), 'a founder starts Premium');
select is((select listing_limit from public.shops where id = 9304), 15, 'a store past the cap starts at the Estándar limit');
select ok(not (select is_premium from public.shops where id = 9304), 'a store past the cap is not Premium');

-- A second store from a founder is not a second spot.
insert into public.shops (id, owner_id, name, slug, description)
overriding system value values
  (9305, '40000000-0000-4000-8000-000000000001', 'Otra', 'fundadora-otra', 'Descripción suficientemente larga para la tienda.');
select ok(not public.is_founding_shop(9305), 'an owner''s second store is not a founder');
select is((select listing_limit from public.shops where id = 9305), 15, 'and keeps the Estándar limit');

-- The trust evaluator writing a tier's limit cannot take a founder below 50,
-- and a higher tier still raises it.
update public.shops set listing_limit = 15, trust_tier = 'standard' where id = 9302;
select is((select listing_limit from public.shops where id = 9302), 50, 'a tier write keeps the founder floor');
update public.shops set listing_limit = 100, trust_tier = 'top_rated' where id = 9302;
select is((select listing_limit from public.shops where id = 9302), 100, 'a higher tier still applies');

-- A seller editing their own founder store is not blocked by the floor.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$update public.shops set name = 'Tercera tienda' where id = 9303$$,
  'a founder can still edit their store'
);
select ok(public.current_user_is_founder(), 'the owner can see they are a founder');
reset role;

-- Deleting a founder store keeps its spot taken.
delete from public.shops where id = 9303;
select is((select taken from public.founders_status()), 3, 'a deleted store keeps its spot');

-- A year on, the perks lapse: the tier's limit returns and Premium goes,
-- unless administration granted it separately.
update private.shop_registrations set registered_at = now() - interval '13 months'
where owner_id in ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002');
update private.founders_program set starts_at = now() - interval '14 months', cap = 3;
insert into private.shop_premium_grants (shop_id, granted_by)
values (9302, '40000000-0000-4000-8000-000000000005');

select ok(private.expire_founder_perks() >= 1, 'expiry touches the lapsed founders');
select is((select listing_limit from public.shops where id = 9301), 15, 'the Estándar limit returns after the first year');
select ok(not (select is_premium from public.shops where id = 9301), 'founder Premium ends after the first year');
select ok((select is_premium from public.shops where id = 9302), 'an administrator''s own Premium grant survives');

select * from finish();
rollback;
