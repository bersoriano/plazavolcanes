begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id,email,created_at) values
 ('51000000-0000-4000-8000-000000000001','seller-metrics@test.local',now()),
 ('51000000-0000-4000-8000-000000000002','other-metrics@test.local',now());
insert into public.shops (id,owner_id,name,slug,description) overriding system value values
 (9501,'51000000-0000-4000-8000-000000000001','Métricas','metricas','Descripción de la tienda suficientemente larga.'),
 (9502,'51000000-0000-4000-8000-000000000002','Otra','metricas-otra','Descripción de la tienda suficientemente larga.');
update public.shops set is_publishing_approved=true where id in (9501,9502);
alter table public.products disable trigger enforce_product_cover_on_publish;
insert into public.products (id,shop_id,name,slug,description,price_mxn,status,is_admin_enabled,category_id)
overriding system value values
 (95011,9501,'Taza','metricas-taza','Descripción de la taza suficientemente larga.',100,'published',true,(select id from public.categories where slug='celulares-y-accesorios')),
 (95012,9501,'Borrador','metricas-borrador','Descripción del producto suficientemente larga.',100,'draft',true,(select id from public.categories where slug='celulares-y-accesorios')),
 (95021,9502,'Ajeno','metricas-ajeno','Descripción del producto suficientemente larga.',100,'published',true,(select id from public.categories where slug='celulares-y-accesorios'));

set local role anon;
select lives_ok($$select public.record_product_activity(95011,'view','61000000-0000-4000-8000-000000000001')$$,'public views can be measured');
select lives_ok($$select public.record_product_activity(95011,'view','61000000-0000-4000-8000-000000000001')$$,'replayed view is safe');
select public.record_product_activity(95011,'question','61000000-0000-4000-8000-000000000001');
select public.record_product_activity(95011,'question','61000000-0000-4000-8000-000000000001');
select public.record_product_activity(95011,'purchase','61000000-0000-4000-8000-000000000001');
select public.record_product_activity(95011,'share','61000000-0000-4000-8000-000000000001');
select public.record_product_activity(95012,'view','61000000-0000-4000-8000-000000000002');
select throws_ok($$select public.record_product_activity(95011,'email','61000000-0000-4000-8000-000000000001')$$,'22023',null,'unknown actions are rejected');
select throws_ok($$select public.seller_product_analytics(30,null)$$,'42501',null,'anonymous callers cannot read reports');
select throws_ok($$select * from private.product_activity_sessions$$,'42501',null,'session identifiers are never public');

set local role authenticated;
set local request.jwt.claims='{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.record_product_activity(95011,'view','61000000-0000-4000-8000-000000000003');
select is((public.seller_product_analytics(30,9501)#>>'{current,views}')::int,1,'replays and owner visits do not count');
select is((public.seller_product_analytics(30,9501)#>>'{current,tracked_views}')::int,1,'tracked denominator counts one session');
select is((public.seller_product_analytics(30,9501)#>>'{current,interests}')::int,1,'question and purchase in one session mean one interested session');
select is((public.seller_product_analytics(30,9501)#>>'{current,question_clicks}')::int,1,'repeated CTA does not inflate totals');
select is((public.seller_product_analytics(30,9501)#>>'{current,purchase_clicks}')::int,1,'purchase intent has its own count');
select is((public.seller_product_analytics(30,9501)#>>'{current,share_clicks}')::int,1,'sharing is counted separately');
select is((public.seller_product_analytics(30,9501)#>>'{current,orders}')::int,0,'clicking purchase is not an order');
select is(jsonb_array_length(public.seller_product_analytics(7,null)->'daily'),7,'daily series includes zero days');
select is(jsonb_array_length(public.seller_product_analytics(90,null)->'daily'),90,'ninety-day window is supported');
select throws_ok($$select public.seller_product_analytics(30,9502)$$,'42501',null,'seller cannot choose another shop');
select throws_ok($$select public.seller_product_analytics(365,null)$$,'22023',null,'unsupported date windows are rejected');
select is(jsonb_array_length(public.seller_product_analytics(30,null)->'shops'),1,'all-shops scope includes only owned shops');

reset role;
insert into private.product_view_days (product_id,day,views) values
 (95011,(now() at time zone 'America/Mexico_City')::date-7,12);
set local role authenticated;
set local request.jwt.claims='{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((public.seller_product_analytics(7,9501)#>>'{previous,views}')::int,12,'previous period is nonoverlapping');
select is((public.seller_product_analytics(30,9501)#>>'{current,views}')::int,13,'historical views remain available');
select is((public.seller_product_analytics(30,9501)#>>'{current,tracked_views}')::int,1,'legacy views do not dilute interest rate');
select ok(public.seller_product_analytics(30,9501)->>'tracking_started_at' is not null,'report declares when CTA measurement began');

set local role anon;
set local request.jwt.claims='{"role":"anon"}';
select public.record_product_activity(95011,'share','61000000-0000-4000-8000-000000000004');
reset role;
select is((select interests from private.product_view_days where product_id=95011 and day=(now() at time zone 'America/Mexico_City')::date),1,'sharing alone is not purchase interest');
select public.record_product_activity(95011,'view','61000000-0000-4000-8000-000000000005');
update private.product_activity_sessions set day=day-1 where product_id=95011 and session_id='61000000-0000-4000-8000-000000000005';
insert into private.product_view_days(product_id,day,views,tracked_views) values(95011,(now() at time zone 'America/Mexico_City')::date-1,1,1);
update private.product_view_days set views=views-1,tracked_views=tracked_views-1 where product_id=95011 and day=(now() at time zone 'America/Mexico_City')::date;
select public.record_product_activity(95011,'purchase','61000000-0000-4000-8000-000000000005');
select is((select interests from private.product_view_days where product_id=95011 and day=(now() at time zone 'America/Mexico_City')::date-1),1,'a session crossing midnight keeps its view-day attribution');

-- A multi-product request is one order in the overview and one for each row.
insert into public.orders(id,buyer_id,shop_id,idempotency_key,currency_code,subtotal,handling_days,handling_time_zone,fulfillment_method)
overriding system value values(950001,'51000000-0000-4000-8000-000000000002',9501,gen_random_uuid(),'MXN',200,1,'America/Mexico_City','pickup');
insert into public.order_items(id,order_id,product_id,product_name,unit_price,currency_code,quantity,line_total,handling_days)
overriding system value values(9500011,950001,95011,'Taza',100,'MXN',1,100,1),(9500012,950001,95012,'Borrador',100,'MXN',1,100,1);
set local role authenticated;
set local request.jwt.claims='{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((public.seller_product_analytics(30,9501)#>>'{current,orders}')::int,1,'overview deduplicates multi-product orders');
select is((select sum((product#>>'{current,orders}')::int)::int from jsonb_array_elements(public.seller_product_analytics(30,9501)->'products') product),2,'each included product retains its own order count');

reset role;
update private.product_activity_limits set accepted=300 where product_id=95011 and minute=date_trunc('minute',statement_timestamp());
select is(public.record_product_activity(95011,'view','61000000-0000-4000-8000-000000000006'),false,'excess telemetry is dropped without breaking browsing');
select is((select count(*) from private.product_activity_sessions where session_id='61000000-0000-4000-8000-000000000006'),0::bigint,'rate-limited writes do not retain sessions');
update private.product_activity_sessions set created_at=now()-interval '3 days' where product_id=95011;
select private.prune_product_activity();
select is((select count(*) from private.product_activity_sessions where product_id=95011),0::bigint,'short-lived tokens are purged');
select ok((select sum(views)>0 from private.product_view_days where product_id=95011),'purging session tokens retains daily totals');

reset role;
select * from finish();
rollback;
