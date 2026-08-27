# Three-Column Solicitud de Compra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-column cart page with a three-column *Solicitud de compra* where the buyer must choose between recolección and envío, and where the item-scoped message thread and the shop's information sit beside the order.

**Architecture:** Two additive migrations add a `shop_pickup_points` table gated by a security-definer reader, and a `fulfillment_method` plus alternate contact on `orders` behind `checkout_cart_v3`. The page becomes a server component composing four new client/server components, one per panel, so the current single-line 4000-character page file stops being one unit.

**Tech Stack:** Next.js 16.3.1 (App Router, server components, server actions), React 19.2.8, Supabase (`@supabase/ssr` 0.12.4, `supabase-js` 2.112.3), Zod 4.4.3, Tailwind 4, Vitest + Testing Library, Playwright 1.62.1, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-27-checkout-three-column-fulfillment-design.md`

## Global Constraints

- **This is not the Next.js you know.** Before writing any component or route code, read the relevant guide in `node_modules/next/dist/docs/`. `AGENTS.md` requires it; APIs and conventions differ from training data.
- **Copy is Spanish (Mexico).** Every user-facing string, error message and database exception. No English in the UI.
- Money is `numeric(14,2)` in SQL and `formatMxn` / `formatCurrency` in TypeScript. No floating point.
- Every new SQL function is `security definer`, `set search_path = ''`, `revoke ... from public, anon` (or `from public` where `anon` is intended to call it), `grant execute ... to authenticated`. Copy the shape of `public.checkout_cart_v2`.
- Migrations are created with `npx supabase migration new <name>` — **never** a hand-invented filename. Local database only; the linked remote project is never reset.
- `lib/database.types.ts` is **hand-written**, not generated. Every schema change is mirrored there by hand in the same task.
- Existing style: components use `Field`, `Button`, `useFormAction`, `ActionState`. Server actions live in `lib/actions/`, server-only queries in `lib/queries/*.server.ts`.
- Commands: `npm test` (Vitest), `npx supabase test db` (pgTAP), `npm run test:e2e` (Playwright), `npm run lint`, `npm run typecheck`.
- Never add a `pickup_enabled` boolean. The existence of a `shop_pickup_points` row is the flag.

---

### Task 1: `shop_pickup_points` table and its gated reader

**Files:**
- Create: `supabase/migrations/<timestamp>_add_shop_pickup_points.sql` (via `npx supabase migration new add_shop_pickup_points`)
- Create: `supabase/tests/database/shop_pickup_points.test.sql`
- Modify: `lib/database.types.ts` (add the table Row/Insert/Update and the function signature)

**Interfaces:**
- Consumes: nothing.
- Produces: table `public.shop_pickup_points (shop_id bigint pk, address_line1 text, locality text, administrative_area_code text, postal_code text, notes text, created_at, updated_at)`; function `public.shop_pickup_point(p_shop_id bigint) returns jsonb`, returning `null`, or `{"locality","administrative_area_code"}`, or that plus `{"address_line1","postal_code","notes"}`. TypeScript: `Database["public"]["Tables"]["shop_pickup_points"]` and `Database["public"]["Functions"]["shop_pickup_point"]` with `Args: { p_shop_id: number }; Returns: Json`.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/database/shop_pickup_points.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'stranger@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code)
overriding system value
values (910, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Recoge', 'tienda-recoge',
  'Descripción completa de la tienda que ofrece recolección.', 'MX');

insert into public.shop_pickup_points
  (shop_id, address_line1, locality, administrative_area_code, postal_code, notes)
values (910, 'Av. Vallarta 1234', 'Zapopan', 'MX-JAL', '45010', 'Portón verde');

-- An order that has not been accepted yet, and one that has.
insert into public.orders
  (id, buyer_id, shop_id, idempotency_key, currency_code, subtotal, handling_days,
   handling_time_zone, status)
overriding system value
values
  (910, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 910, gen_random_uuid(), 'MXN', 250, 1,
   'America/Mexico_City', 'requested');

-- 1. The owner sees the whole address.
set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'address_line1',
  'Av. Vallarta 1234',
  'the shop owner reads the full pickup address'
);

select is(
  public.shop_pickup_point(910) ->> 'notes',
  'Portón verde',
  'the shop owner reads the pickup notes'
);

-- 2. A buyer whose order is still requested sees only city and state.
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'locality',
  'Zapopan',
  'a buyer with a pending request sees the locality'
);

select ok(
  public.shop_pickup_point(910) -> 'address_line1' is null,
  'a buyer with a pending request does not see the street'
);

-- 3. Once the seller accepts, the street appears and stays through completion.
set local role postgres;
update public.orders set status = 'accepted', accepted_at = now() where id = 910;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'address_line1',
  'Av. Vallarta 1234',
  'the street appears once the order is accepted'
);

set local role postgres;
update public.orders set status = 'completed', completed_at = now() where id = 910;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  public.shop_pickup_point(910) ->> 'address_line1',
  'Av. Vallarta 1234',
  'the street is still readable on a completed order'
);

-- 4. A signed-in stranger gets the coarse form only.
set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select ok(
  public.shop_pickup_point(910) -> 'address_line1' is null
    and public.shop_pickup_point(910) ->> 'locality' = 'Zapopan',
  'an unrelated signed-in user sees only city and state'
);

-- 5. Reading the table directly returns nothing to a buyer.
select is_empty(
  $$select shop_id from public.shop_pickup_points$$,
  'a buyer reads no rows from the table itself'
);

-- 6. The area code must belong to the shop's country.
set local role postgres;
select throws_ok(
  $$insert into public.shop_pickup_points
      (shop_id, address_line1, locality, administrative_area_code, postal_code)
    values (910, 'Otra calle 1', 'Toluca', 'US-CA', '50000')$$,
  'P0001',
  null,
  'a pickup point in another country is refused'
);

-- 7. The regression the column-revoke design would have caused.
set local role anon;
select lives_ok(
  $$select * from public.shops where id = 910$$,
  'select * on shops still works for anonymous callers'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — `relation "public.shop_pickup_points" does not exist`. The fixture deliberately does not set `fulfillment_method`; that column arrives in Task 2, and the reveal gate does not depend on it.

- [ ] **Step 3: Create the migration**

Run: `npx supabase migration new add_shop_pickup_points`

Write into the generated file:

```sql
-- A shop that offers collection needs a real address, and that address is a
-- seller's home or workshop. It lives in its own table rather than in columns on
-- `shops` for two reasons: `shops` is read with `select *` in getPublicShop and on
-- the seller's manage page, and Postgres checks column privileges through the
-- star, so withholding a column there would break both queries for every shop.
-- And the sensitivity is per row — one shop, one pickup point — which is exactly
-- what row-level security is for.
create table public.shop_pickup_points (
  shop_id bigint primary key references public.shops (id) on delete cascade,
  address_line1 text not null,
  locality text not null,
  administrative_area_code text not null,
  postal_code text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The row's existence is the flag: a shop offers collection exactly when it has
-- one. Every field but the notes is required, so a half-filled address cannot be
-- stored and no cross-table completeness check is needed.
alter table public.shop_pickup_points
  add constraint shop_pickup_points_area_format_check
    check (administrative_area_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'),
  add constraint shop_pickup_points_postal_code_check
    check (postal_code ~ '^[0-9]{5}$'),
  add constraint shop_pickup_points_notes_length_check
    check (notes is null or length(notes) <= 500),
  add constraint shop_pickup_points_address_line1_length_check
    check (length(btrim(address_line1)) between 3 and 200),
  add constraint shop_pickup_points_locality_length_check
    check (length(btrim(locality)) between 2 and 120);

-- A check constraint cannot read another table, so the country agreement is a
-- trigger. Without it a shop in Jalisco could advertise collection in MX-YUC or,
-- worse, in another country entirely.
create function private.check_pickup_point_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country text;
begin
  select country_code into v_country from public.shops where id = new.shop_id;
  if v_country is null then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;
  if new.administrative_area_code not like v_country || '-%' then
    raise exception using errcode = 'P0001',
      message = 'El estado de recolección debe pertenecer al país de la tienda.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.check_pickup_point_country() from public, anon, authenticated;

create trigger shop_pickup_points_country_check
before insert or update on public.shop_pickup_points
for each row execute function private.check_pickup_point_country();

alter table public.shop_pickup_points enable row level security;

grant select, insert, update, delete on table public.shop_pickup_points to authenticated;
grant select, insert, update, delete on table public.shop_pickup_points to service_role;

-- The only policy. Buyers never read this table directly; they go through
-- shop_pickup_point below, which is what keeps the reveal gate in one place.
create policy "owners_manage_pickup_point"
  on public.shop_pickup_points for all
  to authenticated
  using (
    exists (
      select 1 from public.shops s
      where s.id = shop_pickup_points.shop_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.shops s
      where s.id = shop_pickup_points.shop_id and s.owner_id = (select auth.uid())
    )
  );

-- That a shop offers collection in Zapopan, Jalisco is storefront information.
-- The street is not, until the seller has accepted the order that will be
-- collected. A buyer whose request is still pending gets the coarse form, and so
-- does everybody else.
create function public.shop_pickup_point(p_shop_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_point public.shop_pickup_points%rowtype;
  v_user uuid := auth.uid();
  v_full boolean := false;
begin
  select * into v_point from public.shop_pickup_points where shop_id = p_shop_id;
  if v_point.shop_id is null then return null; end if;

  if v_user is not null then
    v_full := exists (
      select 1 from public.shops s
      where s.id = p_shop_id and s.owner_id = v_user
    ) or exists (
      select 1 from public.orders o
      where o.shop_id = p_shop_id
        and o.buyer_id = v_user
        and o.status in ('accepted', 'shipped', 'delivered', 'completed')
    );
  end if;

  if v_full then
    return jsonb_build_object(
      'locality', v_point.locality,
      'administrative_area_code', v_point.administrative_area_code,
      'address_line1', v_point.address_line1,
      'postal_code', v_point.postal_code,
      'notes', v_point.notes
    );
  end if;

  return jsonb_build_object(
    'locality', v_point.locality,
    'administrative_area_code', v_point.administrative_area_code
  );
end;
$$;

revoke all on function public.shop_pickup_point(bigint) from public;
grant execute on function public.shop_pickup_point(bigint) to anon, authenticated;

-- Rollback:
-- drop function public.shop_pickup_point(bigint);
-- drop trigger shop_pickup_points_country_check on public.shop_pickup_points;
-- drop function private.check_pickup_point_country();
-- drop table public.shop_pickup_points;
```

- [ ] **Step 4: Mirror the schema in the hand-written types**

In `lib/database.types.ts`, inside `Database["public"]["Tables"]`, add alongside the other tables:

```ts
      shop_pickup_points: {
        Row: { shop_id: number; address_line1: string; locality: string; administrative_area_code: string; postal_code: string; notes: string | null; created_at: string; updated_at: string };
        Insert: { shop_id: number; address_line1: string; locality: string; administrative_area_code: string; postal_code: string; notes?: string | null; created_at?: string; updated_at?: string };
        Update: { shop_id?: number; address_line1?: string; locality?: string; administrative_area_code?: string; postal_code?: string; notes?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
```

And inside `Database["public"]["Functions"]`:

```ts
      shop_pickup_point: { Args: { p_shop_id: number }; Returns: Json };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS, 10 of 10 in `shop_pickup_points.test.sql`, and no other test file regressing.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations supabase/tests/database/shop_pickup_points.test.sql lib/database.types.ts
git commit -m "feat(db): give a shop a pickup point buyers see only once accepted"
```

---

### Task 2: `fulfillment_method`, alternate contact, and `checkout_cart_v3`

**Files:**
- Create: `supabase/migrations/<timestamp>_add_order_fulfillment_method.sql` (via `npx supabase migration new add_order_fulfillment_method`)
- Create: `supabase/tests/database/order_fulfillment.test.sql`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Consumes: Task 1's table, only so the pgTAP fixture can create a pickup shop.
- Produces: `orders.fulfillment_method: "pickup" | "shipping"`, `orders.alt_contact_name / alt_contact_phone / alt_contact_note: string | null`; function `public.checkout_cart_v3(p_shop_id bigint, p_fulfillment_method text, p_address jsonb, p_alt_contact jsonb, p_buyer_note text, p_idempotency_key uuid) returns bigint`. `p_alt_contact` shape: `{"name": string, "phone": string | null, "note": string | null}` or `null`.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/database/order_fulfillment.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug, description, country_code, time_zone)
overriding system value
values (920, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Envio', 'tienda-envio',
  'Descripción completa de la tienda para probar el método de entrega.', 'MX',
  'America/Mexico_City');

insert into public.products (id, shop_id, name, description, price_mxn, status, units_available)
overriding system value
values (820, 920, 'Taza', 'Descripción completa de la taza de barro artesanal.', 250,
  'published', 5);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select public.add_cart_item(820, 1);

-- 1. A shipping checkout writes an address row.
create temp table shipping_order as
select public.checkout_cart_v3(
  920,
  'shipping',
  '{"recipient":"Ana Ruiz","address_line1":"Calle 1","address_line2":null,"locality":"Zapopan","administrative_area":"Jalisco","postal_code":"45010","country_code":"MX","delivery_instructions":null}'::jsonb,
  null,
  'Mensaje',
  gen_random_uuid()
) as id;

select is(
  (select fulfillment_method from public.orders where id = (select id from shipping_order)),
  'shipping',
  'a shipping checkout records the shipping method'
);

select isnt_empty(
  $$select order_id from public.order_addresses
    where order_id = (select id from shipping_order)$$,
  'a shipping checkout writes an address row'
);

-- 2. A pickup checkout writes no address row, and carries the alternate contact.
select public.add_cart_item(820, 1);

create temp table pickup_order as
select public.checkout_cart_v3(
  920,
  'pickup',
  null,
  '{"name":"Luis Ruiz","phone":"+523312345678","note":"mi hermano"}'::jsonb,
  null,
  gen_random_uuid()
) as id;

select is(
  (select fulfillment_method from public.orders where id = (select id from pickup_order)),
  'pickup',
  'a pickup checkout records the pickup method'
);

select is_empty(
  $$select order_id from public.order_addresses
    where order_id = (select id from pickup_order)$$,
  'a pickup checkout writes no address row'
);

select is(
  (select alt_contact_note from public.orders where id = (select id from pickup_order)),
  'mi hermano',
  'the alternate contact note is stored on the order'
);

-- 3. Shipping without an address is refused.
select public.add_cart_item(820, 1);

select throws_ok(
  $$select public.checkout_cart_v3(920, 'shipping', null, null, null, gen_random_uuid())$$,
  '22023',
  'Completa la dirección de entrega.',
  'shipping without an address is refused'
);

-- 4. Pickup carrying an address is refused, so it cannot slip past the gate.
select throws_ok(
  $$select public.checkout_cart_v3(920, 'pickup',
      '{"recipient":"Ana","address_line1":"Calle 1","locality":"Zapopan","administrative_area":"Jalisco","postal_code":"45010","country_code":"MX"}'::jsonb,
      null, null, gen_random_uuid())$$,
  'P0001',
  'Una recolección no lleva dirección de entrega.',
  'pickup with an address is refused'
);

-- 5. An invented method is refused.
select throws_ok(
  $$select public.checkout_cart_v3(920, 'teleport', null, null, null, gen_random_uuid())$$,
  '22023',
  'Elige recolección o envío.',
  'an unknown fulfillment method is refused'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — `function public.checkout_cart_v3(...) does not exist`.

- [ ] **Step 3: Create the migration**

Run: `npx supabase migration new add_order_fulfillment_method`

Write into the generated file:

```sql
-- An order could only ever be shipped. A buyer may now collect it instead, and
-- a collected order has no delivery address at all: the address it is associated
-- with belongs to the shop, and is revealed by shop_pickup_point once the seller
-- accepts.
alter table public.orders
  add column fulfillment_method text not null default 'shipping',
  add column alt_contact_name text,
  add column alt_contact_phone text,
  add column alt_contact_note text;

-- Existing rows were all shipped. New rows must say which they are rather than
-- inherit an answer, so the default goes as soon as it has done its work.
alter table public.orders alter column fulfillment_method drop default;

alter table public.orders
  add constraint orders_fulfillment_method_check
    check (fulfillment_method in ('pickup', 'shipping')),
  -- A phone or a note with nobody's name attached leaves the seller with
  -- somebody to call and no one to ask for.
  add constraint orders_alt_contact_needs_name_check
    check (
      alt_contact_name is not null
      or (alt_contact_phone is null and alt_contact_note is null)
    ),
  add constraint orders_alt_contact_name_length_check
    check (alt_contact_name is null or length(btrim(alt_contact_name)) between 2 and 80),
  add constraint orders_alt_contact_phone_check
    check (alt_contact_phone is null or alt_contact_phone ~ '^\+52[0-9]{10}$'),
  add constraint orders_alt_contact_note_length_check
    check (alt_contact_note is null or length(alt_contact_note) <= 200);

create function private.checkout_cart_internal_v2(
  p_shop_id bigint,
  p_fulfillment_method text,
  p_address jsonb,
  p_alt_contact jsonb,
  p_buyer_note text,
  p_idempotency_key uuid,
  p_payment_confirmation_required boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_cart_id bigint;
  v_order_id bigint;
  v_owner_id uuid;
  v_time_zone text;
  v_subtotal numeric(14,2);
  v_handling_days integer;
  v_item_count bigint;
  v_contact_name text := nullif(btrim(p_alt_contact->>'name'), '');
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Debes iniciar sesión.'; end if;
  if p_idempotency_key is null then raise exception using errcode = '22023', message = 'Falta la clave de confirmación.'; end if;
  if p_fulfillment_method is null or p_fulfillment_method not in ('pickup', 'shipping') then
    raise exception using errcode = '22023', message = 'Elige recolección o envío.';
  end if;

  select id into v_order_id from public.orders
  where buyer_id = v_user and idempotency_key = p_idempotency_key;
  if v_order_id is not null then return v_order_id; end if;

  select owner_id, time_zone into v_owner_id, v_time_zone from public.shops where id = p_shop_id;
  if v_owner_id is null then raise exception using errcode = 'P0002', message = 'Tienda no encontrada.'; end if;
  if v_owner_id = v_user then raise exception using errcode = 'P0001', message = 'No puedes comprar en tu propia tienda.'; end if;

  select id into v_cart_id from public.carts
  where buyer_id = v_user and shop_id = p_shop_id for update;
  if v_cart_id is null then raise exception using errcode = 'P0002', message = 'Tu carrito está vacío.'; end if;

  select count(*), sum(p.price_mxn * ci.quantity), max(p.handling_days)
  into v_item_count, v_subtotal, v_handling_days
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id and p.shop_id = p_shop_id and p.status = 'published';
  if v_item_count = 0 or v_item_count <> (select count(*) from public.cart_items where cart_id = v_cart_id) then
    raise exception using errcode = 'P0001', message = 'Uno o más productos ya no están disponibles.';
  end if;

  if p_fulfillment_method = 'shipping' then
    if nullif(btrim(p_address->>'recipient'), '') is null
      or nullif(btrim(p_address->>'address_line1'), '') is null
      or nullif(btrim(p_address->>'locality'), '') is null
      or nullif(btrim(p_address->>'administrative_area'), '') is null
      or nullif(btrim(p_address->>'postal_code'), '') is null
      or coalesce(p_address->>'country_code', '') !~ '^[A-Z]{2}$' then
      raise exception using errcode = '22023', message = 'Completa la dirección de entrega.';
    end if;
  elsif p_address is not null then
    -- A collected order must not carry a delivery address: it would sit in
    -- order_addresses looking exactly like a shipment nobody agreed to.
    raise exception using errcode = 'P0001', message = 'Una recolección no lleva dirección de entrega.';
  end if;

  if v_contact_name is null
    and (nullif(btrim(p_alt_contact->>'phone'), '') is not null
      or nullif(btrim(p_alt_contact->>'note'), '') is not null) then
    raise exception using errcode = '22023', message = 'Escribe el nombre de la otra persona.';
  end if;

  insert into public.orders (
    buyer_id, shop_id, idempotency_key, currency_code, subtotal, buyer_note,
    handling_days, handling_time_zone, payment_confirmation_required,
    fulfillment_method, alt_contact_name, alt_contact_phone, alt_contact_note
  ) values (
    v_user, p_shop_id, p_idempotency_key, 'MXN', v_subtotal,
    nullif(btrim(p_buyer_note), ''), v_handling_days, v_time_zone,
    p_payment_confirmation_required,
    p_fulfillment_method, v_contact_name,
    nullif(btrim(p_alt_contact->>'phone'), ''),
    nullif(btrim(p_alt_contact->>'note'), '')
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, unit_price, currency_code,
    quantity, line_total, handling_days
  )
  select v_order_id, p.id, p.name, p.price_mxn, p.currency_code,
    ci.quantity, p.price_mxn * ci.quantity, p.handling_days
  from public.cart_items ci join public.products p on p.id = ci.product_id
  where ci.cart_id = v_cart_id;

  if p_fulfillment_method = 'shipping' then
    insert into public.order_addresses (
      order_id, recipient, address_line1, address_line2, locality,
      administrative_area, postal_code, country_code, delivery_instructions
    ) values (
      v_order_id, btrim(p_address->>'recipient'), btrim(p_address->>'address_line1'),
      nullif(btrim(p_address->>'address_line2'), ''), btrim(p_address->>'locality'),
      btrim(p_address->>'administrative_area'), btrim(p_address->>'postal_code'),
      p_address->>'country_code', nullif(btrim(p_address->>'delivery_instructions'), '')
    );
  end if;

  insert into public.order_events (order_id, actor_id, actor_type, event_type, next_status, metadata, idempotency_key)
  values (
    v_order_id, v_user, 'buyer', 'requested', 'requested',
    jsonb_build_object(
      'payment_confirmation_required', p_payment_confirmation_required,
      'fulfillment_method', p_fulfillment_method
    ),
    p_idempotency_key
  );

  delete from public.carts where id = v_cart_id;
  return v_order_id;
end;
$$;

revoke execute on function private.checkout_cart_internal_v2(bigint,text,jsonb,jsonb,text,uuid,boolean)
from public, anon, authenticated;

create function public.checkout_cart_v3(
  p_shop_id bigint,
  p_fulfillment_method text,
  p_address jsonb,
  p_alt_contact jsonb,
  p_buyer_note text,
  p_idempotency_key uuid
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.checkout_cart_internal_v2(
    p_shop_id, p_fulfillment_method, p_address, p_alt_contact,
    p_buyer_note, p_idempotency_key, true
  )
$$;

revoke all on function public.checkout_cart_v3(bigint,text,jsonb,jsonb,text,uuid) from public, anon;
grant execute on function public.checkout_cart_v3(bigint,text,jsonb,jsonb,text,uuid) to authenticated;

-- v2 keeps working for the length of the rollout. It has always meant shipping.
create or replace function public.checkout_cart_v2(
  p_shop_id bigint,
  p_address jsonb,
  p_buyer_note text,
  p_idempotency_key uuid
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select private.checkout_cart_internal_v2(
    p_shop_id, 'shipping', p_address, null, p_buyer_note, p_idempotency_key, true
  )
$$;

-- Rollback:
-- drop function public.checkout_cart_v3(bigint,text,jsonb,jsonb,text,uuid);
-- restore public.checkout_cart_v2 from 20260820191826_add_buyer_trust_system.sql;
-- drop function private.checkout_cart_internal_v2(bigint,text,jsonb,jsonb,text,uuid,boolean);
-- alter table public.orders
--   drop constraint orders_alt_contact_note_length_check,
--   drop constraint orders_alt_contact_phone_check,
--   drop constraint orders_alt_contact_name_length_check,
--   drop constraint orders_alt_contact_needs_name_check,
--   drop constraint orders_fulfillment_method_check,
--   drop column alt_contact_note, drop column alt_contact_phone,
--   drop column alt_contact_name, drop column fulfillment_method;
```

- [ ] **Step 4: Mirror the schema in the hand-written types**

In `lib/database.types.ts`, add to the `orders` `Row` type: `fulfillment_method: "pickup" | "shipping"; alt_contact_name: string | null; alt_contact_phone: string | null; alt_contact_note: string | null`. Add the same four to `Insert` and `Update` with `?` on every one except `fulfillment_method` in `Insert`, which is required.

Add to `Functions`:

```ts
      checkout_cart_v3: {
        Args: { p_shop_id: number; p_fulfillment_method: "pickup" | "shipping"; p_address: Json | null; p_alt_contact: Json | null; p_buyer_note: string | null; p_idempotency_key: string };
        Returns: number;
      };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx supabase db reset && npx supabase test db`
Expected: PASS. Both new files green, and `commerce_foundation.test.sql` still green — it exercises `checkout_cart_v2`, which now routes through the new internal function.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations supabase/tests/database/order_fulfillment.test.sql lib/database.types.ts
git commit -m "feat(db): let an order be collected instead of shipped"
```

---

### Task 3: `pickupPointSchema`

**Files:**
- Modify: `lib/validation/shop.ts`
- Create: `lib/validation/pickup-point.test.ts`

**Interfaces:**
- Consumes: `MEXICO_ADMINISTRATIVE_AREA_CODES` from `@/lib/shop-location`.
- Produces: `pickupPointSchema` (Zod object) and `type PickupPointInput = { address_line1: string; locality: string; administrative_area_code: string; postal_code: string; notes: string | null }`, both exported from `lib/validation/shop.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/validation/pickup-point.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { pickupPointSchema } from "@/lib/validation/shop";

const valid = {
  address_line1: "Av. Vallarta 1234",
  locality: "Zapopan",
  administrative_area_code: "MX-JAL",
  postal_code: "45010",
  notes: "Portón verde",
};

describe("pickupPointSchema", () => {
  it("accepts a complete pickup point", () => {
    expect(pickupPointSchema.safeParse(valid).success).toBe(true);
  });

  it("treats blank notes as absent", () => {
    const parsed = pickupPointSchema.parse({ ...valid, notes: "   " });
    expect(parsed.notes).toBeNull();
  });

  it("refuses a postal code that is not five digits", () => {
    const result = pickupPointSchema.safeParse({ ...valid, postal_code: "450" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("El código postal tiene 5 dígitos.");
  });

  it("refuses a state outside the supported list", () => {
    expect(pickupPointSchema.safeParse({ ...valid, administrative_area_code: "US-CA" }).success).toBe(false);
  });

  it("refuses a missing street", () => {
    const result = pickupPointSchema.safeParse({ ...valid, address_line1: "" });
    expect(result.success).toBe(false);
  });

  it("refuses notes longer than 500 characters", () => {
    expect(pickupPointSchema.safeParse({ ...valid, notes: "a".repeat(501) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/validation/pickup-point.test.ts`
Expected: FAIL — `pickupPointSchema` is not exported.

- [ ] **Step 3: Add the schema**

Append to `lib/validation/shop.ts`:

```ts
/**
 * The pickup point is its own schema rather than a refinement of `shopSchema`,
 * because it is written to its own table. A shop offers collection exactly when
 * this parses, and the seller unchecking the option deletes the row instead.
 */
export const pickupPointSchema = z.object({
  address_line1: z
    .string()
    .trim()
    .refine((value) => value.length >= 3 && value.length <= 200, {
      message: "Escribe la calle y el número.",
    }),
  locality: z
    .string()
    .trim()
    .refine((value) => value.length >= 2 && value.length <= 120, {
      message: "Escribe la ciudad o localidad.",
    }),
  administrative_area_code: z.enum(MEXICO_ADMINISTRATIVE_AREA_CODES, {
    error: "Selecciona un estado.",
  }),
  postal_code: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, { message: "El código postal tiene 5 dígitos." }),
  notes: z
    .string()
    .trim()
    .max(500, { error: "Las referencias no pueden pasar de 500 caracteres." })
    .transform((value) => value || null)
    .nullable()
    .default(null),
});

export type PickupPointInput = z.infer<typeof pickupPointSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/validation/pickup-point.test.ts`
Expected: PASS, 6 of 6.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/shop.ts lib/validation/pickup-point.test.ts
git commit -m "feat(shops): validate a pickup point"
```

---

### Task 4: Recolección block in the shop form

**Files:**
- Modify: `components/shops/shop-form.tsx`
- Modify: `components/shops/shop-form.test.tsx`

**Interfaces:**
- Consumes: `pickupPointSchema` field names from Task 3, `MEXICO_ADMINISTRATIVE_AREAS` from `@/lib/shop-location`.
- Produces: `ShopForm` takes a new optional prop `pickupPoint?: { addressLine1: string; locality: string; administrativeAreaCode: string; postalCode: string; notes: string } | null`. Form fields posted: `offers_pickup` (checkbox, value `"on"`), `pickup_address_line1`, `pickup_locality`, `pickup_administrative_area_code`, `pickup_postal_code`, `pickup_notes`.

- [ ] **Step 1: Write the failing test**

Append to `components/shops/shop-form.test.tsx`, inside the existing `describe("ShopForm", ...)`:

```tsx
  it("hides the pickup fields until collection is offered", () => {
    render(<ShopForm action={action} />);

    expect(screen.getByLabelText("Ofrezco recolección en tienda")).not.toBeChecked();
    expect(screen.queryByLabelText("Calle y número de recolección")).not.toBeInTheDocument();
  });

  it("reveals the pickup fields when collection is offered", () => {
    render(<ShopForm action={action} />);

    fireEvent.click(screen.getByLabelText("Ofrezco recolección en tienda"));

    expect(screen.getByLabelText("Calle y número de recolección")).toBeRequired();
    expect(screen.getByLabelText("Ciudad de recolección")).toBeRequired();
    expect(screen.getByLabelText("Estado de recolección")).toBeRequired();
    expect(screen.getByLabelText("Código postal de recolección")).toBeRequired();
    expect(screen.getByLabelText("Referencias para llegar")).not.toBeRequired();
  });

  it("starts checked and filled for a shop that already offers collection", () => {
    render(
      <ShopForm
        action={action}
        pickupPoint={{
          addressLine1: "Av. Vallarta 1234",
          locality: "Zapopan",
          administrativeAreaCode: "MX-JAL",
          postalCode: "45010",
          notes: "Portón verde",
        }}
      />,
    );

    expect(screen.getByLabelText("Ofrezco recolección en tienda")).toBeChecked();
    expect(screen.getByLabelText("Calle y número de recolección")).toHaveValue("Av. Vallarta 1234");
    expect(screen.getByLabelText("Código postal de recolección")).toHaveValue("45010");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/shops/shop-form.test.tsx`
Expected: FAIL — `Unable to find a label with the text of: Ofrezco recolección en tienda`.

- [ ] **Step 3: Add the block to the form**

In `components/shops/shop-form.tsx`, extend `ShopFormProps` with the `pickupPoint` prop described in **Interfaces**, add

```tsx
  const [offersPickup, setOffersPickup] = useState(Boolean(pickupPoint));
```

beside the existing `useState` calls, and render this block after the existing Ubicación grid, before the save button:

```tsx
      <div className="space-y-4 border-t border-line pt-6">
        <label className="flex items-center gap-3 text-sm font-semibold text-ink" htmlFor="offers_pickup">
          <input
            checked={offersPickup}
            className="size-5 rounded border-line accent-brand"
            id="offers_pickup"
            name="offers_pickup"
            onChange={(event) => setOffersPickup(event.target.checked)}
            type="checkbox"
          />
          Ofrezco recolección en tienda
        </label>
        <p className="text-sm leading-6 text-muted">
          Quien compre verá la ciudad al pedir, y la dirección completa cuando aceptes el pedido.
        </p>

        {offersPickup ? (
          <div className="space-y-4">
            <Field
              defaultValue={state.values?.pickup_address_line1 ?? pickupPoint?.addressLine1}
              error={state.errors?.pickup_address_line1?.[0]}
              label="Calle y número de recolección"
              maxLength={200}
              name="pickup_address_line1"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                defaultValue={state.values?.pickup_locality ?? pickupPoint?.locality}
                error={state.errors?.pickup_locality?.[0]}
                label="Ciudad de recolección"
                maxLength={120}
                name="pickup_locality"
                required
              />
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-ink" htmlFor="pickup_administrative_area_code">
                  Estado de recolección
                </label>
                <select
                  className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink focus:border-brand focus:outline-none"
                  defaultValue={pickupPoint?.administrativeAreaCode ?? primaryArea}
                  id="pickup_administrative_area_code"
                  name="pickup_administrative_area_code"
                  required
                >
                  {MEXICO_ADMINISTRATIVE_AREAS.map((area) => (
                    <option key={area.code} value={area.code}>
                      {area.label}
                    </option>
                  ))}
                </select>
                {state.errors?.pickup_administrative_area_code?.[0] ? (
                  <p className="text-sm font-medium text-sale">
                    {state.errors.pickup_administrative_area_code[0]}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                defaultValue={state.values?.pickup_postal_code ?? pickupPoint?.postalCode}
                error={state.errors?.pickup_postal_code?.[0]}
                inputMode="numeric"
                label="Código postal de recolección"
                maxLength={5}
                name="pickup_postal_code"
                required
              />
              <Field
                defaultValue={state.values?.pickup_notes ?? pickupPoint?.notes}
                error={state.errors?.pickup_notes?.[0]}
                label="Referencias para llegar"
                maxLength={500}
                name="pickup_notes"
              />
            </div>
          </div>
        ) : null}
      </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- components/shops/shop-form.test.tsx`
Expected: PASS, including the three pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add components/shops/shop-form.tsx components/shops/shop-form.test.tsx
git commit -m "feat(shops): let a seller offer collection from the shop form"
```

---

### Task 5: Persist the pickup point

**Files:**
- Modify: `lib/actions/shops.ts` (both `createShop` around line 55-110 and `updateShop` at 114-180)
- Modify: `app/panel/tiendas/[id]/page.tsx:25` (load the pickup point and pass it to `ShopForm`)
- Create: `lib/actions/shop-pickup-point.ts`
- Create: `lib/actions/shop-pickup-point.test.ts`

**Interfaces:**
- Consumes: `pickupPointSchema` (Task 3), the form field names (Task 4), the `shop_pickup_points` table (Task 1).
- Produces: `pickupPointFrom(formData: FormData): { offered: boolean; parsed: ReturnType<typeof pickupPointSchema.safeParse> | null }` and `savePickupPoint(supabase, shopId, formData): Promise<ActionState | null>` — returns `null` on success, an error `ActionState` otherwise. Both exported from `lib/actions/shop-pickup-point.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/actions/shop-pickup-point.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { pickupPointFrom } from "@/lib/actions/shop-pickup-point";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("pickupPointFrom", () => {
  it("reports no offer when the checkbox is absent", () => {
    const result = pickupPointFrom(form({ name: "Tienda" }));
    expect(result.offered).toBe(false);
    expect(result.parsed).toBeNull();
  });

  it("parses the pickup fields when the checkbox is on", () => {
    const result = pickupPointFrom(
      form({
        offers_pickup: "on",
        pickup_address_line1: "Av. Vallarta 1234",
        pickup_locality: "Zapopan",
        pickup_administrative_area_code: "MX-JAL",
        pickup_postal_code: "45010",
        pickup_notes: "Portón verde",
      }),
    );

    expect(result.offered).toBe(true);
    expect(result.parsed?.success).toBe(true);
    expect(result.parsed?.data?.address_line1).toBe("Av. Vallarta 1234");
  });

  it("reports the failure when the checkbox is on and a field is missing", () => {
    const result = pickupPointFrom(
      form({ offers_pickup: "on", pickup_address_line1: "Av. Vallarta 1234" }),
    );

    expect(result.offered).toBe(true);
    expect(result.parsed?.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/actions/shop-pickup-point.test.ts`
Expected: FAIL — cannot resolve `@/lib/actions/shop-pickup-point`.

- [ ] **Step 3: Write the module**

Create `lib/actions/shop-pickup-point.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionState } from "@/lib/action-state";
import type { Database } from "@/lib/database.types";
import { pickupPointSchema } from "@/lib/validation/shop";

/**
 * Reads the Recolección block out of the shop form. The checkbox is the whole
 * decision: unchecked means the shop stops offering collection, and the row goes.
 */
export function pickupPointFrom(formData: FormData) {
  const offered = formData.get("offers_pickup") !== null;
  if (!offered) return { offered: false as const, parsed: null };

  return {
    offered: true as const,
    parsed: pickupPointSchema.safeParse({
      address_line1: formData.get("pickup_address_line1"),
      locality: formData.get("pickup_locality"),
      administrative_area_code: formData.get("pickup_administrative_area_code"),
      postal_code: formData.get("pickup_postal_code"),
      notes: formData.get("pickup_notes") ?? "",
    }),
  };
}

/**
 * Writes or removes a shop's pickup point.
 *
 * Called before the shop row is saved, so that a rejected address never leaves
 * the seller with a saved shop and a lost pickup point. Returns null when there
 * is nothing to report.
 */
export async function savePickupPoint(
  supabase: SupabaseClient<Database>,
  shopId: number,
  formData: FormData,
): Promise<ActionState | null> {
  const { offered, parsed } = pickupPointFrom(formData);

  if (!offered) {
    const { error } = await supabase.from("shop_pickup_points").delete().eq("shop_id", shopId);
    return error ? { status: "error", message: "No pudimos quitar la recolección." } : null;
  }

  if (!parsed?.success) {
    return {
      status: "error",
      message: "Revisa los datos de recolección.",
      errors: Object.fromEntries(
        Object.entries(parsed?.error.flatten().fieldErrors ?? {}).map(([key, value]) => [
          `pickup_${key}`,
          value,
        ]),
      ),
    };
  }

  const { error } = await supabase
    .from("shop_pickup_points")
    .upsert({ shop_id: shopId, ...parsed.data, updated_at: new Date().toISOString() });

  return error ? { status: "error", message: "No pudimos guardar la recolección." } : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/actions/shop-pickup-point.test.ts`
Expected: PASS, 3 of 3.

- [ ] **Step 5: Wire it into both shop actions**

In `lib/actions/shops.ts`, import `savePickupPoint`. In `updateShop`, after the `existing` lookup succeeds and **before** the `supabase.from("shops").update(...)` call at line 161:

```ts
  const pickupError = await savePickupPoint(supabase, shopId, formData);
  if (pickupError) return pickupError;
```

In `createShop`, after the insert returns the new shop's id, do the same with that id. Change the insert at line 99 to `.select("id").single()` if it does not already return the row, and use `data.id`.

- [ ] **Step 6: Load it on the seller's page**

In `app/panel/tiendas/[id]/page.tsx`, after the `shop` lookup at line 25:

```tsx
  const { data: pickupPoint } = await supabase
    .from("shop_pickup_points")
    .select("address_line1, locality, administrative_area_code, postal_code, notes")
    .eq("shop_id", shopId)
    .maybeSingle();
```

and pass to `ShopForm`:

```tsx
        pickupPoint={pickupPoint ? {
          addressLine1: pickupPoint.address_line1,
          locality: pickupPoint.locality,
          administrativeAreaCode: pickupPoint.administrative_area_code,
          postalCode: pickupPoint.postal_code,
          notes: pickupPoint.notes ?? "",
        } : null}
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/shop-pickup-point.ts lib/actions/shop-pickup-point.test.ts lib/actions/shops.ts "app/panel/tiendas/[id]/page.tsx"
git commit -m "feat(shops): save and remove a shop's pickup point"
```

---

### Task 6: Server queries for the checkout page

**Files:**
- Create: `lib/queries/checkout.server.ts`
- Create: `lib/queries/checkout.ts`
- Create: `lib/queries/checkout.test.ts`
- Modify: `lib/queries/orders.types.ts`

**Interfaces:**
- Consumes: `shop_pickup_point` (Task 1), `getCart` from `lib/queries/orders.server.ts`, `conversations` with `product_id` from `20260826120000`.
- Produces, from `lib/queries/checkout.ts` (pure, testable):
  ```ts
  export type PickupPoint = { locality: string; administrative_area_code: string; address_line1?: string; postal_code?: string; notes?: string | null };
  export function parsePickupPoint(value: unknown): PickupPoint | null;
  export function hasFullAddress(point: PickupPoint | null): boolean;
  ```
  From `lib/queries/checkout.server.ts`:
  ```ts
  export async function fetchPickupPoint(shopId: number): Promise<PickupPoint | null>;
  export type CartThread = { productId: number; productName: string; conversationId: number | null; messages: ThreadMessage[] };
  export async function fetchCartThreads(shopId: number, items: { productId: number; productName: string }[]): Promise<CartThread[]>;
  export async function fetchBuyerProfile(): Promise<{ userId: string; displayName: string; email: string | null; phone: string | null } | null>;
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/queries/checkout.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { hasFullAddress, parsePickupPoint } from "@/lib/queries/checkout";

describe("parsePickupPoint", () => {
  it("returns null for a shop with no pickup point", () => {
    expect(parsePickupPoint(null)).toBeNull();
  });

  it("reads the coarse form", () => {
    const point = parsePickupPoint({ locality: "Zapopan", administrative_area_code: "MX-JAL" });
    expect(point).toEqual({ locality: "Zapopan", administrative_area_code: "MX-JAL" });
    expect(hasFullAddress(point)).toBe(false);
  });

  it("reads the full form once it is revealed", () => {
    const point = parsePickupPoint({
      locality: "Zapopan",
      administrative_area_code: "MX-JAL",
      address_line1: "Av. Vallarta 1234",
      postal_code: "45010",
      notes: null,
    });
    expect(hasFullAddress(point)).toBe(true);
    expect(point?.address_line1).toBe("Av. Vallarta 1234");
  });

  it("refuses a payload missing the coarse fields rather than guessing", () => {
    expect(parsePickupPoint({ address_line1: "Av. Vallarta 1234" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/queries/checkout.test.ts`
Expected: FAIL — cannot resolve `@/lib/queries/checkout`.

- [ ] **Step 3: Write the pure module**

Create `lib/queries/checkout.ts`:

```ts
/**
 * What `public.shop_pickup_point` answered. The coarse form is what everybody
 * gets; the street arrives only once the seller has accepted the order, so every
 * consumer has to be able to render without it.
 */
export type PickupPoint = {
  locality: string;
  administrative_area_code: string;
  address_line1?: string;
  postal_code?: string;
  notes?: string | null;
};

export function parsePickupPoint(value: unknown): PickupPoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.locality !== "string" || typeof raw.administrative_area_code !== "string") {
    return null;
  }

  const point: PickupPoint = {
    locality: raw.locality,
    administrative_area_code: raw.administrative_area_code,
  };
  if (typeof raw.address_line1 === "string") point.address_line1 = raw.address_line1;
  if (typeof raw.postal_code === "string") point.postal_code = raw.postal_code;
  if (typeof raw.notes === "string" || raw.notes === null) point.notes = raw.notes ?? null;
  return point;
}

export function hasFullAddress(point: PickupPoint | null): boolean {
  return Boolean(point?.address_line1);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/queries/checkout.test.ts`
Expected: PASS, 4 of 4.

- [ ] **Step 5: Write the server module**

Create `lib/queries/checkout.server.ts`:

```ts
import "server-only";

import { displayNameOrHandle } from "@/lib/display-name";
import { oldestFirst } from "@/lib/queries/messages";
import type { ThreadMessage } from "@/lib/queries/messages";
import { parsePickupPoint, type PickupPoint } from "@/lib/queries/checkout";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CartThread = {
  productId: number;
  productName: string;
  conversationId: number | null;
  messages: ThreadMessage[];
};

export async function fetchPickupPoint(shopId: number): Promise<PickupPoint | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("shop_pickup_point", { p_shop_id: shopId });
  return parsePickupPoint(data);
}

/**
 * The threads for what is in the cart, read and never created.
 *
 * Opening a conversation is a write, and a page render is a GET: a crawler
 * following the cart link must not open threads on a shopper's behalf. A product
 * with no thread yet comes back with a null conversation id, and the panel offers
 * to start one.
 */
export async function fetchCartThreads(
  shopId: number,
  items: { productId: number; productName: string }[],
): Promise<CartThread[]> {
  if (!isSupabaseConfigured() || items.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return [];

  // Row-level security already limits this to the caller's own conversations.
  const { data } = await supabase
    .from("conversations")
    .select("id, product_id, messages(id, sender_id, body, created_at)")
    .eq("shop_id", shopId)
    .eq("type", "pre_sale")
    .in("product_id", items.map((item) => item.productId));

  const rows = (data ?? []) as unknown as {
    id: number;
    product_id: number | null;
    messages: ThreadMessage[];
  }[];
  const byProduct = new Map(rows.filter((row) => row.product_id !== null).map((row) => [row.product_id, row]));

  return items.map((item) => {
    const row = byProduct.get(item.productId);
    return {
      productId: item.productId,
      productName: item.productName,
      conversationId: row?.id ?? null,
      messages: row ? oldestFirst(row.messages) : [],
    };
  });
}

export async function fetchBuyerProfile() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;

  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  const [{ data: contact }, { data: name }] = await Promise.all([
    supabase.from("user_contact_details").select("phone").eq("user_id", userId).maybeSingle(),
    supabase.rpc("my_display_name"),
  ]);

  return {
    userId,
    displayName: displayNameOrHandle(name ?? null, userId),
    email,
    phone: contact?.phone ?? null,
  };
}
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/queries/checkout.ts lib/queries/checkout.server.ts lib/queries/checkout.test.ts
git commit -m "feat(checkout): read the pickup point, the cart's threads and the buyer"
```

---

### Task 7: `FulfillmentChoice`

**Files:**
- Create: `components/orders/fulfillment-choice.tsx`
- Create: `components/orders/fulfillment-choice.test.tsx`

**Interfaces:**
- Consumes: `PickupPoint` (Task 6), `CheckoutForm`'s field set — this component now owns those fields, so `components/orders/checkout-form.tsx` is superseded and deleted in Task 10.
- Produces: `<FulfillmentChoice action={…} idempotencyKey={…} pickupPoint={…} threadHref={…} />`, a client component posting `fulfillment_method` plus the address fields and `alt_contact_name` / `alt_contact_phone` / `alt_contact_note`.

- [ ] **Step 1: Write the failing test**

Create `components/orders/fulfillment-choice.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FulfillmentChoice } from "@/components/orders/fulfillment-choice";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });
const point = { locality: "Zapopan", administrative_area_code: "MX-JAL" };

afterEach(cleanup);

describe("FulfillmentChoice", () => {
  it("starts with neither option chosen and the button disabled", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    expect(screen.getByLabelText("Recolección en tienda")).not.toBeChecked();
    expect(screen.getByLabelText("Envío a domicilio")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar solicitud" })).toBeDisabled();
    expect(screen.queryByLabelText("Calle y número")).not.toBeInTheDocument();
  });

  it("shows the address fields and enables the button when shipping is chosen", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Envío a domicilio"));

    expect(screen.getByLabelText("Nombre de quien recibe")).toBeRequired();
    expect(screen.getByLabelText("Calle y número")).toBeRequired();
    expect(screen.getByRole("button", { name: "Confirmar solicitud" })).toBeEnabled();
  });

  it("shows the shop's city and no address fields when pickup is chosen", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));

    expect(screen.getByText(/Zapopan/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Calle y número")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar solicitud" })).toBeEnabled();
  });

  it("sends pickup to the thread when the shop has no pickup point", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={null} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));

    expect(screen.getByText("Acuerden el punto de recolección en el chat")).toBeInTheDocument();
  });

  it("offers the alternate contact under both methods", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));
    expect(screen.getByLabelText("Nombre de la otra persona")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Envío a domicilio"));
    expect(screen.getByLabelText("Nombre de la otra persona")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/orders/fulfillment-choice.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Write the component**

Create `components/orders/fulfillment-choice.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/lib/action-state";
import type { PickupPoint } from "@/lib/queries/checkout";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import { useFormAction } from "@/lib/use-form-action";
import { Field } from "@/components/ui/field";

type Method = "pickup" | "shipping" | null;

function areaName(code: string) {
  return MEXICO_ADMINISTRATIVE_AREAS.find((area) => area.code === code)?.label ?? code;
}

function ConfirmButton({ chosen }: { chosen: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-describedby={chosen ? undefined : "fulfillment-required"}
      className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60"
      disabled={pending || !chosen}
      type="submit"
    >
      {pending ? "Creando pedido…" : "Confirmar solicitud"}
    </button>
  );
}

/**
 * How the buyer will get what they are asking for.
 *
 * Neither option starts chosen: a preselected default is an answer the buyer did
 * not give, and this one decides whether a stranger learns their home address.
 * The button is disabled until they answer, and the server refuses an order with
 * no method regardless — a disabled button is a courtesy, not a check.
 */
export function FulfillmentChoice({
  action,
  idempotencyKey,
  pickupPoint,
  threadHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  idempotencyKey: string;
  pickupPoint: PickupPoint | null;
  threadHref: string;
}) {
  const [state, formAction] = useFormAction(action);
  const [method, setMethod] = useState<Method>(null);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input name="idempotency_key" type="hidden" value={idempotencyKey} />
      <input name="country_code" type="hidden" value="MX" />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
          ¿Cómo lo recibes?
        </legend>

        <label className="flex items-start gap-3 rounded-2xl border border-line p-4" htmlFor="method-pickup">
          <input
            checked={method === "pickup"}
            className="mt-1 size-5 accent-brand"
            id="method-pickup"
            name="fulfillment_method"
            onChange={() => setMethod("pickup")}
            type="radio"
            value="pickup"
          />
          <span>
            <span className="block font-semibold text-ink">Recolección en tienda</span>
            <span className="mt-1 block text-sm text-muted">Vas por él y no compartes tu dirección.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-line p-4" htmlFor="method-shipping">
          <input
            checked={method === "shipping"}
            className="mt-1 size-5 accent-brand"
            id="method-shipping"
            name="fulfillment_method"
            onChange={() => setMethod("shipping")}
            type="radio"
            value="shipping"
          />
          <span>
            <span className="block font-semibold text-ink">Envío a domicilio</span>
            <span className="mt-1 block text-sm text-muted">Solo esta tienda y tú verán tu dirección.</span>
          </span>
        </label>

        {method === null ? (
          <p className="text-sm font-medium text-muted" id="fulfillment-required">
            Elige una opción para continuar.
          </p>
        ) : null}
      </fieldset>

      {method === "pickup" ? (
        <div className="rounded-2xl bg-background p-4 text-sm leading-6">
          {pickupPoint ? (
            <>
              <p className="font-semibold text-ink">
                {pickupPoint.locality}, {areaName(pickupPoint.administrative_area_code)}
              </p>
              <p className="mt-1 text-muted">
                Verás la dirección completa cuando el vendedor acepte tu pedido.
              </p>
            </>
          ) : (
            <p className="font-semibold text-ink">
              <a className="text-brand underline" href={threadHref}>
                Acuerden el punto de recolección en el chat
              </a>
            </p>
          )}
        </div>
      ) : null}

      {method === "shipping" ? (
        <div className="space-y-4">
          <Field defaultValue={state.values?.recipient} error={state.errors?.recipient?.[0]} label="Nombre de quien recibe" name="recipient" required />
          <Field defaultValue={state.values?.address_line1} error={state.errors?.address_line1?.[0]} label="Calle y número" name="address_line1" required />
          <Field defaultValue={state.values?.address_line2} error={state.errors?.address_line2?.[0]} label="Interior o referencia" name="address_line2" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field defaultValue={state.values?.locality} error={state.errors?.locality?.[0]} label="Ciudad o localidad" name="locality" required />
            <Field defaultValue={state.values?.administrative_area} error={state.errors?.administrative_area?.[0]} label="Estado" name="administrative_area" required />
          </div>
          <Field defaultValue={state.values?.postal_code} error={state.errors?.postal_code?.[0]} label="Código postal" name="postal_code" required />
          <Field defaultValue={state.values?.delivery_instructions} error={state.errors?.delivery_instructions?.[0]} label="Instrucciones de entrega" name="delivery_instructions" />
        </div>
      ) : null}

      {method !== null ? (
        <details className="rounded-2xl border border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Otra persona recibe o recoge (opcional)
          </summary>
          <div className="mt-4 space-y-4">
            <Field defaultValue={state.values?.alt_contact_name} error={state.errors?.alt_contact_name?.[0]} label="Nombre de la otra persona" maxLength={80} name="alt_contact_name" />
            <Field defaultValue={state.values?.alt_contact_phone} error={state.errors?.alt_contact_phone?.[0]} inputMode="tel" label="Teléfono de la otra persona" name="alt_contact_phone" placeholder="3312345678" />
            <Field defaultValue={state.values?.alt_contact_note} error={state.errors?.alt_contact_note?.[0]} label="Quién es" maxLength={200} name="alt_contact_note" placeholder="mi hermana, recepción del edificio" />
          </div>
        </details>
      ) : null}

      <Field defaultValue={state.values?.buyer_note} error={state.errors?.buyer_note?.[0]} label="Nota para vendedor" name="buyer_note" />

      {state.message ? (
        <p className="rounded-xl bg-sale/10 p-3 text-sm font-medium text-sale" role="status">
          {state.message}
        </p>
      ) : null}

      <ConfirmButton chosen={method !== null} />
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/orders/fulfillment-choice.test.tsx`
Expected: PASS, 5 of 5.

- [ ] **Step 5: Commit**

```bash
git add components/orders/fulfillment-choice.tsx components/orders/fulfillment-choice.test.tsx
git commit -m "feat(checkout): make the buyer choose collection or delivery"
```

---

### Task 8: `BuyerPanel` and `ShopPanel`

**Files:**
- Create: `components/orders/buyer-panel.tsx`
- Create: `components/orders/buyer-panel.test.tsx`
- Create: `components/orders/shop-panel.tsx`
- Create: `components/orders/shop-panel.test.tsx`

**Interfaces:**
- Consumes: `fetchBuyerProfile` return type (Task 6), `TrustTierBadge` and `TrustBadges` from `components/shops/`, `PublicTrustMetrics` from `lib/public-trust`.
- Produces:
  ```tsx
  <BuyerPanel buyer={{ displayName: string; email: string | null; phone: string | null }} />
  <ShopPanel shop={{ name: string; slug: string; imageUrl: string | null; trustTier: "standard" | "reliable" | "top_rated"; trustMetrics: PublicTrustMetrics | null; locality: string | null }} />
  ```
  Both are server-renderable (no `"use client"`).

- [ ] **Step 1: Write the failing tests**

Create `components/orders/buyer-panel.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BuyerPanel } from "@/components/orders/buyer-panel";

afterEach(cleanup);

describe("BuyerPanel", () => {
  it("shows the buyer's own contact details", () => {
    render(<BuyerPanel buyer={{ displayName: "Ana Ruiz", email: "ana@test.local", phone: "+523312345678" }} />);

    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("ana@test.local")).toBeInTheDocument();
    expect(screen.getByText("+523312345678")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar mis datos" })).toHaveAttribute("href", "/panel/cuenta");
  });

  it("asks for a phone number when there is none", () => {
    render(<BuyerPanel buyer={{ displayName: "Ana Ruiz", email: null, phone: null }} />);

    expect(screen.getByText("Sin teléfono guardado")).toBeInTheDocument();
  });
});
```

Create `components/orders/shop-panel.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopPanel } from "@/components/orders/shop-panel";

afterEach(cleanup);

const shop = {
  name: "Casa Niebla",
  slug: "casa-niebla",
  imageUrl: null,
  trustTier: "reliable" as const,
  trustMetrics: null,
  locality: "Zapopan",
};

describe("ShopPanel", () => {
  it("names the shop and links to it", () => {
    render(<ShopPanel shop={shop} />);

    expect(screen.getByText("Casa Niebla")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver la tienda" })).toHaveAttribute("href", "/tiendas/casa-niebla");
  });

  it("renders without trust metrics", () => {
    render(<ShopPanel shop={{ ...shop, trustMetrics: null }} />);

    expect(screen.getByText("Zapopan")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- components/orders/buyer-panel.test.tsx components/orders/shop-panel.test.tsx`
Expected: FAIL — neither component resolves.

- [ ] **Step 3: Write both components**

Create `components/orders/buyer-panel.tsx`:

```tsx
import Link from "next/link";

/**
 * Who is asking. Read only: the account is edited in one place, and a second
 * form here would let the two drift apart. Whoever actually receives or collects
 * the item is a separate, optional answer in FulfillmentChoice.
 */
export function BuyerPanel({
  buyer,
}: {
  buyer: { displayName: string; email: string | null; phone: string | null };
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Tus datos</p>
      <p className="mt-2 font-display text-2xl font-semibold">{buyer.displayName}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Correo</dt>
          <dd className="text-right font-medium text-ink">{buyer.email ?? "Sin correo"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Teléfono</dt>
          <dd className="text-right font-medium text-ink">{buyer.phone ?? "Sin teléfono guardado"}</dd>
        </div>
      </dl>
      <Link className="mt-5 inline-flex text-sm font-semibold text-brand" href="/panel/cuenta">
        Editar mis datos
      </Link>
    </div>
  );
}
```

Create `components/orders/shop-panel.tsx`:

```tsx
import Link from "next/link";
import { Store } from "lucide-react";

import type { PublicTrustMetrics } from "@/lib/public-trust";
import { TrustBadges } from "@/components/shops/trust-badges";
import { TrustTierBadge } from "@/components/shops/trust-tier-badge";

/** Who the buyer is asking, and what the plaza knows about them. */
export function ShopPanel({
  shop,
}: {
  shop: {
    name: string;
    slug: string;
    imageUrl: string | null;
    trustTier: "standard" | "reliable" | "top_rated";
    trustMetrics: PublicTrustMetrics | null;
    locality: string | null;
  };
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Vendedor</p>

      <div className="mt-4 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#eee8e1]">
          {shop.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img alt={shop.name} className="size-full object-cover" src={shop.imageUrl} />
          ) : (
            <Store aria-hidden="true" className="size-6 text-brand/40" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-semibold">{shop.name}</p>
          {shop.locality ? <p className="text-sm text-muted">{shop.locality}</p> : null}
        </div>
      </div>

      <div className="mt-4">
        <TrustTierBadge tier={shop.trustTier} />
      </div>

      {shop.trustMetrics ? (
        <div className="mt-4">
          <TrustBadges metrics={shop.trustMetrics} profile={null} />
        </div>
      ) : null}

      <Link className="mt-5 inline-flex text-sm font-semibold text-brand" href={`/tiendas/${shop.slug}`}>
        Ver la tienda
      </Link>
    </div>
  );
}
```

If `TrustBadges` takes different props than `metrics` and `profile`, read `components/shops/trust-badges.tsx` and match its actual signature rather than changing it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- components/orders/buyer-panel.test.tsx components/orders/shop-panel.test.tsx`
Expected: PASS, 4 of 4.

- [ ] **Step 5: Commit**

```bash
git add components/orders/buyer-panel.tsx components/orders/buyer-panel.test.tsx components/orders/shop-panel.tsx components/orders/shop-panel.test.tsx
git commit -m "feat(checkout): show who is asking and who they are asking"
```

---

### Task 9: `CartThread`

**Files:**
- Create: `components/orders/cart-thread.tsx`
- Create: `components/orders/cart-thread.test.tsx`
- Modify: `lib/actions/start-conversation.ts`

**Interfaces:**
- Consumes: `CartThread` type and `fetchCartThreads` (Task 6), `MessageThread` and `StartConversationButton` from `components/messages/`, `sendMessage` from `lib/actions/messages`, `openConversation` from `lib/actions/start-conversation`.
- Produces: `<CartThreads threads={CartThread[]} currentUserId={string} sendAction={(conversationId: number) => (state, formData) => Promise<ActionState>} startAction={(productId: number) => (state, formData) => Promise<ActionState>} />` — a client component owning the tab state. `openConversation` gains a third bound parameter: `openConversation(shopId, productId, returnTo)` where `returnTo` is a path; when given, it redirects there instead of to `/mensajes/:id`.

- [ ] **Step 1: Write the failing test**

Create `components/orders/cart-thread.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CartThreads } from "@/components/orders/cart-thread";
import type { ActionState } from "@/lib/action-state";

const noop = async (): Promise<ActionState> => ({ status: "idle", message: "" });
const sendAction = () => noop;
const startAction = () => noop;

const threads = [
  {
    productId: 1,
    productName: "Taza de barro",
    conversationId: 10,
    messages: [{ id: 1, sender_id: "u1", body: "¿Sigue disponible?", created_at: "2026-08-27T10:00:00Z" }],
  },
  { productId: 2, productName: "Plato de barro", conversationId: null, messages: [] },
];

afterEach(cleanup);

describe("CartThreads", () => {
  it("opens on the first item's thread", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={threads} />);

    expect(screen.getByRole("tab", { name: "Taza de barro" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
  });

  it("switches to another item's thread", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={threads} />);

    fireEvent.click(screen.getByRole("tab", { name: "Plato de barro" }));

    expect(screen.getByRole("tab", { name: "Plato de barro" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("¿Sigue disponible?")).not.toBeInTheDocument();
  });

  it("offers to start a thread that does not exist yet", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={threads} />);

    fireEvent.click(screen.getByRole("tab", { name: "Plato de barro" }));

    expect(screen.getByRole("button", { name: "Preguntar sobre este producto" })).toBeInTheDocument();
  });

  it("shows no tab strip for a single item", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={[threads[0]]} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/orders/cart-thread.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Extend `openConversation` with a return path**

In `lib/actions/start-conversation.ts`, change the signature and the redirect:

```ts
export async function openConversation(
  shopId: number,
  productId: number | null,
  returnTo: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previousState: ActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<ActionState> {
  const result = await startPreSaleConversation(shopId, productId);
  if ("error" in result) return { status: "error", message: result.error };

  // The cart binds its own path so the shopper comes back to the request they
  // were in the middle of making, rather than being moved to the inbox.
  redirect(returnTo ?? `/mensajes/${result.conversationId}`);
}
```

Update every existing caller to pass `null` as the third argument. Find them with:

```bash
grep -rn "openConversation" --include="*.tsx" --include="*.ts" app components lib
```

- [ ] **Step 4: Write the component**

Create `components/orders/cart-thread.tsx`:

```tsx
"use client";

import { useState } from "react";

import type { ActionState } from "@/lib/action-state";
import type { CartThread } from "@/lib/queries/checkout.server";
import { MessageThread } from "@/components/messages/message-thread";
import { StartConversationButton } from "@/components/messages/start-conversation-button";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * The conversation about what is being bought, beside what is being bought.
 *
 * A cart holds several products from one shop and each keeps its own thread, so
 * the tabs are the cart. A product with no thread yet shows the button that opens
 * one — rendering must never open it, because a render is a GET.
 */
export function CartThreads({
  currentUserId,
  sendAction,
  startAction,
  threads,
}: {
  currentUserId: string;
  sendAction: (conversationId: number) => Action;
  startAction: (productId: number) => Action;
  threads: CartThread[];
}) {
  const [activeId, setActiveId] = useState(threads[0]?.productId ?? null);
  const active = threads.find((thread) => thread.productId === activeId) ?? threads[0];

  if (!active) return null;

  return (
    <div>
      {threads.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b border-line pb-3" role="tablist">
          {threads.map((thread) => (
            <button
              aria-selected={thread.productId === active.productId}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                thread.productId === active.productId
                  ? "bg-brand text-white"
                  : "border border-line text-muted"
              }`}
              key={thread.productId}
              onClick={() => setActiveId(thread.productId)}
              role="tab"
              type="button"
            >
              {thread.productName}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {active.conversationId ? (
          <MessageThread
            action={sendAction(active.conversationId)}
            conversationId={active.conversationId}
            currentUserId={currentUserId}
            key={active.conversationId}
            messages={active.messages}
          />
        ) : (
          <div className="rounded-2xl border border-line p-5">
            <p className="text-sm leading-6 text-muted">
              Pregunta al vendedor antes de confirmar: entrega, estado del producto, lo que necesites.
            </p>
            <div className="mt-4">
              <StartConversationButton
                action={startAction(active.productId)}
                isOwnShop={false}
                label="Preguntar sobre este producto"
                returnTo="/"
                signedIn
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- components/orders/cart-thread.test.tsx`
Expected: PASS, 4 of 4.

- [ ] **Step 6: Verify nothing else broke**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. `components/messages/start-conversation-button.test.tsx` and the product/shop pages that call `openConversation` must still be green.

- [ ] **Step 7: Commit**

```bash
git add components/orders/cart-thread.tsx components/orders/cart-thread.test.tsx lib/actions/start-conversation.ts app components
git commit -m "feat(checkout): put each item's thread beside the request"
```

---

### Task 10: The three-column page and `checkoutCart` on v3

**Files:**
- Modify: `app/carrito/[shopId]/page.tsx` (full rewrite)
- Create: `components/orders/cart-items.tsx`
- Modify: `lib/actions/cart.ts:82-116` (`checkoutCart`)
- Modify: `lib/validation/commerce.ts` (`checkoutSchema`)
- Delete: `components/orders/checkout-form.tsx` (superseded by `FulfillmentChoice`)

**Interfaces:**
- Consumes: every component from Tasks 7-9, `fetchPickupPoint` / `fetchCartThreads` / `fetchBuyerProfile` (Task 6), `checkout_cart_v3` (Task 2).
- Produces: nothing further tasks depend on, except the page's own route contract.

- [ ] **Step 1: Write the failing schema test**

Append to `lib/validation/commerce.test.ts`:

```ts
describe("altContactSchema", () => {
  it("normalises a ten-digit national number", () => {
    const parsed = altContactSchema.parse({ name: "Luis", phone: "3312345678", note: "" });
    expect(parsed.phone).toBe("+523312345678");
  });

  it("refuses a phone with no name", () => {
    expect(altContactSchema.safeParse({ name: "", phone: "3312345678", note: "" }).success).toBe(false);
  });

  it("accepts an entirely empty contact", () => {
    const parsed = altContactSchema.parse({ name: "", phone: "", note: "" });
    expect(parsed).toEqual({ name: null, phone: null, note: null });
  });
});
```

Add `altContactSchema` to that file's imports.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/validation/commerce.test.ts`
Expected: FAIL — `altContactSchema` is not exported from `@/lib/validation/commerce`.

- [ ] **Step 3: Extend the checkout schema**

In `lib/validation/commerce.ts`, split `checkoutSchema` so the address is conditional. Add:

```ts
export const fulfillmentMethodSchema = z.enum(["pickup", "shipping"], {
  error: "Elige recolección o envío.",
});

export const altContactSchema = z
  .object({
    name: z.string().trim().max(80).transform((value) => value || null),
    phone: z
      .string()
      .trim()
      .transform((value) => (value ? (value.startsWith("+") ? value : `+52${value.replace(/\D/g, "")}`) : null))
      .refine((value) => value === null || /^\+52[0-9]{10}$/.test(value), {
        error: "El teléfono debe tener 10 dígitos.",
      }),
    note: z.string().trim().max(200).transform((value) => value || null),
  })
  .refine((value) => value.name !== null || (value.phone === null && value.note === null), {
    error: "Escribe el nombre de la otra persona.",
    path: ["name"],
  });
```

Keep `checkoutSchema` as it is; it still validates the shipping address when one is present.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- lib/validation/commerce.test.ts`
Expected: PASS, 3 of 3 new cases plus the file's existing ones.

- [ ] **Step 5: Point `checkoutCart` at v3**

Replace the body of `checkoutCart` in `lib/actions/cart.ts`:

```ts
export async function checkoutCart(
  shopId: number,
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const method = fulfillmentMethodSchema.safeParse(formData.get("fulfillment_method"));
  if (!method.success) {
    return { status: "error", message: "Elige recolección o envío para continuar." };
  }

  const contact = altContactSchema.safeParse({
    name: formData.get("alt_contact_name") ?? "",
    phone: formData.get("alt_contact_phone") ?? "",
    note: formData.get("alt_contact_note") ?? "",
  });
  if (!contact.success) {
    return {
      status: "error",
      message: "Revisa los datos de la otra persona.",
      errors: Object.fromEntries(
        Object.entries(contact.error.flatten().fieldErrors).map(([key, value]) => [
          `alt_contact_${key}`,
          value,
        ]),
      ),
    };
  }

  const idempotencyKey = formData.get("idempotency_key");
  const buyerNote = formData.get("buyer_note");

  // Only a shipped order has an address, and a collected one must not carry one:
  // the database refuses it, because an address on a pickup order would sit in
  // order_addresses looking like a shipment nobody agreed to.
  let address: Record<string, unknown> | null = null;
  if (method.data === "shipping") {
    const parsed = checkoutSchema.safeParse({
      recipient: formData.get("recipient"),
      address_line1: formData.get("address_line1"),
      address_line2: formData.get("address_line2"),
      locality: formData.get("locality"),
      administrative_area: formData.get("administrative_area"),
      postal_code: formData.get("postal_code"),
      country_code: formData.get("country_code"),
      delivery_instructions: formData.get("delivery_instructions"),
      buyer_note: buyerNote,
      idempotency_key: idempotencyKey,
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa los campos marcados.",
        errors: parsed.error.flatten().fieldErrors,
      };
    }
    const { buyer_note: _note, idempotency_key: _key, ...rest } = parsed.data;
    address = rest;
  }

  const supabase = await authenticatedClient();
  if (!supabase) return sessionError;

  const { data: orderId, error } = await supabase.rpc("checkout_cart_v3", {
    p_shop_id: shopId,
    p_fulfillment_method: method.data,
    p_address: address,
    p_alt_contact: contact.data.name ? contact.data : null,
    p_buyer_note: typeof buyerNote === "string" ? buyerNote : null,
    p_idempotency_key: String(idempotencyKey ?? ""),
  });

  if (error || !orderId) {
    return { status: "error", message: databaseMessage(error?.message, "No pudimos crear tu pedido.") };
  }

  revalidatePath("/compras");
  redirect(`/compras/${orderId}?creado=1`);
}
```

Add `altContactSchema` and `fulfillmentMethodSchema` to the imports from `@/lib/validation/commerce`.

- [ ] **Step 6: Extract the item list**

Create `components/orders/cart-items.tsx` holding exactly what the current page renders for the items, the subtotal and the coordination note — the `<ul>`, the quantity and remove forms, the subtotal row. It takes `items`, `subtotal`, and the two bound action factories:

```tsx
import { formatMxn } from "@/lib/format";
import type { CartDetail } from "@/lib/queries/orders.types";

export function CartItems({
  items,
  quantityAction,
  removeAction,
  subtotal,
}: {
  items: CartDetail["items"];
  quantityAction: (itemId: number) => (formData: FormData) => Promise<void>;
  removeAction: (itemId: number) => (formData: FormData) => Promise<void>;
  subtotal: number;
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li className="flex flex-wrap items-center justify-between gap-4 py-5 first:pt-0 last:pb-0" key={item.id}>
            <div>
              <h2 className="font-semibold">{item.product.name}</h2>
              <p className="mt-1 text-sm text-muted">{formatMxn(item.product.price_mxn)} por unidad</p>
            </div>
            <div className="flex items-center gap-3">
              <form action={quantityAction(item.id)}>
                <input aria-label={`Cantidad de ${item.product.name}`} className="w-20 rounded-xl border border-line px-3 py-2" defaultValue={item.quantity} max="99" min="1" name="quantity" type="number" />
                <button className="ml-2 text-sm font-semibold text-brand" type="submit">Actualizar</button>
              </form>
              <form action={removeAction(item.id)}>
                <button className="text-sm font-semibold text-sale" type="submit">Quitar</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-between border-t border-line pt-5 text-lg font-semibold">
        <span>Subtotal</span>
        <span>{formatMxn(subtotal)}</span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Pago y entrega se coordinan directamente con vendedor después de aceptar pedido.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Rewrite the page**

Replace `app/carrito/[shopId]/page.tsx` entirely:

```tsx
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { notFound } from "next/navigation";

import { BuyerPanel } from "@/components/orders/buyer-panel";
import { CartItems } from "@/components/orders/cart-items";
import { CartThreads } from "@/components/orders/cart-thread";
import { FulfillmentChoice } from "@/components/orders/fulfillment-choice";
import { ShopPanel } from "@/components/orders/shop-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { checkoutCart, removeCartItem, setCartItemQuantity } from "@/lib/actions/cart";
import { sendMessage } from "@/lib/actions/messages";
import { openConversation } from "@/lib/actions/start-conversation";
import { getPublicShop } from "@/lib/queries/catalog.server";
import { fetchBuyerProfile, fetchCartThreads, fetchPickupPoint } from "@/lib/queries/checkout.server";
import { getCart } from "@/lib/queries/orders.server";

export default async function CartPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId: rawShopId } = await params;
  const shopId = Number(rawShopId);
  if (!Number.isSafeInteger(shopId) || shopId < 1) notFound();

  const cart = await getCart(shopId);
  const backHref = cart ? `/tiendas/${cart.shop.slug}` : "/";

  if (!cart?.items.length) {
    return (
      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={backHref}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Seguir explorando
        </Link>
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag aria-hidden="true" className="size-7" />}
            title="Tu carrito está vacío"
            description="Agrega productos publicados para crear una solicitud."
          />
        </div>
      </section>
    );
  }

  const cartPath = `/carrito/${shopId}`;
  const [buyer, pickupPoint, threads, shop] = await Promise.all([
    fetchBuyerProfile(),
    fetchPickupPoint(shopId),
    fetchCartThreads(
      shopId,
      cart.items.map((item) => ({ productId: item.product.id, productName: item.product.name })),
    ),
    getPublicShop(cart.shop.slug),
  ]);

  const checkoutAction = checkoutCart.bind(null, shopId);
  const sendAction = (conversationId: number) =>
    sendMessage.bind(null, conversationId, [cartPath, `/mensajes/${conversationId}`, "/mensajes"]);
  const startAction = (productId: number) => openConversation.bind(null, shopId, productId, cartPath);

  return (
    <section className="mx-auto max-w-[86rem] px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href={backHref}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Seguir explorando
      </Link>

      <div className="mt-7">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Solicitud de compra</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">Carrito de {cart.shop.name}</h1>
      </div>

      {/* Below lg the columns stack as item, shop, buyer, thread: what is being
          bought first, who is selling it next, then the form and the chat. */}
      <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,320px)] lg:items-start">
        <div className="order-3 space-y-7 lg:order-none">
          {buyer ? <BuyerPanel buyer={buyer} /> : null}
          <div className="rounded-[2rem] border border-line bg-surface p-6">
            <h2 className="font-display text-2xl font-semibold">Entrega</h2>
            <div className="mt-5">
              <FulfillmentChoice
                action={checkoutAction}
                idempotencyKey={crypto.randomUUID()}
                pickupPoint={pickupPoint}
                threadHref="#conversacion"
              />
            </div>
          </div>
        </div>

        <div className="order-1 space-y-7 lg:order-none">
          <CartItems
            items={cart.items}
            quantityAction={(itemId) => setCartItemQuantity.bind(null, itemId)}
            removeAction={(itemId) => removeCartItem.bind(null, itemId)}
            subtotal={cart.subtotal}
          />

          <div className="order-4 rounded-[2rem] border border-line bg-surface p-6 lg:order-none" id="conversacion">
            <h2 className="font-display text-2xl font-semibold">Conversación</h2>
            {buyer ? (
              <>
                <div className="mt-5 hidden lg:block">
                  <CartThreads currentUserId={buyer.userId} sendAction={sendAction} startAction={startAction} threads={threads} />
                </div>
                <details className="mt-5 lg:hidden">
                  <summary className="cursor-pointer text-sm font-semibold text-brand">Ver mensajes</summary>
                  <div className="mt-4">
                    <CartThreads currentUserId={buyer.userId} sendAction={sendAction} startAction={startAction} threads={threads} />
                  </div>
                </details>
              </>
            ) : null}
          </div>
        </div>

        <div className="order-2 lg:order-none">
          {shop ? (
            <ShopPanel
              shop={{
                name: shop.name,
                slug: shop.slug,
                imageUrl: shop.imageUrl,
                trustTier: shop.trust_tier,
                trustMetrics: shop.trust_metrics,
                locality: pickupPoint?.locality ?? null,
              }}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
```

Note the thread is rendered twice — once for wide screens, once inside the collapsed `<details>` for narrow ones. If that proves to double the Realtime subscriptions in practice, replace it with a single instance and a CSS-only disclosure; verify with `read_console_messages` or the browser devtools before deciding.

- [ ] **Step 8: Delete the superseded form**

```bash
git rm components/orders/checkout-form.tsx
grep -rn "checkout-form\|CheckoutForm" --include="*.ts" --include="*.tsx" app components lib tests
```

Expected: no remaining references. If `components/forms-preserve-input.test.tsx` imports it, update that test to use `FulfillmentChoice` instead, choosing shipping first so the address fields exist.

- [ ] **Step 9: Verify**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(checkout): give the purchase request three columns"
```

---

### Task 11: Pickup on the order pages

**Files:**
- Modify: `lib/queries/orders.server.ts:49-59` (`getOrderDetail` select) and `lib/queries/orders.ts` (`mapOrderDetailRow`)
- Modify: `lib/queries/orders.types.ts` (`OrderDetail`)
- Create: `components/orders/fulfillment-summary.tsx`
- Create: `components/orders/fulfillment-summary.test.tsx`
- Modify: `app/compras/[id]/page.tsx`
- Modify: `app/panel/pedidos/[id]/page.tsx`

**Interfaces:**
- Consumes: `fetchPickupPoint` (Task 6), `orders.fulfillment_method` and the alternate contact columns (Task 2).
- Produces: `OrderDetail` gains `fulfillment_method: "pickup" | "shipping"` and `alt_contact: { name: string; phone: string | null; note: string | null } | null`. Component `<FulfillmentSummary order={…} pickupPoint={…} />`.

- [ ] **Step 1: Write the failing test**

Create `components/orders/fulfillment-summary.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FulfillmentSummary } from "@/components/orders/fulfillment-summary";

afterEach(cleanup);

const address = {
  recipient: "Ana Ruiz",
  address_line1: "Calle 1",
  address_line2: null,
  locality: "Zapopan",
  administrative_area: "Jalisco",
  postal_code: "45010",
  country_code: "MX",
  delivery_instructions: null,
  redacted_at: null,
};

describe("FulfillmentSummary", () => {
  it("shows the delivery address for a shipped order", () => {
    render(
      <FulfillmentSummary
        altContact={null}
        address={address}
        fulfillmentMethod="shipping"
        pickupPoint={null}
      />,
    );

    expect(screen.getByText("Envío a domicilio")).toBeInTheDocument();
    expect(screen.getByText("Calle 1")).toBeInTheDocument();
  });

  it("withholds the street for a pending pickup order", () => {
    render(
      <FulfillmentSummary
        altContact={null}
        address={null}
        fulfillmentMethod="pickup"
        pickupPoint={{ locality: "Zapopan", administrative_area_code: "MX-JAL" }}
      />,
    );

    expect(screen.getByText("Recolección en tienda")).toBeInTheDocument();
    expect(screen.getByText(/Zapopan/)).toBeInTheDocument();
    expect(
      screen.getByText("Verás la dirección completa cuando el vendedor acepte tu pedido."),
    ).toBeInTheDocument();
  });

  it("shows the street once it has been revealed", () => {
    render(
      <FulfillmentSummary
        altContact={null}
        address={null}
        fulfillmentMethod="pickup"
        pickupPoint={{
          locality: "Zapopan",
          administrative_area_code: "MX-JAL",
          address_line1: "Av. Vallarta 1234",
          postal_code: "45010",
          notes: "Portón verde",
        }}
      />,
    );

    expect(screen.getByText("Av. Vallarta 1234")).toBeInTheDocument();
    expect(screen.getByText("Portón verde")).toBeInTheDocument();
  });

  it("names the person collecting when there is one", () => {
    render(
      <FulfillmentSummary
        altContact={{ name: "Luis Ruiz", phone: "+523312345678", note: "mi hermano" }}
        address={null}
        fulfillmentMethod="pickup"
        pickupPoint={{ locality: "Zapopan", administrative_area_code: "MX-JAL" }}
      />,
    );

    expect(screen.getByText("Luis Ruiz")).toBeInTheDocument();
    expect(screen.getByText("mi hermano")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/orders/fulfillment-summary.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Write the component**

Create `components/orders/fulfillment-summary.tsx`:

```tsx
import type { PickupPoint } from "@/lib/queries/checkout";
import { MEXICO_ADMINISTRATIVE_AREAS } from "@/lib/shop-location";
import type { OrderDetail } from "@/lib/queries/orders.types";

function areaName(code: string) {
  return MEXICO_ADMINISTRATIVE_AREAS.find((area) => area.code === code)?.label ?? code;
}

/**
 * How this order gets to its buyer.
 *
 * A collected order has no address of its own — the address belongs to the shop,
 * and `shop_pickup_point` hands over the street only once the seller has accepted.
 * Until then this shows the city, and says why.
 */
export function FulfillmentSummary({
  altContact,
  address,
  fulfillmentMethod,
  pickupPoint,
}: {
  altContact: { name: string; phone: string | null; note: string | null } | null;
  address: OrderDetail["address"];
  fulfillmentMethod: "pickup" | "shipping";
  pickupPoint: PickupPoint | null;
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <h2 className="font-display text-xl font-semibold">
        {fulfillmentMethod === "pickup" ? "Recolección en tienda" : "Envío a domicilio"}
      </h2>

      {fulfillmentMethod === "shipping" ? (
        address?.redacted_at ? (
          <p className="mt-3 text-sm text-muted">Dirección eliminada según política de retención.</p>
        ) : (
          <address className="mt-3 not-italic leading-7 text-muted">
            {address?.recipient}
            <br />
            {address?.address_line1}
            {address?.address_line2 ? `, ${address.address_line2}` : ""}
            <br />
            {address?.locality}, {address?.administrative_area} {address?.postal_code}
            <br />
            {address?.country_code}
          </address>
        )
      ) : pickupPoint ? (
        <div className="mt-3 leading-7 text-muted">
          {pickupPoint.address_line1 ? (
            <address className="not-italic">
              {pickupPoint.address_line1}
              <br />
              {pickupPoint.locality}, {areaName(pickupPoint.administrative_area_code)}{" "}
              {pickupPoint.postal_code}
              {pickupPoint.notes ? (
                <>
                  <br />
                  {pickupPoint.notes}
                </>
              ) : null}
            </address>
          ) : (
            <>
              <p className="font-semibold text-ink">
                {pickupPoint.locality}, {areaName(pickupPoint.administrative_area_code)}
              </p>
              <p className="mt-1 text-sm">
                Verás la dirección completa cuando el vendedor acepte tu pedido.
              </p>
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          El punto de recolección se acuerda en la conversación.
        </p>
      )}

      {altContact ? (
        <div className="mt-5 border-t border-line pt-4 text-sm leading-6">
          <p className="font-semibold text-ink">
            {fulfillmentMethod === "pickup" ? "Recoge" : "Recibe"}: {altContact.name}
          </p>
          {altContact.phone ? <p className="text-muted">{altContact.phone}</p> : null}
          {altContact.note ? <p className="text-muted">{altContact.note}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/orders/fulfillment-summary.test.tsx`
Expected: PASS, 4 of 4.

- [ ] **Step 5: Carry the new columns through the query**

In `lib/queries/orders.server.ts`, add `fulfillment_method, alt_contact_name, alt_contact_phone, alt_contact_note` to the `getOrderDetail` select string (it is one long `.select(...)` at line 54). In `lib/queries/orders.ts`, `mapOrderDetailRow` maps them onto:

```ts
    fulfillment_method: row.fulfillment_method,
    alt_contact: row.alt_contact_name
      ? { name: row.alt_contact_name, phone: row.alt_contact_phone, note: row.alt_contact_note }
      : null,
```

Add both to `OrderDetail` in `lib/queries/orders.types.ts`, and to `OrderDetailRow` wherever that type is declared.

- [ ] **Step 6: Use it on both order pages**

In `app/compras/[id]/page.tsx`, fetch the pickup point when the order is a pickup:

```tsx
  const pickupPoint = order.fulfillment_method === "pickup"
    ? await fetchPickupPoint(order.shop.id)
    : null;
```

and replace the existing `<div>` with the `Entrega` heading and the `<address>` inside the `<aside>` with:

```tsx
              <FulfillmentSummary
                altContact={order.alt_contact}
                address={order.address}
                fulfillmentMethod={order.fulfillment_method}
                pickupPoint={pickupPoint}
              />
```

Do exactly the same in `app/panel/pedidos/[id]/page.tsx`. The seller always sees the full address, because `shop_pickup_point` answers an owner with it.

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, including `app/panel/pedidos/[id]/page.test.tsx`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(orders): show a collected order's pickup point once it is accepted"
```

---

### Task 12: End-to-end

**Files:**
- Modify: `tests/e2e/purchase-intent.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Write the failing tests**

Append to `tests/e2e/purchase-intent.spec.ts`, reusing its `register` helper and the local-stack guard already at the top of the file:

```ts
test("a buyer must choose how they receive the item", async ({ browser }) => {
  const stamp2 = Date.now();
  const seller2 = { email: `seller2-${stamp2}@test.local`, password: "plaza-volcanes-1", name: "Vendedor Dos" };
  const buyer2 = { email: `buyer2-${stamp2}@test.local`, password: "plaza-volcanes-1", name: "Bea Lopez" };

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await register(sellerPage, seller2);

  await sellerPage.goto("/panel/tiendas/nueva");
  await sellerPage.getByLabel("Nombre de la tienda").fill(`Tienda ${stamp2}`);
  await sellerPage.getByLabel("Descripción").fill("Descripción completa de la tienda de prueba para recolección.");
  await sellerPage.getByLabel("Estado principal").selectOption("MX-JAL");
  await sellerPage.getByLabel("Ofrezco recolección en tienda").check();
  await sellerPage.getByLabel("Calle y número de recolección").fill("Av. Vallarta 1234");
  await sellerPage.getByLabel("Ciudad de recolección").fill("Zapopan");
  await sellerPage.getByLabel("Estado de recolección").selectOption("MX-JAL");
  await sellerPage.getByLabel("Código postal de recolección").fill("45010");
  await sellerPage.getByRole("button", { name: "Crear tienda" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/tiendas\//);

  // Publish one product. Follow the steps the existing spec above already uses.
  // (Copy them verbatim from the first test in this file rather than factoring
  // them out — the two tests are read independently.)

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await register(buyerPage, buyer2);

  await buyerPage.goto(`/tiendas/tienda-${stamp2}`);
  await buyerPage.getByRole("link", { name: /Taza/ }).click();
  await buyerPage.getByRole("button", { name: "Solicitar compra" }).click();
  await expect(buyerPage).toHaveURL(/\/carrito\//);

  // Neither option chosen: the request cannot be sent.
  await expect(buyerPage.getByRole("button", { name: "Confirmar solicitud" })).toBeDisabled();
  await expect(buyerPage.getByText("Elige una opción para continuar.")).toBeVisible();

  // Pickup shows the city and withholds the street.
  await buyerPage.getByLabel("Recolección en tienda").check();
  await expect(buyerPage.getByText(/Zapopan/)).toBeVisible();
  await expect(buyerPage.getByText("Av. Vallarta 1234")).toHaveCount(0);
  await expect(buyerPage.getByRole("button", { name: "Confirmar solicitud" })).toBeEnabled();

  await buyerPage.getByRole("button", { name: "Confirmar solicitud" }).click();
  await expect(buyerPage).toHaveURL(/\/compras\/\d+/);

  // Still pending, so still no street.
  await expect(buyerPage.getByText("Recolección en tienda")).toBeVisible();
  await expect(buyerPage.getByText("Av. Vallarta 1234")).toHaveCount(0);

  await sellerContext.close();
  await buyerContext.close();
});

test("choosing shipping asks for an address and creates a shipped order", async ({ browser }) => {
  const stamp3 = Date.now();
  const seller3 = { email: `seller3-${stamp3}@test.local`, password: "plaza-volcanes-1", name: "Vendedor Tres" };
  const buyer3 = { email: `buyer3-${stamp3}@test.local`, password: "plaza-volcanes-1", name: "Cris Mora" };

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await register(sellerPage, seller3);

  await sellerPage.goto("/panel/tiendas/nueva");
  await sellerPage.getByLabel("Nombre de la tienda").fill(`Tienda ${stamp3}`);
  await sellerPage.getByLabel("Descripción").fill("Descripción completa de la tienda de prueba para envío.");
  await sellerPage.getByLabel("Estado principal").selectOption("MX-JAL");
  await sellerPage.getByRole("button", { name: "Crear tienda" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/tiendas\//);

  // Publish one product, copying the steps the first test in this file uses.

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await register(buyerPage, buyer3);

  await buyerPage.goto(`/tiendas/tienda-${stamp3}`);
  await buyerPage.getByRole("link", { name: /Taza/ }).click();
  await buyerPage.getByRole("button", { name: "Solicitar compra" }).click();
  await expect(buyerPage).toHaveURL(/\/carrito\//);

  await buyerPage.getByLabel("Envío a domicilio").check();
  await buyerPage.getByLabel("Nombre de quien recibe").fill("Cris Mora");
  await buyerPage.getByLabel("Calle y número").fill("Calle Falsa 123");
  await buyerPage.getByLabel("Ciudad o localidad").fill("Guadalajara");
  await buyerPage.getByLabel("Estado").fill("Jalisco");
  await buyerPage.getByLabel("Código postal").fill("44100");

  await buyerPage.getByRole("button", { name: "Confirmar solicitud" }).click();
  await expect(buyerPage).toHaveURL(/\/compras\/\d+/);

  await expect(buyerPage.getByText("Envío a domicilio")).toBeVisible();
  await expect(buyerPage.getByText("Calle Falsa 123")).toBeVisible();

  await sellerContext.close();
  await buyerContext.close();
});
```

Both tests need a published product. Copy the product-publishing steps verbatim from the first test in this file rather than factoring them into a helper — Playwright specs here are written to be read one test at a time, and the existing spec follows that convention.

- [ ] **Step 2: Run them to verify they fail before the app is running the new page**

Run: `npm run test:e2e -- purchase-intent`
Expected: the two new tests FAIL. If they pass immediately, the selectors are matching the wrong thing — check them before moving on.

- [ ] **Step 3: Fix whatever they surface, then re-run**

Run: `npm run test:e2e -- purchase-intent`
Expected: PASS, including the original purchase-intent test.

- [ ] **Step 4: Full verification**

Run: `npx supabase db reset && npx supabase test db && npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/purchase-intent.spec.ts
git commit -m "test(e2e): cover both ways of receiving a purchase"
```

---

## Self-Review Notes

Checked against the spec:

- Schema (`shop_pickup_points`, reveal gate, `orders` columns, `checkout_cart_v3`) → Tasks 1-2.
- Seller pickup UI and persistence → Tasks 3-5.
- Three columns, mandatory choice, alternate contact, thread tabs, mobile order → Tasks 6-10.
- Order pages → Task 11.
- Tests: the spec lists 14 pgTAP cases; Tasks 1-2 carry 18 assertions across the two files, covering all 14. Unit and e2e → Tasks 3-12.

Two spec details deliberately implemented differently, both noted in place:

1. The spec's pgTAP list numbers cases 1-14 across one imagined file; the plan splits them into `shop_pickup_points.test.sql` and `order_fulfillment.test.sql` so each migration's tests fail before its own migration exists.
2. The thread is rendered twice on the page (wide and collapsed-narrow). Task 10 Step 7 flags this as the one thing to verify in a browser rather than in a test.
