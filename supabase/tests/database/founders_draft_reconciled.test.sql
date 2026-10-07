begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- The early draft of 20260927090000_add_founding_shops ran on the hosted
-- database before the file became the launch package. Nothing of it may
-- outlive 20261007024451_reconcile_founders_launch_package.
select hasnt_table('private', 'shop_registrations', 'the draft registration ledger is gone');
select hasnt_function('private', 'founding_registrations', 'the draft ranking is gone');
select hasnt_function('private', 'active_founder_listing_limit', 'the draft perk lookup is gone');
select hasnt_function('private', 'apply_founder_perks', 'the draft perk floor is gone');
select hasnt_function('private', 'record_shop_registration', 'the draft registration hook is gone');
select hasnt_function('private', 'expire_founder_perks', 'the draft perk expiry is gone');
select hasnt_function('public', 'is_founding_shop', 'the draft badge lookup is gone');
select hasnt_function('public', 'current_user_is_founder', 'the draft owner lookup is gone');
select hasnt_trigger('public', 'shops', 'zz_apply_founder_perks', 'no draft trigger floors a shop''s limits');
select hasnt_trigger('public', 'shops', 'record_shop_registration', 'no draft trigger records registrations');
select is(
  (select count(*)::integer from cron.job where jobname = 'plaza-expire-founder-perks'),
  0,
  'no job expires draft perks'
);

-- And the launch package is whole.
select has_trigger('public', 'shops', 'zz_apply_launch_policy', 'every shop write applies the launch policy');
select has_trigger('public', 'products', 'claim_founding_seat_on_publish', 'publishing can claim a seat');
select has_trigger('public', 'shops', 'claim_founding_seat_on_approval', 'approval can claim a seat');
select has_column('private', 'founders_program', 'opens_at', 'the programme has the launch package''s shape');
select hasnt_column('private', 'founders_program', 'perk_period', 'the draft programme shape is gone');
select is((select count(*)::integer from private.founders_program), 1, 'there is one programme row');

select * from finish();
rollback;
