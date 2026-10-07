-- The hosted database ran an early draft of 20260927090000_add_founding_shops,
-- before that file was rewritten for the launch package, so it never gained
-- shops.founder_since. Every catalogue query reads the column with the shop,
-- and without it PostgREST fails the whole select and the plaza shows no
-- products. Restore the column first; the rest of the launch package is
-- reconciled in the next migration. On a database that ran the current file
-- this is a no-op.
alter table public.shops
  add column if not exists founder_since timestamptz;
