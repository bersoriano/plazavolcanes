# Purchase Request Expiry — Design Specification

## Objective

A purchase request no longer waits forever. The seller has 72 hours to accept or reject it; after that it expires on its own, its reserved units return to the listing, and the buyer is told the shop did not answer in time. While it waits, the deadline is visible to both sides and the seller's queue ranks requests by it.

This is part 2a of fix 2 from the seller audit. Email notifications (2b) are a separate specification.

## Scope

This project includes:

- A `decide_by_at` deadline on every order, filled at checkout and meaningful while the order is `requested`
- A new terminal order status `expired` and a matching order event
- A pg_cron sweep that expires overdue requests every five minutes
- Releasing reserved stock when a request expires, through the existing release trigger
- Refusing to accept a request whose deadline has passed
- Deadline, urgency and expiry wording on the seller dashboard, the seller orders list and order page, and the buyer's purchases

This project excludes:

- Notifying anybody by email or push (2b)
- Counting expired requests in the seller trust tier, the buyer trust profile or public shop metrics
- Expiring accepted orders that were never paid or shipped
- Business-day windows or per-shop windows

## Approved Product Policies

- The window is 72 calendar hours from the request.
- A request shows "Vence pronto" during its last 24 hours.
- An expired request is its own status, `expired`, labelled "Vencido". It is history, like a rejection.
- Expiry does not count against the seller's trust tier for now. The tier and buyer trust queries already select statuses by inclusion, so `expired` stays out of them without changes.
- Requests already open when this ships get a fresh 72-hour window from deployment rather than expiring at once.
- After the deadline the seller can still reject a request, but cannot accept it.

## Database

One migration.

1. Replace `orders_status_check` and `order_events_event_type_check` with versions that add `expired`.
2. Add `orders.decide_by_at timestamptz`. Backfill open requests with `now() + interval '72 hours'`, leave every other row null, then set the column default to `now() + interval '72 hours'` so checkout fills it without being redefined. Add a partial index on `decide_by_at` where `status = 'requested'`.
3. `private.expire_due_requests()` selects requested orders whose `decide_by_at <= now()` with `for update skip locked`, sets `status = 'expired'` and `updated_at`, and records an `order_events` row with `actor_type = 'system'`, `event_type = 'expired'`, `previous_status = 'requested'`, `next_status = 'expired'`. It returns how many it expired. Execution is revoked from `public`, `anon` and `authenticated`.
4. Schedule it with pg_cron as `plaza-expire-requests`, every five minutes.
5. Recreate the `release_order_stock` trigger so its status list includes `expired`; the trigger function is unchanged.
6. Redefine `public.accept_order` from its only definition (`20260820173552_add_fulfillment_communication.sql`) to raise `P0001` `Esta solicitud ya venció.` when `decide_by_at` has passed. `reject_order` is unchanged.

## Application

- `lib/database.types.ts`: `OrderStatus` gains `expired`; `orders` rows gain `decide_by_at`.
- `lib/order-status.ts`: `expired` reads "Vencido".
- `lib/order-events.ts`: `expired` joins the event list, reading "Venció sin respuesta de la tienda".
- `lib/seller-action-queue.ts`:
  - `REQUEST_WINDOW_HOURS = 72`, mirroring the column default.
  - `SellerOrderFacts` carries `decide_by_at`; the `decide` step's `dueAt` is that deadline.
  - Seller guidance for a request: "Si no respondes antes del {fecha}, la solicitud vence y las unidades vuelven a tu catálogo." with a deadline labelled `Responde antes del {fecha}`, or `El plazo para responder venció: {fecha}` once overdue.
  - Buyer guidance for a request: "La tienda puede aceptarla o rechazarla. Si no responde a tiempo, la solicitud vence sola y puedes volver a pedirlo." with a deadline labelled `La tienda tiene hasta el {fecha} para responder`.
  - Closed wording: seller "La solicitud venció sin respuesta. Las unidades volvieron a tu catálogo."; buyer title "La tienda no respondió a tiempo".
- `lib/seller-dashboard.ts` and its server query: a purchase request in "Requiere tu atención" carries its deadline and urgency, so overdue and due-soon requests sort first and show `Responde en …` with the urgency label; the primary "Revisa la solicitud" card mentions a request that is about to expire.
- `lib/queries/orders.server.ts`: the seller queue, buyer list and order detail select `decide_by_at`.

## Testing

- pgTAP `supabase/tests/database/request_expiry.test.sql`: a new request gets a deadline about 72 hours out; the sweep expires an overdue request and leaves a fresh one and an accepted one alone; the expired request returns its reserved units and records a system event; `accept_order` refuses an overdue request; `reject_order` still works on one; the status and event checks accept `expired`.
- Vitest: the decide step's deadline and urgency; seller and buyer guidance for a waiting and an expired request; the status and event labels; the dashboard's request item timing and ordering.
