-- Expand existing counts; legacy views remain intact. New denominators start
-- with this collector and never pretend historical CTA activity existed.
alter table private.product_view_days
  add column tracked_views integer not null default 0 check (tracked_views >= 0),
  add column interests integer not null default 0 check (interests >= 0 and interests <= tracked_views),
  add column question_clicks integer not null default 0 check (question_clicks >= 0),
  add column purchase_clicks integer not null default 0 check (purchase_clicks >= 0),
  add column share_clicks integer not null default 0 check (share_clicks >= 0);

create table private.product_activity_sessions (
  product_id bigint not null references public.products(id) on delete cascade,
  session_id uuid not null,
  day date not null default (now() at time zone 'America/Mexico_City')::date,
  created_at timestamptz not null default now(),
  actions text[] not null default '{}',
  primary key (product_id, session_id)
);
create index product_activity_sessions_created_idx on private.product_activity_sessions(created_at);
alter table private.product_activity_sessions enable row level security;
revoke all on private.product_activity_sessions from public, anon, authenticated;

create table private.product_activity_limits (
  product_id bigint not null references public.products(id) on delete cascade,
  minute timestamptz not null,
  accepted integer not null check (accepted between 1 and 300),
  primary key(product_id, minute)
);
alter table private.product_activity_limits enable row level security;
revoke all on private.product_activity_limits from public, anon, authenticated;

create table private.product_activity_settings (
  singleton boolean primary key default true check (singleton),
  started_at timestamptz not null default now()
);
insert into private.product_activity_settings default values;
alter table private.product_activity_settings enable row level security;
revoke all on private.product_activity_settings from public, anon, authenticated;

-- Anonymous writes intentionally cross the private-table boundary. Narrow
-- definer functions have an empty search path and validate public visibility;
-- reporting below additionally proves authenticated ownership in the database.
create function public.record_product_activity(p_product_id bigint, p_action text, p_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actions text[];
  v_day date;
  v_view integer;
  v_interest integer;
  v_quota boolean;
begin
  if p_action is null or p_action not in ('view','question','purchase','share')
     or p_session_id is null or p_session_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode='22023', message='Actividad no válida.';
  end if;
  if not exists (
    select 1 from public.products p join public.shops s on s.id=p.shop_id
    where p.id=p_product_id and p.status='published' and p.is_admin_enabled
      and s.is_publishing_approved and s.owner_id is distinct from auth.uid()
  ) then return false; end if;

  insert into private.product_activity_limits as lim(product_id,minute,accepted)
    values(p_product_id,date_trunc('minute',statement_timestamp()),1)
    on conflict(product_id,minute) do update set accepted=lim.accepted+1
    where lim.accepted<300 returning true into v_quota;
  if not coalesce(v_quota,false) then return false; end if;

  insert into private.product_activity_sessions(product_id,session_id)
    values(p_product_id,p_session_id) on conflict do nothing;
  select actions,day into v_actions,v_day from private.product_activity_sessions
    where product_id=p_product_id and session_id=p_session_id for update;
  if p_action=any(v_actions) then return true; end if;
  v_view := case when 'view'=any(v_actions) then 0 else 1 end;
  v_interest := case when p_action in ('question','purchase')
    and not (v_actions && array['question','purchase']) then 1 else 0 end;
  update private.product_activity_sessions set actions=array_append(array_append(v_actions,'view'),p_action)
    where product_id=p_product_id and session_id=p_session_id;
  insert into private.product_view_days as totals(product_id,day,views,tracked_views)
    values(p_product_id,v_day,v_view,v_view)
    on conflict(product_id,day) do update set
      views=totals.views+excluded.views, tracked_views=totals.tracked_views+excluded.tracked_views;
  update private.product_view_days set
    interests=interests+v_interest,question_clicks=question_clicks+(p_action='question')::integer,
    purchase_clicks=purchase_clicks+(p_action='purchase')::integer,share_clicks=share_clicks+(p_action='share')::integer
    where product_id=p_product_id and day=v_day;
  return true;
end;
$$;
revoke all on function public.record_product_activity(bigint,text,uuid) from public;
grant execute on function public.record_product_activity(bigint,text,uuid) to anon,authenticated;

create function private.prune_product_activity() returns void
language sql security definer set search_path='' as $$
  delete from private.product_activity_sessions where created_at<now()-interval '2 days';
  delete from private.product_activity_limits where minute<now()-interval '1 day';
$$;
revoke all on function private.prune_product_activity() from public,anon,authenticated;
select cron.schedule('plaza-product-activity-retention','20 * * * *','select private.prune_product_activity()');

create function public.seller_product_analytics(p_days integer default 30,p_shop_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_owner uuid := auth.uid();
  v_today date := (now() at time zone 'America/Mexico_City')::date;
  v_start date;
  v_before date;
  v_empty jsonb := '{"views":0,"tracked_views":0,"interests":0,"question_clicks":0,"purchase_clicks":0,"share_clicks":0,"questions":0,"orders":0}';
  v_result jsonb;
begin
  if v_owner is null then raise exception using errcode='42501',message='Ingresa para ver tus estadísticas.'; end if;
  if p_days is null or p_days not in (7,30,90) then
    raise exception using errcode='22023',message='Periodo no válido.';
  end if;
  if p_shop_id is not null and not exists(select 1 from public.shops where id=p_shop_id and owner_id=v_owner) then
    raise exception using errcode='42501',message='No puedes ver las estadísticas de esa tienda.';
  end if;
  v_start := v_today-p_days+1;
  v_before := v_start-p_days;

  with owned as materialized (
    select id,name from public.shops where owner_id=v_owner
  ), products as materialized (
    select p.id,p.shop_id,p.name,p.slug,p.status,s.name shop_name
    from public.products p join owned s on s.id=p.shop_id
    where p_shop_id is null or p.shop_id=p_shop_id
  ), inquiries as materialized (
    select c.product_id,(c.created_at at time zone 'America/Mexico_City')::date as day
    from public.conversations c join products p on p.id=c.product_id
    where c.type='pre_sale' and c.created_at >= (v_before::timestamp at time zone 'America/Mexico_City')
      and c.created_at < ((v_today+1)::timestamp at time zone 'America/Mexico_City')
  ), requests as materialized (
    select distinct i.product_id,i.order_id,(o.created_at at time zone 'America/Mexico_City')::date as day
    from public.order_items i join public.orders o on o.id=i.order_id join products p on p.id=i.product_id
    where o.created_at >= (v_before::timestamp at time zone 'America/Mexico_City')
      and o.created_at < ((v_today+1)::timestamp at time zone 'America/Mexico_City')
  ), activity as (
    select v.product_id,v.day,v.views::bigint,v.tracked_views::bigint,v.interests::bigint,
      v.question_clicks::bigint,v.purchase_clicks::bigint,v.share_clicks::bigint,0::bigint questions,0::bigint orders
    from private.product_view_days v join products p on p.id=v.product_id where v.day between v_before and v_today
    union all select product_id,day,0,0,0,0,0,0,count(*),0 from inquiries group by product_id,day
    union all select product_id,day,0,0,0,0,0,0,0,count(distinct order_id) from requests group by product_id,day
  ), metrics as materialized (
    select product_id,case when day>=v_start then 'current' else 'previous' end period,
      sum(views) views,sum(tracked_views) tracked_views,sum(interests) interests,
      sum(question_clicks) question_clicks,sum(purchase_clicks) purchase_clicks,sum(share_clicks) share_clicks,
      sum(questions) questions,sum(orders) orders
    from activity group by product_id,case when day>=v_start then 'current' else 'previous' end
  ), totals as (
    select periods.period,coalesce(sum(m.views),0) views,coalesce(sum(m.tracked_views),0) tracked_views,
      coalesce(sum(m.interests),0) interests,coalesce(sum(m.question_clicks),0) question_clicks,
      coalesce(sum(m.purchase_clicks),0) purchase_clicks,coalesce(sum(m.share_clicks),0) share_clicks,
      coalesce(sum(m.questions),0) questions,
      (select count(distinct r.order_id) from requests r where (r.day>=v_start)=(periods.period='current')) orders
    from (values('current'),('previous')) periods(period) left join metrics m on m.period=periods.period group by periods.period
  ), daily as (
    select calendar.day::date as day,coalesce(sum(a.views),0) views,coalesce(sum(a.tracked_views),0) tracked_views,
      coalesce(sum(a.interests),0) interests,coalesce(sum(a.question_clicks),0) question_clicks,
      coalesce(sum(a.purchase_clicks),0) purchase_clicks,coalesce(sum(a.share_clicks),0) share_clicks,
      coalesce(sum(a.questions),0) questions,(select count(distinct r.order_id) from requests r where r.day=calendar.day::date) orders
    from generate_series(v_start::timestamp,v_today::timestamp,interval '1 day') calendar(day)
    left join activity a on a.day=calendar.day::date group by calendar.day
  )
  select jsonb_build_object(
    'shops',coalesce((select jsonb_agg(to_jsonb(s) order by s.name,s.id) from owned s),'[]'::jsonb),
    'current',(select to_jsonb(t)-'period' from totals t where period='current'),
    'previous',(select to_jsonb(t)-'period' from totals t where period='previous'),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from daily d),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'shop_id',p.shop_id,'shop_name',p.shop_name,'name',p.name,'slug',p.slug,'status',p.status,
      'current',coalesce((select to_jsonb(m)-'product_id'-'period' from metrics m where m.product_id=p.id and m.period='current'),v_empty),
      'previous',coalesce((select to_jsonb(m)-'product_id'-'period' from metrics m where m.product_id=p.id and m.period='previous'),v_empty)
    ) order by p.id) from products p),'[]'::jsonb),
    'tracking_started_at',(select started_at from private.product_activity_settings),
    'start_day',v_start,'end_day',v_today
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.seller_product_analytics(integer,bigint) from public,anon;
grant execute on function public.seller_product_analytics(integer,bigint) to authenticated;

-- Rollback (only after reverting application callers): drop the two public
-- RPCs, unschedule plaza-product-activity-retention, drop prune function and
-- new private tables. Keep daily columns/totals to preserve collected history.
