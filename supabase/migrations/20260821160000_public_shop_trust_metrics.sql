-- Buyers should see what the plaza measures for every shop. The evaluation table stays
-- owner-only; this function is the single public door, and it lists its columns by hand
-- so seller-facing text (reasons, next_tier_requirements, summary) can never leak, nor
-- can any column added to that table later.
create or replace function public.shop_public_trust_metrics(p_shop_id bigint)
returns table(
  average_reply_time_minutes numeric,
  response_rate numeric,
  description_accuracy numeric,
  on_time_shipping_rate numeric,
  order_completion_rate numeric,
  dispute_rate numeric,
  total_orders bigint,
  average_rating numeric,
  review_count bigint,
  last_active_days_ago integer,
  evaluated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    evaluations.average_reply_time_minutes,
    evaluations.response_rate,
    evaluations.description_accuracy,
    evaluations.on_time_shipping_rate,
    evaluations.order_completion_rate,
    evaluations.dispute_rate,
    evaluations.total_orders,
    evaluations.average_rating,
    evaluations.review_count,
    evaluations.last_active_days_ago,
    evaluations.evaluated_at
  from public.shop_trust_evaluations as evaluations
  where evaluations.shop_id = p_shop_id
  order by evaluations.evaluated_at desc, evaluations.id desc
  limit 1;
$$;

revoke execute on function public.shop_public_trust_metrics(bigint) from public;
grant execute on function public.shop_public_trust_metrics(bigint) to anon, authenticated;

-- Rollback:
-- drop function public.shop_public_trust_metrics(bigint);
