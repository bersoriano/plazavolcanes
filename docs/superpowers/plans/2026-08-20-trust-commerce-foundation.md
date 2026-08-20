# Trust Commerce Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auditable carts, checkout, order snapshots, basic lifecycle, and Standard/15 publication enforcement.

**Architecture:** PostgreSQL owns checkout atomicity, authorization, immutable snapshots, and publication concurrency. Next.js Server Actions validate Spanish forms and call narrow RPCs; server-only queries return minimal DTOs.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Zod 4, Supabase/Postgres 17, pgTAP, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-shop-trust-tier-commerce-system-design.md`

## Global Constraints

- Work directly on `main` because user explicitly authorized it.
- Preserve unstaged `.env.example` deletion and `.gitignore` modification.
- Spanish product copy; English developer communication.
- No online payment and no LLM dependency.
- Every exposed table uses RLS and explicit grants.
- Existing published products remain published; new publication limit starts at 15.

---

### Task 1: Commerce schema and invariant tests

**Files:**
- Create: `supabase/tests/database/commerce_foundation.test.sql`
- Modify: `supabase/migrations/20260820173550_add_commerce_foundation.sql`

**Interfaces:**
- Produces: `public.carts`, `public.cart_items`, `public.orders`, `public.order_items`, `public.order_addresses`, `public.order_events`.
- Produces RPCs: `add_cart_item(bigint,integer)`, `set_cart_item_quantity(bigint,integer)`, `remove_cart_item(bigint)`, `checkout_cart(bigint,jsonb,text,uuid)`.
- Produces shop fields: `trust_tier`, `listing_limit`, `trust_evaluated_at`, `time_zone`; product field `handling_days`.

- [ ] **Step 1: Write failing pgTAP tests**

```sql
select has_table('public', 'orders', 'orders table exists');
select throws_ok(
  $$select public.add_cart_item(:seller_product_id, 1)$$,
  'P0001', 'No puedes comprar en tu propia tienda.',
  'seller cannot order from own shop'
);
select throws_ok(
  $$update public.products set status = 'published' where id = :sixteenth_draft_id$$,
  'P0001', 'Límite de publicaciones alcanzado.',
  'transactional guard blocks sixteenth publication'
);
```

- [ ] **Step 2: Run `npx supabase test db commerce_foundation.test.sql` and confirm missing-table/function failures.**
- [ ] **Step 3: Implement tables, constraints, indexes, grants, RLS, checkout RPCs, immutable snapshot triggers, and shop-row publication lock.**
- [ ] **Step 4: Run focused pgTAP test and confirm pass.**
- [ ] **Step 5: Run all database tests and confirm existing catalog behavior remains green.**
- [ ] **Step 6: Commit schema and test as `feat: add marketplace order foundation`.**

### Task 2: Commerce validation, actions, queries, and pages

**Files:**
- Create: `lib/validation/commerce.ts`
- Create: `lib/validation/commerce.test.ts`
- Create: `lib/actions/cart.ts`
- Create: `lib/actions/orders.ts`
- Create: `lib/queries/orders.server.ts`
- Create: `components/orders/add-to-cart-form.tsx`
- Create: `components/orders/checkout-form.tsx`
- Create: `app/carrito/[shopId]/page.tsx`
- Create: `app/compras/page.tsx`
- Create: `app/compras/[id]/page.tsx`
- Create: `app/panel/pedidos/page.tsx`
- Create: `app/panel/pedidos/[id]/page.tsx`
- Modify: `app/productos/[id]/page.tsx`
- Modify: `components/layout/site-header.tsx`
- Modify: `lib/database.types.ts`

**Interfaces:**
- `addToCart(productId, previousState, formData): Promise<ActionState>`
- `checkoutCart(shopId, previousState, formData): Promise<ActionState>`
- `getBuyerOrders(): Promise<OrderSummary[]>`
- `getSellerOrders(): Promise<OrderSummary[]>`
- `getOrderDetail(orderId): Promise<OrderDetail | null>`

- [ ] **Step 1: Write failing Zod tests for quantity 1–99, required Mexican address fields, bounded note, and UUID idempotency key.**
- [ ] **Step 2: Run `npm test -- lib/validation/commerce.test.ts` and confirm missing-module failure.**
- [ ] **Step 3: Implement schemas, then rerun focused test to green.**
- [ ] **Step 4: Add Server Actions with per-action auth, expected-error return values, RPC calls, and route revalidation.**
- [ ] **Step 5: Add server-only DTO queries and Spanish buyer/seller/cart pages. Product page adds `Solicitar compra`; header adds `Mis compras`.**
- [ ] **Step 6: Update generated-style database types for new tables and RPCs.**
- [ ] **Step 7: Run `npm test`, `npm run typecheck`, and `npm run lint`.**
- [ ] **Step 8: Commit as `feat: add buyer and seller order flows`.**
