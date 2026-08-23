-- Pre-sale conversations had no interface until the messaging system shipped,
-- so no pre-sale message ever reached this trigger. Opening that surface would
-- have quietly changed what the published seller response metric measures, and
-- would have let anyone drag a shop's response rate down by opening threads
-- they never intended to buy from.
--
-- The buyer-side clocks added by the buyer trust system were already scoped to
-- order conversations. This brings the seller side to the same scope, so both
-- halves of the metric now agree on what they measure.
--
-- Based on the body in 20260820191826_add_buyer_trust_system.sql, which is the
-- current one. The only changes are the two type guards.
create or replace function private.record_message_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_owner_id uuid;
  v_event_id bigint;
  v_elapsed integer;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  select owner_id into v_owner_id from public.shops where id = v_conversation.shop_id;

  if new.sender_id = v_conversation.buyer_id and new.sender_id <> v_owner_id then
    if v_conversation.type = 'order' then
      insert into public.seller_response_events (
        conversation_id, shop_id, triggering_buyer_message_id, clock_started_at
      ) values (new.conversation_id, v_conversation.shop_id, new.id, new.created_at)
      on conflict (conversation_id) where replied_at is null do nothing;

      select id, greatest(0, floor(extract(epoch from (new.created_at - clock_started_at)) / 60)::integer)
      into v_event_id, v_elapsed
      from public.buyer_response_events
      where conversation_id = new.conversation_id and replied_at is null
      order by clock_started_at
      limit 1
      for update;

      if v_event_id is not null then
        update public.buyer_response_events
        set closing_buyer_message_id = new.id,
            replied_at = new.created_at,
            elapsed_minutes = v_elapsed,
            answered_within_24_hours = v_elapsed <= 1440
        where id = v_event_id;
      end if;
      perform private.record_buyer_activity(
        v_conversation.buyer_id, v_conversation.order_id, 'buyer_message', 'message', new.id, new.created_at
      );
    end if;
  elsif new.sender_id = v_owner_id then
    if v_conversation.type = 'order' then
      select id, greatest(0, floor(extract(epoch from (new.created_at - clock_started_at)) / 60)::integer)
      into v_event_id, v_elapsed
      from public.seller_response_events
      where conversation_id = new.conversation_id and replied_at is null
      order by clock_started_at
      limit 1
      for update;

      if v_event_id is not null then
        update public.seller_response_events
        set closing_seller_message_id = new.id,
            replied_at = new.created_at,
            elapsed_minutes = v_elapsed,
            answered_within_24_hours = v_elapsed <= 1440
        where id = v_event_id;
      end if;

      insert into public.buyer_response_events (
        conversation_id, order_id, buyer_id, triggering_seller_message_id, clock_started_at
      ) values (
        new.conversation_id, v_conversation.order_id, v_conversation.buyer_id, new.id, new.created_at
      )
      on conflict (conversation_id) where replied_at is null do nothing;

      perform private.record_seller_activity(v_conversation.shop_id, new.sender_id, 'seller_message', 'message', new.id);
    end if;
  end if;

  -- The bump drives inbox ordering and applies to every conversation type.
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

-- Rollback: restore the body from 20260820191826_add_buyer_trust_system.sql,
-- which measures seller responsiveness in every conversation type.
