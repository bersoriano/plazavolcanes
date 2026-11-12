alter table public.products
  add column phone_battery_health integer,
  add column phone_carrier_status text,
  add column phone_repair_history text;

alter table public.products
  add constraint products_phone_battery_health_check
    check (phone_battery_health between 0 and 100),
  add constraint products_phone_carrier_status_check
    check (phone_carrier_status in ('unlocked', 'locked')),
  add constraint products_phone_repair_history_length_check
    check (char_length(phone_repair_history) <= 500);

create or replace function public.catalog_state_counts(p_country_code text)
returns table(administrative_area_code text, product_count bigint)
language sql stable security definer set search_path = ''
as $$
  select area_code, count(distinct p.id)
  from public.products p
  join public.shops s on s.id = p.shop_id
  cross join lateral unnest(coalesce(s.administrative_area_codes, '{}')) as area_code
  where p.status = 'published'
    and p.is_admin_enabled
    and s.is_publishing_approved
    and p.units_available > 0
    and p.expires_at > now()
    and (p_country_code is null or s.country_code = upper(p_country_code))
  group by area_code
  order by count(distinct p.id) desc, area_code;
$$;

revoke all on function public.catalog_state_counts(text) from public, anon;
grant execute on function public.catalog_state_counts(text) to anon, authenticated;

-- Opening the thread and writing its first question must succeed together.
-- Existing messaging functions retain their authorization and rate limits.
create function public.send_product_question(
  p_shop_id bigint,
  p_product_id bigint,
  p_body text,
  p_idempotency_key uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conversation_id bigint;
begin
  v_conversation_id := public.start_pre_sale_conversation(p_shop_id, p_product_id);
  perform public.send_conversation_message(v_conversation_id, p_body, p_idempotency_key);
  return v_conversation_id;
end;
$$;

revoke all on function public.send_product_question(bigint, bigint, text, uuid) from public, anon;
grant execute on function public.send_product_question(bigint, bigint, text, uuid) to authenticated;
