begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select has_schema(
  'private',
  'private schema exists for internal telemetry controls'
);
select has_table(
  'private',
  'telemetry_rate_limits',
  'telemetry rate-limit buckets exist outside the Data API schema'
);
select has_column(
  'private',
  'telemetry_rate_limits',
  'bucket_start',
  'rate-limit buckets record their minute'
);
select has_column(
  'private',
  'telemetry_rate_limits',
  'accepted_count',
  'rate-limit buckets count accepted telemetry'
);
select has_column(
  'private',
  'telemetry_rate_limits',
  'rejected_count',
  'rate-limit buckets count rejected telemetry'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anonymous callers cannot access the private schema directly'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated callers cannot access the private schema directly'
);
select ok(
  not has_table_privilege('anon', 'private.telemetry_rate_limits', 'select'),
  'anonymous callers cannot read rate-limit counters directly'
);
select ok(
  not has_table_privilege('authenticated', 'private.telemetry_rate_limits', 'select'),
  'authenticated callers cannot read rate-limit counters directly'
);

delete from private.telemetry_rate_limits;
delete from public.search_events;

set local role anon;

select throws_ok(
  $$select public.record_catalog_search('', 'es-MX', 'MX', null, 0)$$,
  '22023',
  'Search query must not be empty.',
  'invalid telemetry is rejected before consuming quota'
);

reset role;

select results_eq(
  $$select count(*) from private.telemetry_rate_limits$$,
  array[0::bigint],
  'invalid telemetry does not create a rate-limit bucket'
);

set local role anon;

select results_eq(
  $$select count(event_id)
    from (
      select public.record_catalog_search(
        format('quota test %s', item),
        'es-MX',
        'MX',
        null,
        0
      ) as event_id
      from generate_series(1, 300) as series(item)
    ) as accepted_calls$$,
  array[300::bigint],
  'the first 300 valid telemetry calls in a minute are accepted'
);

select is(
  public.record_catalog_search('quota overflow', 'es-MX', 'MX', null, 0),
  null::uuid,
  'telemetry beyond the minute quota is dropped without breaking search'
);

reset role;

select results_eq(
  $$select count(*) from public.search_events$$,
  array[300::bigint],
  'rate-limited telemetry does not create a search event'
);
select results_eq(
  $$select accepted_count
    from private.telemetry_rate_limits
    where bucket_start = date_trunc('minute', statement_timestamp())$$,
  array[300],
  'the current bucket records accepted telemetry accurately'
);
select results_eq(
  $$select rejected_count
    from private.telemetry_rate_limits
    where bucket_start = date_trunc('minute', statement_timestamp())$$,
  array[1],
  'the current bucket records dropped telemetry accurately'
);

select * from finish();
rollback;
