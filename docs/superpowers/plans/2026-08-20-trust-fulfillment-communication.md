# Trust Fulfillment and Communication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add handling promises, controlled order transitions, conversations, response clocks, seller activity, and seven-day completion.

**Architecture:** Database transition RPCs validate actor and current state, append events atomically, and emit meaningful activity. Message trigger opens or closes one response clock per unanswered buyer sequence. pg_cron invokes idempotent completion hourly.

**Tech Stack:** Postgres 17, pg_cron, Supabase RLS/RPC, Next.js Server Actions, pgTAP, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-shop-trust-tier-commerce-system-design.md`

## Global Constraints

- Handling days stay configurable 1–30 and snapshot onto orders with IANA time zone.
- Weekends excluded from `ship_by_at`; business holidays excluded from this phase.
- Response clock starts only on non-owner buyer messages; login never counts as activity.
- Auto-completion occurs seven 24-hour periods after delivery when no dispute is open.

---

### Task 1: Fulfillment, messaging, and job schema

**Files:**
- Create: `supabase/tests/database/fulfillment_communication.test.sql`
- Modify: `supabase/migrations/20260820173552_add_fulfillment_communication.sql`

**Interfaces:**
- Produces: `conversations`, `messages`, `seller_response_events`, `seller_activity_events`.
- Produces RPCs: `accept_order`, `reject_order`, `mark_order_shipped`, `confirm_order_received`, `confirm_order_satisfied`, `send_conversation_message`.
- Produces internal functions: `private.add_business_days`, `private.auto_complete_orders`, `private.record_seller_activity`.

- [ ] **Step 1: Write failing pgTAP tests for weekend handling, valid/invalid state transitions, response-clock grouping, owner self-conversation rejection, activity allowlist, and seven-day completion.**
- [ ] **Step 2: Run focused pgTAP file and confirm expected missing-function failures.**
- [ ] **Step 3: Implement schema, indexes, RLS, RPCs, triggers, internal functions, and named hourly cron job. Revoke internal execution from API roles.**
- [ ] **Step 4: Run focused and full database tests to green.**
- [ ] **Step 5: Commit as `feat: add fulfillment and seller response evidence`.**

### Task 2: Fulfillment and message product flows

**Files:**
- Create: `lib/validation/order-events.ts`
- Create: `lib/validation/order-events.test.ts`
- Create: `lib/actions/messages.ts`
- Create: `components/orders/order-actions.tsx`
- Create: `components/orders/conversation.tsx`
- Modify: `lib/actions/orders.ts`
- Modify: `lib/queries/orders.server.ts`
- Modify: `app/compras/[id]/page.tsx`
- Modify: `app/panel/pedidos/[id]/page.tsx`
- Modify: `components/products/product-form.tsx`
- Modify: `lib/validation/product.ts`
- Modify: `lib/validation/product.test.ts`
- Modify: `lib/database.types.ts`

**Interfaces:**
- `transitionOrder(orderId, transition, previousState, formData): Promise<ActionState>`
- `sendMessage(conversationId, previousState, formData): Promise<ActionState>`
- `OrderDetail` gains timeline, conversation, response evidence, handling promise, tracking text.

- [ ] **Step 1: Write failing validation tests for handling days 1–30, message 1–2000 characters, and allowed transitions.**
- [ ] **Step 2: Run focused Vitest files and observe missing behavior.**
- [ ] **Step 3: Implement minimal schemas/actions and rerun focused tests.**
- [ ] **Step 4: Add Spanish fulfillment buttons, status timeline, promise display, and conversation to participant pages.**
- [ ] **Step 5: Run full frontend tests, typecheck, lint, and build.**
- [ ] **Step 6: Commit as `feat: add order fulfillment and messaging UI`.**
