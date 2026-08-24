-- Pre-sale threads accumulate from browsing rather than from buying, so they
-- age out. Order conversations never do: disputes and reviews depend on them.
create function private.purge_idle_pre_sale_conversations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from public.conversations
  where type = 'pre_sale' and updated_at < now() - interval '180 days';

  if array_length(v_ids, 1) is null then return; end if;

  -- Every foreign key onto these tables is on delete restrict, so the deletes
  -- go in dependency order inside one transaction.
  delete from public.conversation_reads where conversation_id = any (v_ids);
  delete from public.messages where conversation_id = any (v_ids);
  delete from public.conversations where id = any (v_ids);
end;
$$;

revoke execute on function private.purge_idle_pre_sale_conversations()
from public, anon, authenticated;

create function private.run_messaging_maintenance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.purge_idle_pre_sale_conversations();
  perform private.prune_message_rate_limits();
end;
$$;

revoke execute on function private.run_messaging_maintenance() from public, anon, authenticated;

select cron.schedule(
  'messaging-presale-purge',
  '30 3 * * *',
  $$select private.run_messaging_maintenance()$$
);

-- Realtime delivery. Change events are filtered by the participant policy on
-- public.messages, so publishing this table adds no read surface.
alter publication supabase_realtime add table public.messages;

-- Rollback:
-- alter publication supabase_realtime drop table public.messages;
-- select cron.unschedule('messaging-presale-purge');
-- drop function private.run_messaging_maintenance();
-- drop function private.purge_idle_pre_sale_conversations();
