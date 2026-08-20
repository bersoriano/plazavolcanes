# Trust Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-review-per-order evidence, disputes, private admin authority, resolution audit, and address retention.

**Architecture:** Reviews bind to completed orders and buyers. Disputes bind to orders and are resolved only through audited admin RPCs backed by private membership. Daily retention redacts addresses after policy deadlines.

**Tech Stack:** Postgres 17, pg_cron, Supabase RLS/RPC, Next.js Server Actions, pgTAP, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-shop-trust-tier-commerce-system-design.md`

## Global Constraints

- Only completed-order buyer creates one immutable review.
- Only admin resolution may set `seller_fault`.
- User metadata never grants admin access.
- Address redaction: 90 days after terminal event, or 90 days after dispute resolution.

---

### Task 1: Review, dispute, admin, and retention schema

**Files:**
- Create: `supabase/tests/database/trust_evidence.test.sql`
- Modify: `supabase/migrations/20260820173553_add_reviews_disputes.sql`

**Interfaces:**
- Produces: `order_reviews`, `order_disputes`, `private.admin_users`, `private.admin_audit_events`.
- Produces RPCs: `create_order_review`, `open_order_dispute`, `respond_to_dispute`, `resolve_order_dispute`, `is_current_user_admin`.
- Produces internal function: `private.redact_expired_order_addresses` scheduled daily at 01:15 UTC.

- [ ] **Step 1: Write failing pgTAP tests for review uniqueness/ownership, dispute visibility, admin-only resolution, immutable seller fault, completion pause, and retention dates.**
- [ ] **Step 2: Run focused pgTAP and confirm missing relations/functions.**
- [ ] **Step 3: Implement schema, RLS, admin authorization, audited RPCs, retention function, and cron schedule.**
- [ ] **Step 4: Run focused/full database suites and advisors.**
- [ ] **Step 5: Commit as `feat: add reviews and dispute evidence`.**

### Task 2: Review and dispute interfaces

**Files:**
- Create: `lib/validation/trust-evidence.ts`
- Create: `lib/validation/trust-evidence.test.ts`
- Create: `lib/actions/trust-evidence.ts`
- Create: `lib/queries/admin.server.ts`
- Create: `components/orders/review-form.tsx`
- Create: `components/orders/dispute-form.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/disputas/page.tsx`
- Modify: `app/compras/[id]/page.tsx`
- Modify: `app/panel/pedidos/[id]/page.tsx`
- Modify: `lib/queries/orders.server.ts`
- Modify: `lib/database.types.ts`

**Interfaces:**
- `createReview(orderId, previousState, formData): Promise<ActionState>`
- `openDispute(orderId, previousState, formData): Promise<ActionState>`
- `resolveDispute(disputeId, previousState, formData): Promise<ActionState>`

- [ ] **Step 1: Write failing validation tests for rating 1–5, required description match, bounded statements, allowed resolutions, and required seller-fault decision.**
- [ ] **Step 2: Run focused tests and confirm expected failures.**
- [ ] **Step 3: Implement schemas and actions; rerun focused tests.**
- [ ] **Step 4: Add Spanish buyer review/dispute forms, seller evidence response, and admin dispute queue/resolution page.**
- [ ] **Step 5: Run frontend tests, typecheck, lint, and build.**
- [ ] **Step 6: Commit as `feat: add trust evidence workflows`.**
