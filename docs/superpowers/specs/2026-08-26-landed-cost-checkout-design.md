# Landed cost, delivery promise and policies before confirming a request

> **Status: superseded and shelved (2026-08-27). Never implemented.**
>
> `2026-08-27-checkout-three-column-fulfillment-design.md` replaces the parts of
> this design that were about to be built, and takes the name
> `checkout_cart_v3` with a different signature. Pickup is now a real address on
> the shop rather than a `shop_shipping_methods` row with `kind = 'pickup'`, and
> the cost and timing of delivery stay a matter for the buyer and seller to
> agree in the message thread.
>
> Nothing below is deleted. The quote row, the versioned policies and the
> enforced total arithmetic remain a sound plan for the day the marketplace
> starts pricing delivery; that work builds on the superseding design and takes
> the next version number.

Buyers confirm a purchase request today knowing only the product subtotal. They
find out what delivery costs, when it might arrive, and whether it can be
returned only by asking the seller afterwards. This design puts all of it in
front of them before the button, and makes the numbers they saw the numbers the
order keeps.

Plaza Volcanes stays a **request** marketplace. No payment collection, no
payouts, no refunds — those belong to separate managed-marketplace work.

## Decisions taken before design

| Question | Decision |
|---|---|
| Architecture | Persisted quote row, sized down: items and policies snapshotted as `jsonb` inside the quote and order instead of child tables |
| Tax | **None for this version.** Most listings are used goods. `tax_mode = 'none'`, `tax_amount = 0`, and checkout shows **no tax line at all** — not even "Impuestos incluidos", which would be a claim nobody has signed off. Schema keeps room for a rate later. |
| Inventory | Unchanged. Nothing decrements `units_available` today and this change does not start. |

## What already exists

Worth knowing before reading the schema, because the design leans on all of it:

- Money is already `numeric(14,2)` with `>= 0` checks. No floating point anywhere.
- `private.add_business_days(started_at, days, time_zone)` (migration
  `20260820173552`) already computes `orders.ship_by_at`. Dispatch and delivery
  estimates reuse it rather than inventing a second calendar.
- `public.checkout_cart_v2` delegates to `private.checkout_cart_internal`:
  `security definer`, `set search_path = ''`, revoked from `public, anon`,
  granted to `authenticated`. Every new function copies that shape.
- Idempotency is `orders.idempotency_key`, checked before any write.
- `shops.administrative_area_codes` and `shops.time_zone` already exist, as does
  `products.handling_days` (1–30). Every input a delivery estimate needs is
  present.

## Schema

Three new tables and a set of additive columns. All are additive; nothing is
dropped or rewritten.

### `public.shop_shipping_methods`

One row per method a seller offers.

```
id, shop_id -> shops (cascade)
kind                    text  in ('pickup','flat','free','free_over')
name                    text  2..60
is_enabled              boolean default true
covers_nationally       boolean default false
administrative_area_codes text[] default '{}'      -- 'MX-JAL', …
price                   numeric(14,2) >= 0 default 0
free_over_subtotal      numeric(14,2) > 0, null unless kind = 'free_over'
min_transit_days        smallint 0..60
max_transit_days        smallint 0..60
currency_code           text default 'MXN'
provider                text default 'seller_static'
```

Constraints: `max_transit_days >= min_transit_days`; `free_over` requires a
threshold; `pickup` and `free` force `price = 0`; a method must either cover
nationally or name at least one state.

`provider` is the **carrier seam**. Today every row is `seller_static`. A carrier
integration later adds rows with a different provider and changes one function
body (below), not the schema.

Indexes: `(shop_id) where is_enabled`, GIN on `administrative_area_codes`.

RLS: owner does everything (`using` and `with check` both on
`(select auth.uid()) = shops.owner_id`); `anon` and `authenticated` may `select`
enabled rows only, because the product page advertises a starting price.

### `public.shop_commerce_policies`

Versioned and **immutable**. Editing a policy inserts a new version; a trigger
refuses `update` and `delete`.

```
id, shop_id -> shops (cascade)
version                   integer, unique per shop
effective_at              timestamptz default now()
returns_accepted          boolean
return_window_days        smallint 0..365
return_conditions         text <= 1000
return_shipping_paid_by   text in ('buyer','seller','not_applicable')
restocking_fee_bp         smallint 0..5000
warranty_offered          boolean
warranty_days             smallint 0..3650
warranty_terms            text <= 1000
```

`returns_accepted` requires a window above zero; `warranty_offered` requires a
duration. A seller cannot advertise a return policy of zero days.

`public.platform_commerce_policy` holds the platform's own baseline as a second
versioned row (its floor terms and the dispute window that backs the
buyer-protection wording). Both versions are snapshotted into every order, so
"what the platform promised then" survives a later change to what it promises
now. This version does **not** enforce seller terms against the platform floor;
that is a follow-up, noted under limitations.

RLS: owner manages own rows; everyone may read (these are public terms).

### `public.checkout_quotes`

The authoritative quote. Clients never write to it — only the security-definer
RPC does.

```
id uuid pk
buyer_id, shop_id, cart_id
currency_code             text default 'MXN'
items                     jsonb   -- product_id, name, unit_price, quantity,
                                  --  line_total, handling_days, units_available
cart_fingerprint          text    -- sha256 over sorted item tuples incl. price,
                                  --  status and units_available
subtotal                  numeric(14,2) >= 0
shipping_method_id -> shop_shipping_methods (set null)
shipping_method_name, shipping_kind
shipping_amount           numeric(14,2) >= 0
tax_mode                  text default 'none'
tax_amount                numeric(14,2) >= 0 default 0
total                     numeric(14,2) >= 0
dispatch_estimate_at      timestamptz
delivery_min_at, delivery_max_at timestamptz
policy_snapshot           jsonb   -- seller row + platform row, verbatim
seller_policy_version, platform_policy_version integer
destination_area_code     text
destination               jsonb   -- the validated address
expires_at                timestamptz default now() + 30 minutes
consumed_at, consumed_order_id
```

Constraint: `total = subtotal + shipping_amount + tax_amount`. The arithmetic the
buyer is shown is enforced by the database, not by the code that writes it.

Indexes: `(buyer_id, shop_id, created_at desc)`, `(cart_id)`, and a partial index
on `expires_at where consumed_at is null`.

RLS: `select` where `(select auth.uid()) = buyer_id`. No insert, update or delete
policy exists for any client role — the only writer is the RPC. Anonymous users
reach nothing.

### `public.orders` — additive columns

```
shipping_amount, tax_amount, total   numeric(14,2) >= 0 default 0
tax_mode                             text default 'none'
shipping_method_name, shipping_kind  text
dispatch_estimate_at                 timestamptz
delivery_min_at, delivery_max_at     timestamptz
policy_snapshot                      jsonb
seller_policy_version, platform_policy_version integer
quote_id -> checkout_quotes
is_legacy_totals                     boolean default false
```

`is_legacy_totals` marks orders created before quoting existed, so a screen can
say "este pedido es anterior al desglose de envío" instead of implying shipping
was free.

## Data flow

```
Buyer fills address
        │
        ▼
public.quote_cart(shop_id, address, shipping_method_id?)   security definer
        │  reads carts, cart_items, products, shops,
        │  shop_shipping_methods, shop_commerce_policies,
        │  platform_commerce_policy — nothing from the browser but
        │  the shop, the address and which method was chosen
        │
        ├─ private.shipping_quote(shop_id, subtotal, area_code) -> methods
        │       ↑ the carrier seam
        │
        ▼
checkout_quotes row  ──▶ returned as jsonb (quote id + every line to display)
        │
Buyer presses "Confirmar solicitud por $X"
        │
        ▼
public.checkout_cart_v3(quote_id, buyer_note, idempotency_key)
        │  revalidates: quote is this buyer's, unconsumed, unexpired,
        │  cart fingerprint unchanged, products still published,
        │  prices unchanged, units still cover quantities,
        │  method still enabled and still covers the destination
        │
        ▼
orders + order_items + order_addresses + order_events, quote marked consumed,
cart deleted — one transaction, idempotent on idempotency_key
```

`quote_cart` accepts no money, no shop ownership, no inventory and no dates from
the caller. Every figure is derived from database rows inside the function.

**Delivery estimate.** `dispatch = add_business_days(now(), max(handling_days),
shop.time_zone)`, then `delivery_min/max = add_business_days(dispatch,
min/max_transit_days, shop.time_zone)`. Pickup produces no delivery range: the
UI shows a ready-for-collection date instead.

**No covering method** ends the quote with a Spanish message naming the state,
and checkout stays disabled. Nothing is written.

## Interface changes

**Product page** — a policy summary near the price: returns (window or "sin
devoluciones"), warranty (duration or "sin garantía"), handling days, and either
"Envío desde $X" when an enabled method has a price, or "Calcula envío con tu
código postal" when it depends on destination. Wording is generated from policy
rows, so "gratis" appears only where a `free`/`free_over` method exists and
"garantía" only where `warranty_offered` is true.

**Cart** — address first, then a server quote, then the summary: subtotal,
shipping method, shipping cost, **total** (no tax line), estimated dispatch date,
delivery range, return window and conditions, warranty, and what buyer protection
covers — which is the existing dispute process, described as such and nothing
more. CTA reads "Confirmar solicitud por $X" and is disabled until a live quote
exists. Changing the address or the cart clears the quote and disables it again.
The summary is a `role="status"` region so a recalculation is announced, and the
disabled CTA carries the reason.

Copy states plainly that the seller must accept the request and that payment is
arranged separately.

## Migration and rollback

Three additive migrations, created with `supabase migration new` (never a
hand-invented filename):

1. Tables, constraints, indexes, RLS policies, immutability trigger.
2. `orders` columns; backfill `total = subtotal`, `shipping_amount = 0`,
   `tax_amount = 0`, `is_legacy_totals = true` for every existing row; then add
   `check (total = subtotal + shipping_amount + tax_amount)` as `not valid` and
   `validate` it, so the backfill is proven rather than assumed.
3. `private.shipping_quote`, `public.quote_cart`, `public.checkout_cart_v3`,
   with `revoke ... from public, anon` and `grant execute ... to authenticated`.

`checkout_cart_v2` stays in place through the rollout; existing order reads are
untouched because every new column is nullable or defaulted. Rollback is dropping
the new functions and tables and pointing the app back at v2 — the added `orders`
columns can stay behind harmlessly. Local database only; the linked project is
never reset.

## Tests

**pgTAP** — the seventeen requested, minus one:

1. Only the shop owner manages shipping methods and policies.
2. A buyer reads only their own quotes.
3. Anonymous users reach no quote.
4. Flat-rate calculation.
5. Free-shipping threshold, tested at the boundary.
6. Pickup produces zero shipping and no delivery range.
7. Unsupported destination is rejected.
8. `tax_mode = 'none'` stores zero and leaves `total = subtotal + shipping`.
   *(Replaces the inclusive/added comparison, which has nothing to compare until
   tax is turned on.)*
9. `total = subtotal + shipping + tax` holds, enforced by constraint.
10. Negative amounts are rejected.
11. A changed cart invalidates the quote.
12. A changed price or unit count invalidates the quote.
13. An expired quote cannot create an order.
14. Checkout is idempotent.
15. **Dropped: concurrent oversell.** Nothing decrements `units_available` in
    this marketplace, so there is no oversell property to test. The quote records
    units seen and refuses at checkout if they fell below the cart, which is the
    guarantee this model actually makes.
16. An order keeps its amounts and policy snapshot after the seller edits both.
17. A failed checkout rolls back every write.

**Unit and component** — every summary line present; loading, unavailable, stale
and recalculating states; CTA disabled without a quote; address and cart changes
invalidate; MXN formatting; delivery dates in the shop's timezone across business
days; returns and warranty summaries for accepted, unavailable and limited cases;
screen-reader labels and status announcements.

**E2E** — seller configures shipping and policy; buyer adds a product; covered
destination quotes; landed total and delivery range display; confirmation; buyer
and seller order screens show identical immutable figures; an uncovered
destination blocks confirmation; a cart change forces a requote; a seller policy
edit leaves the existing order untouched.

## Verification

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npx supabase test db`, Supabase security and performance advisors, the buyer and
seller checkout E2E, and a visual pass at desktop and 390 px. Database types are
regenerated after the migrations, never hand-edited.

The last check is the important one: no order may store a total that differs from
its quote. The constraint plus test 16 cover it.

## Limitations

- **Tax is off.** `tax_mode = 'none'` and no tax line. Turning it on needs a
  confirmed rate, accounting sign-off, and a decision about inclusive versus
  added pricing. The schema is ready; the policy is not.
- **No carrier rates.** Every method is seller-configured and static.
  `private.shipping_quote` is where a carrier integration lands.
- **No invoicing.** Nothing issues a CFDI or any receipt.
- **No payment collection.** Amounts shown are what the buyer will owe the
  seller, arranged directly, exactly as today.
- **Buyer protection is the dispute process**, not escrow or a refund guarantee.
  The copy says only what the platform actually does.
- **Platform floor is not enforced** against seller policies; both are recorded,
  neither constrains the other.
- Policy and shipping text is seller-authored and unreviewed. Legal review is
  required before this is advertised as protection of any kind.
