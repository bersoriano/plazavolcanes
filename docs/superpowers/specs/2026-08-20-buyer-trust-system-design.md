# Buyer Trust System — Design Specification

## Objective

Create auditable buyer trust markers and one deterministic Buyer Trust Tier from platform-created commerce evidence. Sellers receive a concise Spanish buyer standing on shared order screens without exposing buyer trust publicly or allowing buyers or sellers to edit derived metrics.

## Scope

This project includes:

- Seller-confirmed offline-payment evidence
- Payment-required v2 checkout with legacy compatibility
- Structured buyer and seller cancellation evidence
- Buyer response clocks for order conversations
- Meaningful buyer activity records
- Deterministic buyer-tier evaluation and exact marker output
- Append-only evaluation history, cached tier, dirty queue, retries, and scheduled refresh
- Seller-only buyer trust UI on shared order and conversation surfaces

This project excludes:

- Public buyer profiles
- Online payment processing, escrow, or payment-provider webhooks
- Seller messages from pre-sale conversations in buyer response metrics
- Post-delivery average completion time or fast completion rate
- Invented payment evidence for existing orders
- Immediate removal of the legacy checkout path

## Approved Product Policies

- Payment remains external to the marketplace.
- Seller confirms payment receipt; buyer cannot self-award payment evidence.
- New v2 orders require payment confirmation before shipment.
- Seller may cancel an accepted unpaid order with a structured reason. Only `buyer_non_payment` damages buyer payment reliability.
- Buyer may cancel before payment. Pre-acceptance cancellations do not enter cancellation or completion-rate metrics.
- Buyer response metrics include order conversations only. Repeated seller messages do not create multiple open clocks.
- Buyer trust UI is visible to sellers only within a shared order or its embedded conversation. No public buyer profile is created.
- Lifetime totals remain lifetime. Rates use a rolling 90-day window. Current time and boundaries use UTC.
- Missing denominators produce null. Null never meets a positive tier threshold.

## Compatibility and Rollout

Existing checkout remains available as `checkout_cart` and creates payment-optional legacy orders. New application code calls `checkout_cart_v2`, which creates `payment_confirmation_required = true` orders. Shipment enforcement checks that flag: v2 orders require `payment_completed_at`; legacy orders remain shippable without invented evidence.

Legacy checkout may be disabled only after all of these conditions hold:

1. Production application version using `checkout_cart_v2` is deployed everywhere.
2. Telemetry records zero legacy checkout calls for 30 consecutive days.
3. No active payment-optional order is younger than 30 days.
4. Operator explicitly approves contraction after reviewing those measurements.

Removal of legacy checkout is a separate destructive migration and is not part of this project.

## Canonical Evidence

### `orders` additions

- `payment_confirmation_required boolean not null default false`
- `payment_completed_at timestamptz null`
- `payment_confirmed_by uuid null`, referencing the seller account that confirmed receipt
- `seller_cancellation_reason text null`, constrained to `buyer_non_payment`, `inventory_unavailable`, `seller_unavailable`, or `other`

Payment confirmation is idempotent, requires an accepted order owned by the current seller, and appends an order event. A payment-required order cannot move to shipped until confirmation exists. Seller non-payment cancellation requires an accepted, unpaid order. Ordinary seller cancellations never damage buyer metrics.

Buyer cancellation records whether acceptance already occurred. Cancellation before acceptance remains operational history but is excluded from trust metrics. Cancellation after acceptance and before payment enters buyer cancellation and completion denominators.

### `buyer_response_events`

Each row stores:

- Order conversation, order, and buyer identifiers
- Triggering seller message and optional closing buyer message
- `clock_started_at`, `replied_at`, and `elapsed_minutes`
- `answered_within_24_hours`

The first seller message while no buyer clock is open starts one clock. Further seller messages stay under that clock. The next buyer reply closes it. Pre-sale conversations never create buyer clocks.

### `buyer_activity_events`

Meaningful activity includes checkout, payment completion, buyer order message, receipt confirmation, order completion, review submission, claim submission, and accepted-order cancellation. Logins, page views, and passive reads are excluded.

### Trust records

- `buyer_trust_profiles`: one cached tier and evaluation timestamp per Auth user
- `buyer_trust_evaluations`: append-only evaluator inputs, exact output JSON, policy version, and evaluation timestamp
- `private.buyer_trust_evaluation_queue`: deduplicated dirty users with attempt count, next attempt, last error, lock time, and last success

Relevant order, payment, cancellation, message, response-clock, claim, review, verification, and activity changes enqueue the buyer. Worker claims ready rows with `FOR UPDATE SKIP LOCKED`. Failures preserve the last valid cache/history and retry with exponential backoff capped at 60 minutes. Daily sweep re-enqueues every profile, including stale profiles, so inactivity and rolling-window expiry change results without new events.

## Metric Definitions

### Lifetime

- `total_completed_purchases`: count of platform orders with status `completed` for the buyer.
- `member_since`: immutable joined date from `user_trust_profiles`.
- `verification_level`: current platform-controlled verification level from `user_trust_profiles`.

### Rolling 90 days

- `buyer_completion_rate`: completed orders divided by completed orders plus accepted buyer cancellations plus confirmed non-payment cancellations. Outcome timestamp must fall inside the window.
- `cancellation_rate`: accepted buyer cancellations divided by accepted buyer cancellations plus completed orders plus confirmed non-payment cancellations. Pre-acceptance cancellations are excluded from numerator and denominator.
- `payment_reliability`: seller-confirmed payments divided by seller-confirmed payments plus confirmed non-payment cancellations. Payment or cancellation evidence timestamp must fall inside the window.
- `average_time_to_close_hours`: average elapsed hours from `accepted_at` to `payment_completed_at` for payment-confirmed, non-canceled orders only. Canceled orders are excluded even if payment was previously confirmed.
- `fast_closer_rate`: percentage of the same payment-confirmed, non-canceled orders closed within 48 hours.
- `claim_rate`: distinct claimed orders among the cohort divided by all distinct orders whose first shipment occurred inside the window. Cohort includes orders that reached shipped, delivered, or completed, including orders whose later status changed.
- `seller_fault_claim_rate`: distinct admin-resolved seller-fault claimed orders among that same shipment cohort divided by the same denominator.
- `response_rate`: eligible buyer clocks answered within 24 hours divided by answered clocks plus open clocks at least 24 hours old.
- `average_reply_time_minutes`: average elapsed minutes for answered buyer clocks only.
- `review_rate`: completed purchases with a review divided by completed purchases whose completion timestamp falls inside the window.
- `last_active_days_ago`: whole days since latest meaningful buyer activity.

Any zero denominator returns null rather than zero.

## Tier Rules

Evaluator assigns exactly one tier:

### New

Default when higher-tier requirements are not all met, including low history or missing required metrics.

### Reliable

All required:

- Completed purchases at least 8
- Completion rate at least 93%
- Claim rate at most 4%
- Cancellation rate at most 6%
- Payment reliability at least 95%
- Average close time at most 72 hours
- Fast closer rate at least 60%
- Last activity within 30 days

### Top Buyer

All required:

- Completed purchases at least 25
- Completion rate at least 97%
- Claim rate at most 2%
- Cancellation rate at most 3%
- Payment reliability at least 98%
- Average close time at most 36 hours
- Fast closer rate at least 80%
- Response rate at least 90%
- Last activity within 14 days

Cached keys are `new`, `reliable`, and `top_buyer`. Exact evaluator output values remain `New`, `Reliable`, and `Top Buyer`. Spanish display labels are `Nuevo`, `Confiable`, and `Comprador destacado`.

## Exact Evaluator Contract

Private deterministic evaluator accepts the exact prompt input and returns exactly:

```json
{
  "member_since": {
    "primary_text": "string",
    "tooltip": "string"
  },
  "verification_level": {
    "primary_text": "string",
    "badge_label": "string",
    "tooltip": "string"
  },
  "buyer_trust_tier": "New | Reliable | Top Buyer",
  "markers": {
    "total_completed_purchases": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "buyer_completion_rate": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "claim_rate": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "cancellation_rate": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "payment_reliability": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "average_time_to_close": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "fast_closer_rate": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "response_rate": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "review_rate": { "primary_text": "string", "tooltip": "string", "signal": "string" },
    "recent_activity": { "primary_text": "string", "tooltip": "string", "signal": "string" }
  },
  "summary": "string",
  "reasons": [],
  "next_tier_requirements": []
}
```

Tooltips contain at most 22 words. Canonical signal values remain exactly `Excellent`, `Good`, `Average`, `Needs improvement`, `No data`, or `New`; Spanish UI maps them without changing stored output. `seller_fault_claim_rate` and `average_reply_time_minutes` may inform reasons but do not add markers.

## Marker Signal Thresholds

- Purchases: at least 25 Excellent; at least 8 Good; 5–7 Average; below 5 New.
- Completion: at least 97 Excellent; at least 93 Good; at least 85 Average; otherwise Needs improvement.
- Claims: at most 2 Excellent; at most 4 Good; at most 8 Average; otherwise Needs improvement.
- Cancellations: at most 3 Excellent; at most 6 Good; at most 10 Average; otherwise Needs improvement.
- Payment reliability: at least 98 Excellent; at least 95 Good; at least 85 Average; otherwise Needs improvement.
- Average close: at most 24 hours Excellent; 25–48 Good; 49–72 Average; above 72 Needs improvement.
- Fast closer: at least 80 Excellent; 60–79 Good; 40–59 Average; below 40 Needs improvement.
- Response: at least 90 Excellent; at least 75 Good; at least 50 Average; otherwise Needs improvement.
- Reviews: at least 75 Excellent; at least 50 Good; at least 25 Average; otherwise Needs improvement.
- Activity: within 14 days Excellent; within 30 Good; within 60 Average; otherwise Needs improvement.

Null always produces `No data`.

## Seller UI

Seller order detail displays:

- Short standing: tier plus strongest useful behavior, such as `Confiable · Cierra rápido`
- Member-since and verification markers
- Compact trust markers with Spanish signal labels and accessible tooltips
- Summary and reasons
- Expandable next-tier requirements
- Payment confirmation and structured cancellation actions when applicable

Standing suffix is derived deterministically from non-null markers in this priority: fast closing, payment reliability, completion, response. No suffix appears when no positive marker exists. Buyer trust never appears on public shop or product pages.

## Authorization and Privacy

All exposed tables enable RLS and receive explicit grants only where required. Buyer may read their own data through RLS but receives no buyer-dashboard UI in this scope. Seller may read current profile/history only when an order exists between that buyer and one of their shops. Unrelated sellers and anonymous users receive no rows. Admin authorization uses `private.admin_users`; user-editable metadata never grants access.

Privileged functions live in `private`, revoke execution from API roles, and use fixed empty search paths. Public transactional RPCs explicitly verify `auth.uid()`, role relationship, current order state, and idempotency before writing.

## Verification

- pgTAP covers exact output keys, tier boundaries on both sides, every null input, marker thresholds, tooltip word limits, payment confirmation, shipment blocking, legacy compatibility, cancellation denominators, response clocks, queue deduplication/backoff, stale daily enqueue, append-only history, and RLS isolation.
- Vitest covers Spanish tier/signal formatting, short buyer standing, seller-only rendering, action validation, and legacy/v2 client routing.
- Final gates: local database reset, full pgTAP, schema lint, Supabase security/performance advisors, full Vitest, TypeScript, ESLint, production build, linked migration push, remote migration verification, cron verification, and evaluation smoke query.
