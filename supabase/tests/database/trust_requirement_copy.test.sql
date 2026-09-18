begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- A shop with nothing measured: every requirement line must say so in words,
-- never as a number wearing a unit it does not have.
with evaluated as (
  select private.evaluate_trust_tier(
    null, null, null, null, null, null, null, null, null, null
  ) as result
),
requirements as (
  select string_agg(value, ' | ') as text
  from evaluated, jsonb_array_elements_text(result->'next_tier_requirements')
)
select is(
  (select text ~ 'sin datos\s*%' from requirements),
  false,
  'a missing value never prints as "sin datos%"'
);

with evaluated as (
  select private.evaluate_trust_tier(
    null, null, null, null, null, null, null, null, null, null
  ) as result
),
requirements as (
  select string_agg(value, ' | ') as text
  from evaluated, jsonb_array_elements_text(result->'next_tier_requirements')
)
select is(
  (select text like '%valor actual: sin datos.%' from requirements),
  true,
  'a missing value reads as plain "sin datos"'
);

-- A shop with real numbers keeps them, with their units attached.
with evaluated as (
  select private.evaluate_trust_tier(
    45, 0, 0, 0, 0, 0, 0::bigint, null, 0::bigint, 40
  ) as result
),
requirements as (
  select string_agg(value, ' | ') as text
  from evaluated, jsonb_array_elements_text(result->'next_tier_requirements')
)
select is(
  (select text like '%valor actual: 0\%.%' from requirements),
  true,
  'a real zero rate keeps its percent sign'
);

with evaluated as (
  select private.evaluate_trust_tier(
    45, 0, 0, 0, 0, 0, 0::bigint, null, 0::bigint, 40
  ) as result
),
requirements as (
  select string_agg(value, ' | ') as text
  from evaluated, jsonb_array_elements_text(result->'next_tier_requirements')
)
select is(
  (select text like '%valor actual: 45 min.%' from requirements),
  true,
  'a reply time says what it is counted in'
);

with evaluated as (
  select private.evaluate_trust_tier(
    45, 0, 0, 0, 0, 0, 0::bigint, null, 0::bigint, 40
  ) as result
),
requirements as (
  select string_agg(value, ' | ') as text
  from evaluated, jsonb_array_elements_text(result->'next_tier_requirements')
)
select is(
  (select text like '%valor actual: 40 días.%' from requirements),
  true,
  'an activity gap says what it is counted in'
);

-- The thresholds themselves are untouched: the same inputs still qualify for
-- the same tier and the same listing limit.
select is(
  (private.evaluate_trust_tier(
    null, null, null, null, null, null, null, null, null, null
  )->>'trust_tier'),
  'Standard',
  'a shop with no evidence stays Standard'
);

select is(
  (private.evaluate_trust_tier(
    60, 97, 96, 95, 96, 1.0, 30::bigint, 4.7, 12::bigint, 5
  )->>'trust_tier'),
  'Reliable',
  'a qualifying shop still reaches Reliable'
);

select is(
  ((private.evaluate_trust_tier(
    60, 99, 99, 99, 99, 0.5, 120::bigint, 4.9, 60::bigint, 2
  )->>'free_listing_limit')::integer),
  100,
  'a Top Rated shop still gets its 100-listing limit'
);

select * from finish();

rollback;
