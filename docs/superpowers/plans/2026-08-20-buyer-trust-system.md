# Buyer Trust System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build seller-visible buyer trust from auditable payment, cancellation, response, purchase, claim, review, verification, and activity evidence.

**Architecture:** Expand orders with backward-compatible payment evidence and v2 checkout, then add buyer response/activity evidence. Private deterministic PostgreSQL functions aggregate metrics into append-only evaluations and a cached tier through a retrying queue. Seller order UI consumes a safe order-scoped projection and renders Spanish standing/markers.

**Tech Stack:** PostgreSQL 17, Supabase Auth/RLS/pg_cron, pgTAP, Next.js 16 Server Components/Actions, TypeScript, Vitest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-20-buyer-trust-system-design.md`

## Global Constraints

- Seller confirms payment; payment-required orders cannot ship before confirmation.
- Existing `checkout_cart` remains payment-optional; new application calls `checkout_cart_v2`.
- Pre-acceptance buyer cancellations do not enter trust metrics.
- Rates use rolling 90 days; completed purchases remain lifetime.
- Null fails positive thresholds and renders exact canonical signal `No data`.
- Evaluator returns exact prompt keys with no extra fields; tooltips contain at most 22 words.
- Canonical tiers/signals remain English; product UI remains Spanish.
- Buyer trust has no public surface.
- Preserve existing data and never synthesize historical payment timestamps.

---

### Task 1: Payment-required checkout and cancellation evidence

**Files:**
- Modify: `supabase/migrations/20260820191826_add_buyer_trust_system.sql`
- Create: `supabase/tests/database/buyer_trust_evidence.test.sql`
- Modify: `lib/actions/cart.ts`
- Create: `lib/actions/buyer-order-evidence.ts`
- Create: `lib/actions/buyer-order-evidence.test.ts`
- Modify: `lib/validation/order-events.ts`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces `orders.payment_confirmation_required`, `payment_completed_at`, `payment_confirmed_by`, and `seller_cancellation_reason`.
- Produces `checkout_cart_v2(bigint,jsonb,text,uuid) returns bigint`.
- Produces `confirm_order_payment(bigint,uuid)`, `cancel_order_by_buyer(bigint,uuid)`, and `cancel_order_by_seller(bigint,text,uuid)`.
- Produces server actions `confirmOrderPayment`, `cancelBuyerOrder`, and `cancelSellerOrder`.

- [ ] **Step 1: Write failing pgTAP evidence tests**

Cover exact columns/functions, legacy checkout flag false, v2 flag true, seller-only payment confirmation, idempotency, v2 shipment rejection before payment, shipment success after payment, legacy shipment compatibility, accepted buyer cancellation, ignored pre-acceptance cancellation evidence, and seller non-payment reason validation.

```sql
select throws_ok(
  $$select public.mark_order_shipped((select id from public.orders where payment_confirmation_required limit 1), null, gen_random_uuid())$$,
  'P0001', 'Confirma el pago antes de enviar.',
  'payment-required order cannot ship before confirmation'
);
select lives_ok(
  $$select public.mark_order_shipped((select id from public.orders where not payment_confirmation_required limit 1), null, gen_random_uuid())$$,
  'legacy order remains shippable'
);
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npx supabase test db supabase/tests/database/buyer_trust_evidence.test.sql`
Expected: missing columns/functions fail.

- [ ] **Step 3: Implement compatibility-safe SQL evidence path**

Use private `checkout_cart_internal(..., p_payment_confirmation_required boolean)` for atomic shared checkout logic. Keep exact old RPC signature as false wrapper; add v2 true wrapper. All public definer RPCs must check `auth.uid()`, order ownership/state, and idempotency; revoke `PUBLIC`/`anon`, grant only `authenticated`.

```sql
if v_order.payment_confirmation_required and v_order.payment_completed_at is null then
  raise exception using errcode = 'P0001', message = 'Confirma el pago antes de enviar.';
end if;
```

- [ ] **Step 4: Run evidence tests to GREEN**

Run: `npx supabase test db supabase/tests/database/buyer_trust_evidence.test.sql`
Expected: all evidence and compatibility assertions pass.

- [ ] **Step 5: Write failing Vitest validation/action tests**

Assert checkout calls `checkout_cart_v2`; seller cancellation accepts only `buyer_non_payment|inventory_unavailable|seller_unavailable|other`; Spanish database errors map cleanly.

- [ ] **Step 6: Implement actions, validation, and generated-shape types**

`checkoutCart` switches only to v2. `confirmOrderPayment` and cancellation actions validate UUID idempotency keys, revalidate buyer/seller order routes, and return `ActionState`.

- [ ] **Step 7: Run focused app tests and typecheck**

Run: `npm test -- lib/actions && npm run typecheck`
Expected: action/validation tests and TypeScript pass.

- [ ] **Step 8: Commit evidence slice**

```bash
git add supabase/migrations/20260820191826_add_buyer_trust_system.sql supabase/tests/database/buyer_trust_evidence.test.sql lib/actions/cart.ts lib/actions/buyer-order-evidence.ts lib/actions/buyer-order-evidence.test.ts lib/validation/order-events.ts lib/database.types.ts
git commit -m "feat: add buyer payment evidence"
```

---

### Task 2: Buyer response clocks and meaningful activity

**Files:**
- Modify: `supabase/migrations/20260820191826_add_buyer_trust_system.sql`
- Extend: `supabase/tests/database/buyer_trust_evidence.test.sql`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces `buyer_response_events` with one open clock per order conversation.
- Produces `buyer_activity_events` with constrained meaningful activity keys.
- Extends existing message/order/review/claim writers; no direct client inserts.

- [ ] **Step 1: Add failing pgTAP clock/activity tests**

Assert first seller order message opens one buyer clock, repeated seller message does not duplicate it, buyer reply closes it with elapsed minutes, pre-sale seller message creates no clock, and only listed buyer actions create activity.

```sql
select results_eq(
  $$select count(*) from public.buyer_response_events where replied_at is null$$,
  array[1::bigint],
  'repeated seller messages share one buyer clock'
);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx supabase test db supabase/tests/database/buyer_trust_evidence.test.sql`
Expected: missing buyer evidence tables fail.

- [ ] **Step 3: Implement tables, indexes, triggers, grants, and RLS**

Participants may select response events; direct mutations remain unavailable. Buyer activity is readable only by buyer, shared-order sellers, and admins. Extend message capture transaction so seller order messages open clocks and buyer order replies close them.

- [ ] **Step 4: Run focused and existing fulfillment tests**

Run: `npx supabase test db supabase/tests/database/buyer_trust_evidence.test.sql supabase/tests/database/fulfillment_communication.test.sql`
Expected: buyer and seller response clocks both pass.

- [ ] **Step 5: Commit response/activity slice**

```bash
git add supabase/migrations/20260820191826_add_buyer_trust_system.sql supabase/tests/database/buyer_trust_evidence.test.sql lib/database.types.ts
git commit -m "feat: record buyer response evidence"
```

---

### Task 3: Exact buyer evaluator, aggregation, history, and queue

**Files:**
- Modify: `supabase/migrations/20260820191826_add_buyer_trust_system.sql`
- Create: `supabase/tests/database/buyer_trust_evaluator.test.sql`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces `private.evaluate_buyer_trust(date,text,bigint,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer) returns jsonb`.
- Produces `buyer_trust_profiles`, `buyer_trust_evaluations`, and `private.buyer_trust_evaluation_queue`.
- Produces `private.evaluate_buyer_trust_profile(uuid)`, `private.process_buyer_trust_queue(integer)`, and `private.enqueue_all_buyer_trust_profiles()`.

- [ ] **Step 1: Write table-driven failing evaluator tests**

Test exact seven top-level keys, exact nested marker keys, exact tier values, every Reliable/Top Buyer boundary and immediately failing side, every null required input, all signal boundaries, `No data`, tooltip word counts, real member/verification copy, actual values in reasons/gaps, and no post-delivery completion markers.

```sql
select is(
  private.evaluate_buyer_trust('2026-01-01','verified',25,97,2,1,3,98,36,80,90,60,75,14)->>'buyer_trust_tier',
  'Top Buyer',
  'exact Top Buyer boundaries qualify'
);
```

- [ ] **Step 2: Run evaluator tests and confirm RED**

Run: `npx supabase test db supabase/tests/database/buyer_trust_evaluator.test.sql`
Expected: evaluator/history/queue objects missing.

- [ ] **Step 3: Implement exact deterministic evaluator**

Return Spanish `primary_text`, tooltips, summary, reasons, and gaps while preserving exact English tier/signal enums. Build marker objects explicitly; never merge arbitrary JSON. Null formatting must never print invented zero.

- [ ] **Step 4: Implement aggregation and metric cohorts**

Use lifetime completed count; 90-day outcome cohort for completion/cancellation; payment evidence cohort for payment/close metrics; first-shipment cohort for claims; completed cohort for reviews; order-only response clocks; latest meaningful activity. Zero denominators return null.

- [ ] **Step 5: Implement secure cache/history/queue**

Create a profile when `user_trust_profiles` is created. Dirty triggers upsert by buyer UUID. Worker uses `FOR UPDATE SKIP LOCKED`; failed jobs retain cache/history and back off `2^attempt_count` minutes capped at 60. Daily 00:30 UTC sweep resets stale queue entries. Five-minute worker uses named cron job.

- [ ] **Step 6: Add RLS and failure-path pgTAP tests**

Assert anonymous/unrelated seller sees no row, shared-order seller and buyer can read allowed rows, successful evaluation appends history, failures preserve prior snapshot and retain retry evidence, dedup works, and daily enqueue includes stale profiles.

- [ ] **Step 7: Reset local database and run full pgTAP/advisors**

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --local --level warning
npx supabase db advisors --local --type all --level warn --fail-on none
```

Expected: all pgTAP and schema lint pass; advisor output contains no new missing-RLS or unintended privilege warnings.

- [ ] **Step 8: Commit evaluator slice**

```bash
git add supabase/migrations/20260820191826_add_buyer_trust_system.sql supabase/tests/database/buyer_trust_evaluator.test.sql lib/database.types.ts
git commit -m "feat: evaluate buyer trust tiers"
```

---

### Task 4: Seller buyer-standing UI and order controls

**Files:**
- Create: `lib/buyer-trust.ts`
- Create: `lib/buyer-trust.test.ts`
- Create: `lib/queries/buyer-trust.server.ts`
- Create: `components/orders/buyer-trust-card.tsx`
- Modify: `components/orders/order-actions.tsx`
- Modify: `lib/queries/orders.server.ts`
- Modify: `app/panel/pedidos/[id]/page.tsx`
- Create: `app/panel/pedidos/[id]/page.test.tsx`

**Interfaces:**
- Produces `BuyerTrustOutput` matching exact evaluator JSON.
- Produces `getBuyerTrustForOrder(orderId: number): Promise<BuyerTrustOutput | null>`.
- Produces `getBuyerStanding(output): string`, e.g. `Confiable · Cierra rápido`.
- Produces `BuyerTrustCard` with Spanish labels and canonical-to-Spanish signal mapping.

- [ ] **Step 1: Write failing formatting tests**

Test `New → Nuevo`, `Reliable → Confiable`, `Top Buyer → Comprador destacado`; every signal translation; standing priority fast close, payment, completion, response; no suffix without positive evidence.

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- lib/buyer-trust.test.ts`
Expected: module missing.

- [ ] **Step 3: Implement strict output parser/formatter**

Reject malformed evaluator JSON by returning null from query. UI maps canonical values only; never renders arbitrary HTML or database-provided class names.

- [ ] **Step 4: Write failing seller-page tests**

Mock seller order and trust query. Assert short standing, member/verification, ten marker labels, expandable gaps, payment button on accepted unpaid v2 order, shipment hidden until payment, cancellation reason control, and no buyer card for buyer viewer/public pages.

- [ ] **Step 5: Implement safe seller query and Spanish UI**

Query through RLS using authenticated server client and exact order ID. Render card only when `viewer_role === 'seller'`. Extend order detail projection with payment fields. `OrderActions` exposes payment, shipment, buyer cancellation, and seller structured cancellation only in valid states.

- [ ] **Step 6: Run UI/app gates**

Run:

```bash
npm test -- lib/buyer-trust.test.ts 'app/panel/pedidos/[id]/page.test.tsx'
npm run typecheck
npm run lint
npm run build
```

Expected: focused tests, typecheck, lint, and production build pass.

- [ ] **Step 7: Commit UI slice**

```bash
git add lib/buyer-trust.ts lib/buyer-trust.test.ts lib/queries/buyer-trust.server.ts components/orders/buyer-trust-card.tsx components/orders/order-actions.tsx lib/queries/orders.server.ts app/panel/pedidos/[id]/page.tsx app/panel/pedidos/[id]/page.test.tsx
git commit -m "feat: show buyer trust to sellers"
```

---

### Task 5: Final verification and linked rollout

**Files:**
- Verify all changed files and migration history.

**Interfaces:**
- Consumes every prior slice.
- Produces verified local commits and linked Supabase migration state.

- [ ] **Step 1: Run complete local gates from committed tree**

```bash
git diff --check
npm test
npm run typecheck
npm run lint
npx supabase test db
npx supabase db lint --local --level warning
npm run build
```

Expected: zero failures and clean schema lint.

- [ ] **Step 2: Review authorization and compatibility requirements**

Confirm exact RPC grants, fixed search paths, RLS on every exposed table, unrelated-seller isolation, v1 legacy checkout still callable, v2 required by current application, payment-required shipment guard, and no synthesized timestamps.

- [ ] **Step 3: Dry-run and push linked migration**

```bash
npx supabase db push --help
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked --yes
```

Expected: only `20260820191826_add_buyer_trust_system.sql` applies.

- [ ] **Step 4: Verify linked state**

Run linked migration list, schema lint, advisors, read-only table/function/cron queries, then process initial queue through canonical worker and confirm queue empties with evaluation history appended.

- [ ] **Step 5: Preserve user work and clean local runtime**

Confirm `git status --short` contains only pre-existing `.env.example` and `.gitignore` changes. Stop local Supabase and Colima only if this execution started them.
