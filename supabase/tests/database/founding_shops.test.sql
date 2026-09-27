begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select has_table('private', 'founders_program', 'the launch programme lives in a private table');
select has_table('private', 'founding_shops', 'seats are a private ledger');
select has_column('public', 'shops', 'founder_since', 'a shop caches when it earned its seat');
select has_column('public', 'shops', 'publishing_approved_at', 'a shop records its first approval');
select has_function('public', 'founders_status', 'anyone can read the founders counter');

-- Two seats; the plaza opened an hour ago.
update private.founders_program set opens_at = now() - interval '1 hour', cap = 2, closes_at = null;

insert into auth.users (id, email, created_at) values
  ('40000000-0000-4000-8000-000000000001', 'founder-one@test.local', now()),
  ('40000000-0000-4000-8000-000000000002', 'founder-two@test.local', now()),
  ('40000000-0000-4000-8000-000000000003', 'third@test.local', now()),
  ('40000000-0000-4000-8000-000000000004', 'late@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, created_at)
overriding system value values
  (9301, '40000000-0000-4000-8000-000000000001', 'Primera', 'fundadora-primera', 'Descripción suficientemente larga para la tienda.', now()),
  (9302, '40000000-0000-4000-8000-000000000002', 'Segunda', 'fundadora-segunda', 'Descripción suficientemente larga para la tienda.', now()),
  (9303, '40000000-0000-4000-8000-000000000003', 'Tercera', 'fundadora-tercera', 'Descripción suficientemente larga para la tienda.', now()),
  -- Opened before the plaza did.
  (9304, '40000000-0000-4000-8000-000000000004', 'Semilla', 'fundadora-semilla', 'Descripción suficientemente larga para la tienda.', now() - interval '30 days');

select is((select listing_limit from public.shops where id = 9301), 25, 'every shop starts with 25 live listings');
select ok((select publishing_approved_at from public.shops where id = 9301) is null, 'a new shop waits for approval');
select ok((select founder_since from public.shops where id = 9301) is null, 'registering alone earns no seat');

-- Only seats are measured here, so the cover and publication guards step aside.
alter table public.products disable trigger enforce_product_cover_on_publish;
alter table public.products disable trigger guard_product_publication;

create function pg_temp.publish(p_shop bigint, p_count integer) returns void language plpgsql as $$
begin
  for i in 1..p_count loop
    insert into public.products (shop_id, name, slug, description, price_mxn, status, is_admin_enabled, category_id)
    values (p_shop, 'Artículo ' || i, 'articulo-' || p_shop || '-' || i || '-' || floor(random() * 1e9)::text,
      'Descripción suficientemente larga para el artículo.', 100, 'published', true,
      (select id from public.categories where slug = 'celulares-y-accesorios'));
  end loop;
end;
$$;

-- Unapproved, 8 live items earn nothing: the shop is not visible yet.
select pg_temp.publish(9301, 8);
select ok((select founder_since from public.shops where id = 9301) is null, 'an unapproved shop earns no seat');

-- Approving it claims the seat it already qualifies for.
update public.shops set is_publishing_approved = true where id = 9301;
select ok((select founder_since from public.shops where id = 9301) is not null, 'approval claims a seat already earned');
create temp table first_approval as select publishing_approved_at as at from public.shops where id = 9301;
delete from private.founding_shops;
update public.shops set is_publishing_approved = false where id = 9301;
update public.shops set updated_at = updated_at where id = 9301;
delete from public.products where shop_id = 9301;

update public.shops set is_publishing_approved = true where id in (9301, 9302, 9303, 9304);

-- Suspending and re-approving does not reopen the window.
select is(
  (select publishing_approved_at from public.shops where id = 9301),
  (select at from first_approval),
  'the first approval is kept'
);

select pg_temp.publish(9301, 7);
select ok((select founder_since from public.shops where id = 9301) is null, 'seven live items are not enough');

select pg_temp.publish(9301, 1);
select ok((select founder_since from public.shops where id = 9301) is not null, 'the eighth live item earns a seat');
select is((select listing_limit from public.shops where id = 9301), 50, 'a founder can publish 50');
select is((select taken from public.founders_status()), 1, 'the counter counts the seat');

-- A seller write cannot clear the seat or lower the cap.
update public.shops set name = 'Primera tienda', founder_since = null where id = 9301;
select ok((select founder_since from public.shops where id = 9301) is not null, 'the seat survives any edit');

-- The trust evaluator writing a tier's limit no longer sets the cap.
update public.shops set listing_limit = 15, trust_tier = 'standard' where id = 9302;
select is((select listing_limit from public.shops where id = 9302), 25, 'a tier write keeps the launch cap');

select pg_temp.publish(9304, 8);
select ok((select founder_since from public.shops where id = 9304) is not null, 'an older shop gets its 7 days from its approval');
select is((select is_open from public.founders_status()), false, 'the last seat closes the programme');

select pg_temp.publish(9303, 8);
select ok((select founder_since from public.shops where id = 9303) is null, 'no seat after the cap');
select is((select listing_limit from public.shops where id = 9303), 25, 'and the cap stays at 25');

-- Past the window, 8 items earn nothing.
update private.founders_program set cap = 3, opens_at = now() - interval '40 days';
alter table public.shops disable trigger zz_apply_launch_policy;
update public.shops set publishing_approved_at = now() - interval '8 days' where id = 9302;
alter table public.shops enable trigger zz_apply_launch_policy;
select pg_temp.publish(9302, 8);
select ok((select founder_since from public.shops where id = 9302) is null, 'items published more than 7 days after approval earn no seat');

-- Deleting a founder shop keeps its seat taken.
delete from public.products where shop_id = 9301;
delete from public.shops where id = 9301;
select is((select taken from public.founders_status()), 2, 'a deleted shop keeps its seat');

select * from finish();
rollback;
