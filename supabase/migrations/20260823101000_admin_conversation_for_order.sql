-- Administrators lost their direct read on conversations, so resolving a
-- dispute's order to its conversation needs a path of its own. This returns an
-- identifier and no content, so it is not the thing worth auditing; reading the
-- messages through read_conversation_as_admin is, and that still records.
create function public.admin_conversation_for_order(p_order_id bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501', message = 'Solo administración puede consultar esto.';
  end if;

  select id into v_id from public.conversations where order_id = p_order_id;

  return v_id;
end;
$$;

revoke all on function public.admin_conversation_for_order(bigint) from public, anon;
grant execute on function public.admin_conversation_for_order(bigint) to authenticated;

-- Rollback:
-- drop function public.admin_conversation_for_order(bigint);
