# Trust Tier Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggregate auditable performance metrics, evaluate exact tiers, process dirty shops, and expose Spanish seller/public trust surfaces.

**Architecture:** Pure private SQL evaluator receives exact metric contract and returns exact JSONB keys. Shop evaluator aggregates lifetime and rolling-90-day data, applies open-dispute promotion block, appends history, and caches effective tier/limit atomically. Triggers dirty affected shops; pg_cron processes queue and daily refresh.

**Tech Stack:** Postgres 17, pg_cron, Supabase, pgTAP, Next.js Server Components, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-shop-trust-tier-commerce-system-design.md`

## Global Constraints

- Exact tiers: Standard/15, Reliable/40, Top Rated/100.
- Null fails every directly applicable gate; system review count emits zero.
- Rating gate waived only below threshold.
- Open dispute blocks promotion and preserves current tier.
- Summary stays at most 35 words; JSON has exactly five output keys.

---

### Task 1: Exact evaluator contract

**Files:**
- Create: `supabase/tests/database/trust_tier_evaluator.test.sql`
- Modify: `supabase/migrations/20260820173555_add_shop_trust_tiers.sql`

**Interfaces:**
- Produces pure function `private.evaluate_trust_tier(numeric,numeric,numeric,numeric,numeric,numeric,bigint,numeric,bigint,integer) returns jsonb`.
- Output keys: `trust_tier`, `free_listing_limit`, `reasons`, `next_tier_requirements`, `summary`.

- [ ] **Step 1: Write failing table-driven pgTAP tests covering every threshold, one value on each side, each null metric, rating gates, exact keys, limits, and summary length.**
- [ ] **Step 2: Run focused pgTAP and confirm missing-function failures.**
- [ ] **Step 3: Implement pure deterministic evaluator using exact comparison rules and Spanish explanatory text.**
- [ ] **Step 4: Run evaluator tests to green.**

### Task 2: Aggregation, queue, schedules, and trust UI

**Files:**
- Extend: `supabase/tests/database/trust_tier_evaluator.test.sql`
- Modify: `supabase/migrations/20260820173555_add_shop_trust_tiers.sql`
- Create: `lib/trust-tiers.ts`
- Create: `lib/trust-tiers.test.ts`
- Create: `components/shops/trust-tier-badge.tsx`
- Create: `components/shops/trust-dashboard-card.tsx`
- Modify: `lib/queries/catalog.server.ts`
- Modify: `app/tiendas/[slug]/page.tsx`
- Modify: `app/panel/tiendas/[id]/page.tsx`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces: `shop_trust_evaluation_queue`, `shop_trust_evaluations`.
- Produces internal functions: `private.evaluate_shop_trust`, `private.process_shop_trust_queue`, `private.enqueue_all_shops`.
- `formatTrustTier('standard'|'reliable'|'top_rated')` returns Spanish badge copy.

- [ ] **Step 1: Add failing pgTAP tests for metric aggregation, dirty deduplication, failed-evaluation snapshot preservation, promotion block, queue claim, and daily enqueue.**
- [ ] **Step 2: Run focused tests and observe missing behavior.**
- [ ] **Step 3: Implement evaluation history, aggregation, policy wrapper, queue triggers, SKIP LOCKED processing, retry state, and named cron jobs at five-minute and 00:15 UTC schedules.**
- [ ] **Step 4: Run all database tests and advisors.**
- [ ] **Step 5: Write failing Vitest tests for Spanish tier labels and public/seller rendering.**
- [ ] **Step 6: Implement formatting, public badge, private metric card, listing usage, and safe DTO projections.**
- [ ] **Step 7: Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.**
- [ ] **Step 8: Reset local database, rerun pgTAP, push migrations to linked project, verify remote migration list and smoke-query schema/functions.**
- [ ] **Step 9: Commit as `feat: activate marketplace trust tiers`.**
