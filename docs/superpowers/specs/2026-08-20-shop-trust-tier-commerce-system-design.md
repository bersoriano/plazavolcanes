# Shop Trust Tier and Commerce System — Design Specification

## Objective

Add auditable platform-created orders and the performance evidence required to assign each shop one trust tier: Standard, Reliable, or Top Rated. Enforce each tier's free active-listing limit without inventing historical data or allowing sellers to edit their own metrics.

The marketplace remains Spanish-facing. Stable internal keys and the trust-engine `trust_tier` values remain English where required by the evaluator contract.

## Current State

Plaza Volcanes is currently a catalog-only marketplace. Authenticated users can create shops and publish products, but the platform has no carts, checkout, orders, fulfillment, messaging, reviews, disputes, administrative roles, or trust-performance metrics.

The existing account model remains: one Supabase Auth account may own multiple shops. This design extends the same account so it may also buy products. A user may not order from a shop they own.

## Scope and Non-Goals

This project includes:

- Shop-scoped carts and order-request checkout
- Offline payment arrangement between buyer and seller
- Order lifecycle and immutable order-item snapshots
- Configurable product handling time and objective shipping deadlines
- Buyer/seller conversations and response clocks
- Delivery confirmation and seven-day automatic completion
- Reviews, description-accuracy feedback, disputes, and admin resolution
- Meaningful seller-activity records
- Deterministic trust-tier evaluation and evaluation history
- Free active-listing enforcement
- Buyer, seller, admin, and public trust UI

This project does not include:

- Online payment processing, escrow, refunds, or marketplace fees
- Inventory reservation or stock management
- Carrier integrations or automatic tracking webhooks
- AI or LLM calls
- Imported or seller-reported external orders
- Historical performance reconstruction from data that does not exist
- Automatic unpublishing after a tier downgrade

## Approved Policy Decisions

- Only platform-created orders count toward trust metrics.
- Payment is arranged outside the platform.
- One account may buy and sell, but self-orders are prohibited.
- Carts and orders contain products from one shop only.
- Product handling time is configured before checkout. Initial valid range is 1–30 business days, defaulting to 3.
- Business-day calculations exclude Saturdays and Sundays. Holiday calendars remain future work.
- The order snapshots both `handling_days` and the calculated `ship_by_at` promise.
- Buyer receipt confirmation starts the delivered state.
- Buyer may complete immediately after receipt; otherwise a dispute-free delivered order auto-completes after seven days.
- Admin may confirm delivery from submitted evidence when the buyer becomes unresponsive.
- The first unanswered buyer message starts a response clock. Additional buyer messages do not start another clock until the seller replies.
- Performance rates and reply times use a rolling 90-day window. Total completed orders, ratings, and review counts are lifetime.
- Description accuracy comes from the completed-order review question asking whether the item matched its description.
- Only admin-resolved seller-fault disputes enter the dispute rate. Any open dispute blocks promotion.
- Seller activity includes meaningful commerce, communication, fulfillment, and listing actions. Logins and page views do not count.
- A tier downgrade keeps existing published products live. New publication is blocked until the published count falls below the current limit.
- Completed-order address data is redacted after the retention period described below.

## Architecture

Canonical domain tables and append-only events are source truth. A deterministic evaluator derives metrics and writes append-only trust evaluations. Each shop caches its current effective tier and listing limit for fast public reads and transactional publication enforcement.

Relevant events mark a shop dirty in a deduplicated evaluation queue. A scheduled worker claims dirty shops every five minutes. A daily sweep at 00:15 UTC enqueues every non-deleted shop so inactivity and rolling-window expiry change tiers without requiring a new user action.

Evaluation performs two stages:

1. Core evaluator calculates the metric-qualified tier from the exact metric input contract.
2. Policy wrapper applies promotion blocks, such as an open dispute, without changing core threshold logic.

Deterministic private PostgreSQL functions own evaluation. `private.evaluate_trust_tier(...)` is the pure core evaluator and returns the exact JSONB contract. `private.evaluate_shop_trust(shop_id)` aggregates canonical records, calls the core evaluator, applies policy, and writes history plus cache atomically. Scheduled database jobs process the queue. Neither function is executable from public API roles.

Every successful evaluation transaction appends a history row and updates the cached shop tier and limit. A failed evaluation preserves the last valid snapshot, records the failure, and remains queued for retry. A shop without any valid snapshot uses Standard and 15.

## Data Model

### Existing-table additions

#### `shops`

- `trust_tier`: constrained key `standard`, `reliable`, or `top_rated`; default `standard`
- `listing_limit`: positive integer; default `15`
- `trust_evaluated_at`: nullable timezone-aware timestamp
- `time_zone`: validated IANA time-zone name; existing shops default to `America/Mexico_City`

These columns are system-managed. Sellers cannot update them directly.

#### `products`

- `handling_days`: integer from 1 through 30; default `3`

Checkout snapshots this value. Later product changes never alter existing order promises.

### Cart and order records

#### `carts`

- Buyer UUID
- Shop foreign key
- Created and updated timestamps
- One active cart per buyer and shop

#### `cart_items`

- Cart and product foreign keys
- Positive integer quantity
- Unique product per cart

Application and database rules reject products from a different shop than the cart.

#### `orders`

- Identity primary key
- Buyer UUID and shop foreign key
- Constrained status
- Idempotency key unique per buyer
- Currency and exact subtotal snapshot
- Buyer note
- `handling_days`
- `handling_time_zone`
- `accepted_at`
- `ship_by_at`
- `shipped_at`
- `delivered_at`
- `buyer_confirmed_at`
- `auto_completed_at`
- `completed_at`
- Cancellation timestamp and responsible party
- Created and updated timestamps

Order statuses:

- `requested`
- `accepted`
- `shipped`
- `delivered`
- `completed`
- `rejected`
- `canceled_by_buyer`
- `canceled_by_seller`
- `canceled_by_admin`

`completed_at` is the effective completion timestamp used by metrics. Exactly one of `buyer_confirmed_at` or `auto_completed_at` supplies its normal completion path. Admin repair requires an audited order event.

#### `order_items`

- Order and original product foreign keys
- Immutable product name, unit price, currency, quantity, and line-total snapshots

Product deletion does not delete order-item history. Original product references are nullable on product deletion.

#### `order_addresses`

- One shipping-address snapshot per order
- Recipient, address lines, locality, administrative area, postal code, country, and delivery instructions
- Redaction timestamp

Only buyer, owning seller, and authorized admins may read unredacted address data. A retention job redacts address fields 90 days after completion or cancellation when no dispute is open. If a dispute exists, retention runs 90 days after final resolution.

#### `order_events`

- Order foreign key
- Actor UUID and actor type
- Constrained event type
- Previous and next status
- Safe structured metadata
- Created timestamp
- Optional idempotency key

Events are append-only and provide state-transition audit history.

### Conversations and response evidence

#### `conversations`

- Shop foreign key
- Buyer UUID
- Optional order foreign key
- Type `pre_sale` or `order`
- Created and updated timestamps

Participants are the buyer and current shop owner. One order conversation exists per order. Shop owners cannot open buyer-side conversations with their own shops. Only messages from non-owner buyers may start response clocks.

#### `messages`

- Conversation foreign key
- Sender UUID
- Text body
- Created timestamp

Messages are append-only. Editing and deleting messages are excluded from this phase.

#### `seller_response_events`

- Conversation and shop foreign keys
- Triggering buyer-message foreign key
- Closing seller-message foreign key
- `clock_started_at`
- `replied_at`
- `elapsed_minutes`
- `answered_within_24_hours`

The first buyer message received while no response clock is open creates one event. Later buyer messages remain under that open clock. The next seller reply closes it. An open clock older than 24 hours counts as a response-rate failure even before it is eventually answered. Average reply time includes answered clocks only; no answered clocks produces null.

### Reviews and disputes

#### `order_reviews`

- One row per completed order
- Buyer and shop foreign keys
- Integer rating from 1 through 5
- Required boolean `matched_description`
- Optional bounded comment
- Created timestamp

Only the order buyer may create the review. Review creation is permitted once, after completion. Reviews are not seller-editable.

#### `order_disputes`

- Order and shop foreign keys
- Buyer UUID
- Constrained reason and status
- Buyer statement and evidence references
- Seller response and evidence references
- Admin resolver UUID
- Resolution `buyer_favor`, `seller_favor`, or `dismissed`
- `seller_fault` boolean set only during admin resolution
- Opened and resolved timestamps

Parties may read their disputes and submit evidence. Only an authorized admin may resolve a dispute or set `seller_fault`.

### Activity and trust records

#### `seller_activity_events`

- Shop foreign key
- Actor UUID
- Constrained meaningful activity type
- Optional related entity type and ID
- Created timestamp

Allowed activity includes product publication or material listing management, order acceptance/rejection, shipment, seller message, evidence submission, and other explicit commerce actions. Login and page-view events are never inserted.

#### `shop_trust_evaluation_queue`

- Shop primary key
- Dirty timestamp
- Next attempt timestamp
- Attempt count
- Last error
- Locked timestamp

Upsert by shop makes event-triggered requests idempotent and deduplicated. Worker claiming uses locking that prevents concurrent evaluation of one shop.

#### `shop_trust_evaluations`

- Identity primary key and shop foreign key
- Every evaluator input metric, nullable where data is missing
- Open-dispute count used by the policy wrapper
- Metric-qualified tier
- Effective tier
- Free listing limit
- Reasons array
- Next-tier requirements array
- Summary
- Evaluation timestamp
- Evaluator policy version

Rows are append-only and not seller-writable.

#### `private.admin_users`

- Auth user UUID primary key
- Granting admin UUID
- Created timestamp

Admin authorization checks this live private record. User-editable metadata never grants administrative access.
Initial admin membership is provisioned by an operator-controlled deployment migration. Later grants and revocations require an existing admin and produce an audit record.

## Order Lifecycle

Normal path:

`requested → accepted → shipped → delivered → completed`

Alternative terminal paths:

- `requested → rejected`
- `requested → canceled_by_buyer`
- `accepted|shipped|delivered → canceled_by_seller|canceled_by_admin`

State-transition rules:

- Checkout creates `requested` order, immutable items, address, initial event, and order conversation in one transaction.
- Checkout snapshots product `handling_days` and shop `time_zone` into the order. Seller acceptance calculates `ship_by_at` from those snapshots, excluding weekends. Later product or shop changes never alter the promise.
- Seller marks shipment and may attach delivery evidence or tracking text.
- Buyer confirms receipt, setting `delivered_at` and status `delivered`.
- Buyer may confirm satisfaction immediately, setting `buyer_confirmed_at`, `completed_at`, and status `completed`.
- Scheduled completion sets `auto_completed_at`, `completed_at`, and status `completed` seven 24-hour periods after `delivered_at` when no dispute is open.
- Open disputes pause automatic completion.
- Admin may set delivery from evidence, always producing an audited event.
- Invalid status jumps, mismatched actors, or repeated idempotency keys are rejected by database invariants.

## Metric Definitions

Current evaluation date and rolling-window boundaries use UTC timestamps. Display formatting may use the marketplace locale.

### Lifetime metrics

- `total_orders`: count of completed orders.
- `review_count`: count of valid order reviews.
- `average_rating`: arithmetic mean of valid rating values; null when no reviews exist.

### Rolling 90-day metrics

- `response_rate`: response clocks answered within 24 hours divided by all response clocks started in the window, multiplied by 100. Open clocks older than 24 hours count as failures.
- `average_reply_time_minutes`: arithmetic mean of non-null `elapsed_minutes` for clocks answered in the window; null when none were answered.
- `description_accuracy`: reviews with `matched_description = true` divided by reviews that answered the required description question in the window, multiplied by 100; null when none exist.
- `on_time_shipping_rate`: shipping-eligible orders shipped on or before `ship_by_at` divided by shipping-eligible orders whose deadline has passed or that have shipped, multiplied by 100; null when denominator is zero. Accepted orders canceled before shipment do not enter this metric and are handled by completion rate.
- `order_completion_rate`: accepted terminal orders completed divided by all accepted terminal orders in the window, multiplied by 100. Seller- or admin-attributed seller-fault cancellations reduce the rate. Rejected requests and buyer cancellations before acceptance are excluded.
- `dispute_rate`: orders with an admin-resolved seller-fault dispute divided by completed orders plus seller-fault terminal orders in the window, multiplied by 100; null when denominator is zero.
- `last_active_days_ago`: whole calendar days since the latest meaningful seller-activity event; null when none exists.

Rates retain enough numeric precision for strict threshold comparisons and are rounded only for display.

## Trust Evaluator Contract

Core input:

```json
{
  "average_reply_time_minutes": "number | null",
  "response_rate": "number | null",
  "description_accuracy": "number | null",
  "on_time_shipping_rate": "number | null",
  "order_completion_rate": "number | null",
  "dispute_rate": "number | null",
  "total_orders": "number | null",
  "average_rating": "number | null",
  "review_count": "number | null",
  "last_active_days_ago": "number | null"
}
```

Core output contains exactly:

```json
{
  "trust_tier": "Standard",
  "free_listing_limit": 15,
  "reasons": ["No hay datos suficientes para cumplir todos los requisitos de Reliable."],
  "next_tier_requirements": ["Alcanza al menos 25 pedidos completados."],
  "summary": "La tienda permanece en el nivel Standard mientras reúne evidencia verificable de rendimiento."
}
```

`trust_tier` is exactly `Standard`, `Reliable`, or `Top Rated`; its corresponding listing limit is exactly 15, 40, or 100. Summary contains at most 35 words. Reasons reference actual metrics and include meaningful positive and negative evidence. Missing values are never invented.

Evaluation order is Top Rated, Reliable, then Standard. A shop must satisfy every applicable gate.

### Standard

- Default when any higher-tier requirement fails
- Free active listings: 15

### Reliable

- `total_orders >= 25`
- `description_accuracy >= 95`
- `dispute_rate <= 2.5`
- `response_rate >= 90`
- `on_time_shipping_rate >= 92`
- `average_reply_time_minutes <= 360`
- `order_completion_rate >= 95`
- `average_rating >= 4.6` when `review_count >= 10`
- `last_active_days_ago <= 21`
- Free active listings: 40

### Top Rated

- `total_orders >= 80`
- `description_accuracy >= 97`
- `dispute_rate <= 1.3`
- `response_rate >= 96`
- `on_time_shipping_rate >= 96`
- `average_reply_time_minutes <= 120`
- `order_completion_rate >= 98`
- `average_rating >= 4.8` when `review_count >= 25`
- `last_active_days_ago <= 14`
- Free active listings: 100

Null fails every directly applicable requirement. A null `review_count` fails higher-tier qualification; system aggregation emits zero when no reviews exist. `average_rating` may be null only while `review_count` is below the applicable rating gate. Rating is waived below that boundary, exactly matching the approved contract.

### Open-dispute promotion block

The policy wrapper receives current effective tier and open-dispute count. When open-dispute count is positive, it prevents upward movement and preserves the current tier. It does not silently demote an existing tier. The evaluation records the metric-qualified tier, effective tier, and a clear dispute-block reason. Once all disputes close, the next evaluation applies normal qualification.

## Listing-Limit Enforcement

An active listing is a product with `status = 'published'`.

Application behavior:

- Seller dashboard shows published count, current limit, and remaining capacity.
- Publish actions perform a precheck and return specific Spanish guidance when capacity is exhausted.
- Editing an already-published product remains allowed while over limit.
- Unpublishing remains allowed and moves the shop toward compliance.

Database behavior:

- Insert as published and draft-to-published updates enter a transactional guard.
- Guard locks the parent shop row, reads cached `listing_limit`, and counts current published products.
- Publication is rejected when count is already at or above limit.
- Concurrent publication attempts serialize on the shop row, preventing limit overflow.
- Published-to-published updates bypass capacity rejection.
- Tier downgrade updates limit but never changes product status.

## Authorization and Data Security

RLS is enabled on every exposed table. Grants follow least privilege.

- Anonymous visitors read only public shop tier fields and published products.
- Buyers read and mutate only their carts and permitted transitions on their own orders.
- Shop owners read orders, addresses, messages, and evidence belonging to their shops.
- Conversation participants alone may read or create messages.
- Shipping addresses never appear in public DTOs or wildcard public selects.
- Sellers cannot write metrics, evaluations, trust caches, review ownership, or dispute outcomes.
- Private admin checks use live private records.
- Privileged functions live outside exposed schemas, set an empty search path, expose only required execution paths, and validate the caller.
- State transitions enforce both actor authorization and previous-state predicates.
- Structured event metadata accepts only documented safe fields; secrets and full address content never enter event payloads.
- Browser clients receive no service-role or secret key.

## Product Surfaces

### Buyer

- Product page: `Solicitar compra`
- Shop-scoped cart and checkout
- `/compras`: buyer order history
- `/compras/[id]`: status timeline, conversation, receipt confirmation, satisfaction confirmation, dispute, and review

### Seller

- `/panel/pedidos`: incoming and active orders across owned shops
- `/panel/pedidos/[id]`: accept/reject, shipment, conversation, delivery evidence, and dispute evidence
- Shop dashboard trust card: effective tier, listing usage, current metrics, reasons, and next-tier gaps
- Product publish controls: remaining free listings and capacity errors

### Admin

- `/admin/disputas`: open queue, party evidence, resolution, and seller-fault decision
- Admin delivery confirmation from evidence is available from order context

### Public shop

- Spanish tier badge and short trust summary
- Existing member-since and verification markers remain
- Raw reply, dispute, completion, and shipping metrics remain private to seller/admin views

## Jobs, Failure Handling, and Observability

Scheduled responsibilities:

- Claim dirty trust evaluations every five minutes
- Enqueue every non-deleted shop daily at 00:15 UTC for rolling-window and inactivity refresh
- Auto-complete eligible delivered orders hourly
- Redact expired shipping addresses daily at 01:15 UTC

Every job is idempotent. Claims use row locking, transition predicates, and stable idempotency keys. Partial failure leaves retryable queue state. Job-visible fields include attempt count, next attempt, lock time, last error, and last success.

Trust evaluation failures preserve the last valid tier. No valid prior evaluation means Standard/15. Order-transition failures do not partially append events or update status. Checkout either creates complete order records or creates nothing.

Operational monitoring covers:

- Oldest dirty trust evaluation
- Evaluation retry and error counts
- Last successful daily sweep
- Overdue automatic completions
- Address-redaction backlog
- Orders stuck in non-terminal states

## Rollout Plan

### Slice 1: Commerce foundation

- Carts, checkout, orders, item/address snapshots, lifecycle events
- Buyer and seller order pages
- Standard tier backfill and 15-listing enforcement

### Slice 2: Fulfillment and communication

- Product handling time and calculated shipping promises
- Conversations, messages, and response clocks
- Shipment, receipt, completion, automatic-completion job
- Meaningful seller activity

### Slice 3: Trust evidence

- Reviews and description-match feedback
- Disputes, evidence, private admin role, and admin resolution UI
- Address-redaction job

### Slice 4: Tier activation

- Metric aggregation, dirty queue, evaluation history, and policy versioning
- Reliable and Top Rated activation
- Seller trust dashboard and public tier badge

Each slice ships with schema expansion before application readers/writers. New writes remain compatible with previous app code during deployment. Destructive contraction is excluded.

## Migration and Rollback

Forward migration:

- Add new tables, constraints, indexes, grants, and RLS policies.
- Add nullable or defaulted columns to existing tables.
- Backfill every existing shop to `standard`, limit 15, without fabricating metrics.
- Existing published products remain published even when count exceeds 15.
- Enable publication guard after shop defaults exist.

Rollback:

- Disable new routes, workers, tier UI, and publication guard.
- Restore application behavior to catalog-only publishing.
- Preserve order, review, dispute, and evaluation records for audit and later recovery.
- Do not drop or rewrite canonical commerce data during operational rollback.

## Verification Strategy

### Unit tests

- Every exact tier boundary and one value on each side
- Null for every metric
- Rating gates below, at, and above review-count thresholds
- Exact output keys, limits, tier values, reasons, next-tier gaps, and 35-word summary cap
- Calendar handling across weekends and date boundaries
- Response-clock grouping and elapsed-minute calculation

### Database tests

- Buyer, seller, outsider, admin, and anonymous RLS paths
- Self-order rejection and shop-scoped cart integrity
- Order state machine and actor permissions
- Idempotent checkout and transitions
- Immutable item snapshots and review uniqueness
- Admin-only dispute resolution and seller-fault writes
- Open-dispute completion pause and promotion block
- Meaningful activity allowlist
- Address visibility and redaction
- Listing-limit concurrency and downgrade grandfathering

### Job and integration tests

- Seven-day automatic completion with controlled time
- Trust queue retries, deduplication, and daily refresh
- Rolling-window expiry and inactivity tier changes
- Failed evaluation preserves last valid tier
- Backfill creates Standard/15 without changing published products

### End-to-end tests

- Buyer cart through completed order and review
- Seller acceptance, message response, shipment, and trust dashboard
- Dispute creation through admin resolution
- Listing publication at, below, and above each effective limit
- Public shop tier display without private metric or address leakage

## Acceptance Criteria

- Every trust metric comes from auditable platform records.
- Core evaluator follows the supplied thresholds and exact JSON structure.
- Missing applicable data prevents higher-tier qualification.
- Open disputes block promotion without unaudited demotion.
- Existing shops start Standard/15; no historical numbers are invented.
- Sellers cannot manipulate trust inputs, tiers, or limits directly.
- Concurrent publications cannot exceed the cached limit.
- Existing products remain published after downgrade.
- Orders, addresses, conversations, reviews, and disputes obey participant/admin boundaries.
- Buyer, seller, admin, and public workflows use Spanish UI copy.
- No online payment or LLM dependency is introduced.
