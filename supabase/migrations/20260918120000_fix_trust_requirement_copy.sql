-- The seller-facing requirement lines printed "valor actual: sin datos%." —
-- the unit was appended by the format string, so a missing value came out
-- wearing a percent sign it had no claim to. The unit now travels with the
-- value and disappears with it, and the reply-time and activity lines say
-- what their numbers are counted in.
--
-- Only the wording of `reasons`, `next_tier_requirements` and `summary`
-- changes. Every threshold, tier and listing limit is identical to
-- 20260820173555_add_shop_trust_tiers.sql, so no shop's tier or quota moves.
create or replace function private.evaluate_trust_tier(
  p_average_reply_time_minutes numeric,
  p_response_rate numeric,
  p_description_accuracy numeric,
  p_on_time_shipping_rate numeric,
  p_order_completion_rate numeric,
  p_dispute_rate numeric,
  p_total_orders bigint,
  p_average_rating numeric,
  p_review_count bigint,
  p_last_active_days_ago integer
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_top boolean;
  v_reliable boolean;
  v_tier text;
  v_limit integer;
  v_reasons text[] := array[]::text[];
  v_next text[] := array[]::text[];
  v_summary text;
  -- Each value carries its own unit, or says plainly that there is none.
  v_orders text := coalesce(p_total_orders::text, 'sin datos');
  v_accuracy text := coalesce(p_description_accuracy::text || '%', 'sin datos');
  v_disputes text := coalesce(p_dispute_rate::text || '%', 'sin datos');
  v_response text := coalesce(p_response_rate::text || '%', 'sin datos');
  v_shipping text := coalesce(p_on_time_shipping_rate::text || '%', 'sin datos');
  v_completion text := coalesce(p_order_completion_rate::text || '%', 'sin datos');
  v_reply text := coalesce(p_average_reply_time_minutes::text || ' min', 'sin datos');
  v_rating text := coalesce(p_average_rating::text, 'sin datos');
  v_active text := coalesce(p_last_active_days_ago::text || ' días', 'sin datos');
begin
  v_top := coalesce(
    p_total_orders >= 80
    and p_description_accuracy >= 97
    and p_dispute_rate <= 1.3
    and p_response_rate >= 96
    and p_on_time_shipping_rate >= 96
    and p_average_reply_time_minutes <= 120
    and p_order_completion_rate >= 98
    and p_review_count is not null
    and (p_review_count < 25 or (p_average_rating is not null and p_average_rating >= 4.8))
    and p_last_active_days_ago <= 14,
    false
  );

  v_reliable := coalesce(
    p_total_orders >= 25
    and p_description_accuracy >= 95
    and p_dispute_rate <= 2.5
    and p_response_rate >= 90
    and p_on_time_shipping_rate >= 92
    and p_average_reply_time_minutes <= 360
    and p_order_completion_rate >= 95
    and p_review_count is not null
    and (p_review_count < 10 or (p_average_rating is not null and p_average_rating >= 4.6))
    and p_last_active_days_ago <= 21,
    false
  );

  if v_top then
    v_tier := 'Top Rated'; v_limit := 100;
    v_reasons := array[
      format('Pedidos completados: %s; mínimo requerido: 80.', p_total_orders),
      format('Respuesta: %s%%; envíos puntuales: %s%%; disputas: %s%%.', p_response_rate, p_on_time_shipping_rate, p_dispute_rate)
    ];
    v_summary := 'La tienda alcanza Top Rated al cumplir todos los requisitos estrictos de rendimiento, servicio y actividad.';
  elsif v_reliable then
    v_tier := 'Reliable'; v_limit := 40;
    v_reasons := array[
      format('Pedidos completados: %s; mínimo Reliable: 25.', p_total_orders),
      format('Respuesta: %s%%; envíos puntuales: %s%%; disputas: %s%%.', p_response_rate, p_on_time_shipping_rate, p_dispute_rate)
    ];
    if p_total_orders is null or p_total_orders < 80 then v_next := array_append(v_next, format('Completa 80 pedidos; valor actual: %s.', v_orders)); end if;
    if p_description_accuracy is null or p_description_accuracy < 97 then v_next := array_append(v_next, format('Alcanza 97%% de precisión; valor actual: %s.', v_accuracy)); end if;
    if p_dispute_rate is null or p_dispute_rate > 1.3 then v_next := array_append(v_next, format('Reduce disputas a 1.3%% o menos; valor actual: %s.', v_disputes)); end if;
    if p_response_rate is null or p_response_rate < 96 then v_next := array_append(v_next, format('Alcanza 96%% de respuesta; valor actual: %s.', v_response)); end if;
    if p_on_time_shipping_rate is null or p_on_time_shipping_rate < 96 then v_next := array_append(v_next, format('Alcanza 96%% de envíos puntuales; valor actual: %s.', v_shipping)); end if;
    if p_average_reply_time_minutes is null or p_average_reply_time_minutes > 120 then v_next := array_append(v_next, format('Reduce respuesta promedio a 120 minutos; valor actual: %s.', v_reply)); end if;
    if p_order_completion_rate is null or p_order_completion_rate < 98 then v_next := array_append(v_next, format('Alcanza 98%% de pedidos completados; valor actual: %s.', v_completion)); end if;
    if p_review_count is null then v_next := array_append(v_next, 'Registra un conteo válido de reseñas.');
    elsif p_review_count >= 25 and (p_average_rating is null or p_average_rating < 4.8) then v_next := array_append(v_next, format('Alcanza calificación 4.8; valor actual: %s.', v_rating)); end if;
    if p_last_active_days_ago is null or p_last_active_days_ago > 14 then v_next := array_append(v_next, format('Mantén actividad dentro de 14 días; valor actual: %s.', v_active)); end if;
    v_summary := 'La tienda es Reliable y cumple todos los requisitos intermedios; puede avanzar cerrando las brechas indicadas.';
  else
    v_tier := 'Standard'; v_limit := 15;
    if p_total_orders is null or p_total_orders < 25 then v_next := array_append(v_next, format('Completa 25 pedidos; valor actual: %s.', v_orders)); end if;
    if p_description_accuracy is null or p_description_accuracy < 95 then v_next := array_append(v_next, format('Alcanza 95%% de precisión; valor actual: %s.', v_accuracy)); end if;
    if p_dispute_rate is null or p_dispute_rate > 2.5 then v_next := array_append(v_next, format('Reduce disputas a 2.5%% o menos; valor actual: %s.', v_disputes)); end if;
    if p_response_rate is null or p_response_rate < 90 then v_next := array_append(v_next, format('Alcanza 90%% de respuesta; valor actual: %s.', v_response)); end if;
    if p_on_time_shipping_rate is null or p_on_time_shipping_rate < 92 then v_next := array_append(v_next, format('Alcanza 92%% de envíos puntuales; valor actual: %s.', v_shipping)); end if;
    if p_average_reply_time_minutes is null or p_average_reply_time_minutes > 360 then v_next := array_append(v_next, format('Reduce respuesta promedio a 360 minutos; valor actual: %s.', v_reply)); end if;
    if p_order_completion_rate is null or p_order_completion_rate < 95 then v_next := array_append(v_next, format('Alcanza 95%% de pedidos completados; valor actual: %s.', v_completion)); end if;
    if p_review_count is null then v_next := array_append(v_next, 'Registra un conteo válido de reseñas.');
    elsif p_review_count >= 10 and (p_average_rating is null or p_average_rating < 4.6) then v_next := array_append(v_next, format('Alcanza calificación 4.6; valor actual: %s.', v_rating)); end if;
    if p_last_active_days_ago is null or p_last_active_days_ago > 21 then v_next := array_append(v_next, format('Mantén actividad dentro de 21 días; valor actual: %s.', v_active)); end if;
    v_reasons := case when cardinality(v_next) > 0 then v_next[1:least(3, cardinality(v_next))] else array['La tienda aún no cumple todos los requisitos de Reliable.'] end;
    v_summary := 'La tienda permanece en Standard mientras reúne evidencia suficiente para cumplir todos los requisitos de rendimiento.';
  end if;

  return jsonb_build_object(
    'trust_tier', v_tier,
    'free_listing_limit', v_limit,
    'reasons', to_jsonb(v_reasons),
    'next_tier_requirements', to_jsonb(v_next),
    'summary', v_summary
  );
end;
$$;

revoke execute on function private.evaluate_trust_tier(numeric,numeric,numeric,numeric,numeric,numeric,bigint,numeric,bigint,integer) from public, anon, authenticated;

-- Rollback: restore the function body from
-- 20260820173555_add_shop_trust_tiers.sql.
