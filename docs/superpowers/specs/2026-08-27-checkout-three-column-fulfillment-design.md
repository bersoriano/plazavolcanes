# Solicitud de compra: three-column checkout with pickup or shipping

Today a buyer who clicks **Solicitar compra** lands on a two-column page: their
cart on the left, a mandatory delivery address on the right. Shipping is the only
way an order can exist, the seller is a name in a heading, and the conversation
about the item lives on a different route.

This design replaces that page with three columns, makes the buyer choose
between **recolección** and **envío** before they can confirm, and brings the
item-scoped message thread and the shop's own information onto the page.

Plaza Volcanes stays a **request** marketplace. No payment collection, no
payouts, no carrier integration. Cost and timing of delivery are still agreed
between buyer and seller in the thread — this design puts that thread where the
agreement has to happen.

## Relationship to the landed-cost design

`2026-08-26-landed-cost-checkout-design.md` is **superseded and shelved** by this
document. It was never implemented: no migration, table or code in the repository
refers to `shop_shipping_methods`, `checkout_quotes` or `quote_cart`.

Two things it claimed are taken over here:

- **Pickup.** It modelled pickup as a `shop_shipping_methods` row with
  `kind = 'pickup'` and no address. This design puts a real pickup address on the
  shop, because a buyer collecting an item needs to know where to go.
- **The name `checkout_cart_v3`.** It is used here, with a different signature.
  Should priced shipping and quoting return later, they build on this version and
  take the next name.

Nothing in the landed-cost design is deleted. Its quote row, policy versioning
and total arithmetic remain a reasonable plan for the day the marketplace prices
delivery, and this design is additive enough not to block it.

## Decisions taken before design

| Question | Decision |
|---|---|
| Where pickup happens | A seller-managed pickup address on `shops`. Minimal fields: calle y número, ciudad, estado, CP, referencias. No hours. |
| Who sees that street | Shop owner always. Buyer sees ciudad and estado until the seller accepts, then the full street from `accepted` onward — including `shipped`, `delivered` and `completed`. |
| Shop with no pickup address | Pickup is still offered. The panel says the point of collection is agreed in the chat. |
| Default fulfillment | **Neither** option preselected. Choosing one is mandatory before the request can be confirmed. |
| Shipping form | Rendered only when *envío* is chosen. Unchanged fields. |
| Alternate contact | Offered for **both** methods: nombre, teléfono, nota de relación. Stored on the order, not on the buyer's profile. |
| Thread in the page | The item-scoped `pre_sale` conversation. A cart with several products gets one tab per item. |
| Cost and dates | Out of scope. No shipping amount, no delivery estimate, no policy snapshot. Agreed in the thread, as today. |
| Inventory | Unchanged. Nothing decrements `units_available` today and this design does not start. |

## What already exists

The design leans on all of it, so it is worth stating:

- `public.checkout_cart_v2(p_shop_id, p_address, p_buyer_note, p_idempotency_key)`
  delegates to `private.checkout_cart_internal`. `security definer`,
  `set search_path = ''`, revoked from `public, anon`, granted to
  `authenticated`. Every new function copies that shape.
- Idempotency is `orders.idempotency_key`, checked before any write.
- `order_addresses` already exists with a `redacted_at` column, and
  `getOrderDetail` already reads it.
- `conversations.product_id` and
  `public.start_pre_sale_conversation(p_shop_id, p_product_id)` landed in
  `20260826120000_item_scoped_conversations`. The function is idempotent: one
  general thread per buyer and shop, one product thread per buyer, shop and
  product.
- `components/messages/message-thread.tsx` is a client component with Realtime,
  a degraded poll and a catch-up window. It takes an action, a conversation id,
  the current user id and the messages. It is reused unchanged.
- `user_contact_details.phone` is private per-user data with a
  `^\+52[0-9]{10}$` check. Display names live in `user_display_names`.
- `shops` carries `country_code` and `administrative_area_codes`, and the shop
  page already renders `TrustTierBadge` and `TrustBadges`.

## Schema

Two additive migrations. Nothing is dropped or rewritten.

### `public.shops` — pickup point

```
pickup_enabled                    boolean not null default false
pickup_address_line1              text
pickup_locality                   text
pickup_administrative_area_code   text
pickup_postal_code                text
pickup_notes                      text     -- referencias, <= 500
```

Constraints:

- `pickup_administrative_area_code` reuses the `^[A-Z]{2}-[A-Z0-9]{1,3}$` format
  check already on the table, and must start with `country_code || '-'`.
- `pickup_postal_code ~ '^[0-9]{5}$'` when present.
- A completeness check: `pickup_enabled = false or (pickup_address_line1 is not
  null and pickup_locality is not null and pickup_administrative_area_code is not
  null and pickup_postal_code is not null)`. A seller cannot advertise collection
  at an address that is half filled in.

Added `not valid`, then validated, so the existing rows are proven to pass rather
than assumed to.

### Reading the pickup point

Row-level security is the wrong tool here, because the sensitivity is per column,
not per row: the existing `select` policy on `shops` is public, and the row a
buyer is allowed to see is exactly the row carrying the seller's street.

So the street is removed from the table grant outright:

```
revoke select (pickup_address_line1, pickup_postal_code, pickup_notes)
  on public.shops from anon, authenticated;
```

`pickup_enabled`, `pickup_locality` and `pickup_administrative_area_code` stay
readable by everyone — that a shop offers collection in Zapopan, Jalisco is
storefront information. The three withheld columns are reachable only through a
function that decides who may see them.

`public.shop_pickup_point(p_shop_id bigint) returns jsonb`, `security definer`,
`set search_path = ''`, revoked from `public`, granted to `anon` and
`authenticated`.

It returns, for every caller:

```
{ enabled, locality, administrative_area_code }
```

and additionally `address_line1`, `postal_code` and `notes` when the caller is
either

- the shop's `owner_id`, or
- the `buyer_id` on an order for that shop whose `status` is one of
  `accepted`, `shipped`, `delivered`, `completed`.

Everything else — including a buyer whose request is still `requested`, and
including a buyer of a *different* shop — gets the coarse form. The gate lives
in this one function, so no page can leak the street by forgetting to check.

### `public.orders` — fulfillment

```
fulfillment_method     text not null check (fulfillment_method in ('pickup','shipping'))
alt_contact_name       text        -- <= 80
alt_contact_phone      text        -- ^\+52[0-9]{10}$
alt_contact_note       text        -- <= 200, "mi hermana", "recepción del edificio"
```

`fulfillment_method` is added with `default 'shipping'` so existing rows
backfill, then the default is dropped: every new order states its method
explicitly rather than inheriting one.

A check ties the contact fields together loosely — a phone or a note without a
name is refused, since the seller needs somebody to ask for.

`order_addresses` gains nothing. It simply has no row for a pickup order, which
is what makes the street the shop's rather than the buyer's.

### `public.checkout_cart_v3`

```
checkout_cart_v3(
  p_shop_id            bigint,
  p_fulfillment_method text,
  p_address            jsonb,     -- null for pickup
  p_alt_contact        jsonb,     -- null when not given
  p_buyer_note         text,
  p_idempotency_key    uuid
) returns bigint
```

`private.checkout_cart_internal` grows a method argument and an alternate-contact
argument. It raises `P0001` with a Spanish message when:

- `p_fulfillment_method` is not one of the two values,
- the method is `shipping` and `p_address` is null,
- the method is `pickup` and `p_address` is not null — a pickup order must not
  smuggle a delivery address past the reveal gate.

For `pickup` it skips the `order_addresses` insert entirely. Everything else —
the ownership check, the availability check, the order and item rows, the
`order_events` row, the cart deletion, the idempotency check — is unchanged and
still one transaction.

`checkout_cart_v2` stays and delegates with `'shipping'` and a null contact, so
nothing that calls it breaks during the rollout.

## Interface

### Seller: pickup address

`components/shops/shop-form.tsx` gains a **Recolección** block below Ubicación: a
`pickup_enabled` checkbox that reveals calle y número, ciudad, estado, código
postal and referencias. Estado reuses the `MEXICO_ADMINISTRATIVE_AREAS` select
already in the file.

`shopSchema` in `lib/validation/shop.ts` grows a refinement mirroring the
database check: enabled implies the four required fields are present. The
existing shop action passes the values through. No new route.

The column grant above applies to the owner too, so the edit form cannot read the
street back with a plain `select`. It loads the current values through
`shop_pickup_point`, which answers an owner with the full address. The update
itself is unaffected — `update` was never revoked — but the action must not use
`returning` on the withheld columns.

### Buyer: the three columns

`app/carrito/[shopId]/page.tsx` stays a server component and becomes a grid:

```
lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,320px)]
```

Each column moves into its own component file. The page today is a single
four-thousand-character JSX line; splitting it is part of the work, not a
separate cleanup.

**Left — `components/orders/buyer-panel.tsx`**

A read-only profile card: display name, phone from `user_contact_details`, the
account email, and a link to `/panel/cuenta` to change any of it. Below it,
`components/orders/fulfillment-choice.tsx`, a client component:

- Two **radios**, `name="fulfillment_method"`, values `pickup` and `shipping`,
  neither checked on first render. Radios rather than a checkbox because the
  choice is exclusive and mandatory; a checkbox has no state meaning "not yet
  answered".
- `shipping` reveals the existing `CheckoutForm` fields unchanged.
- `pickup` reveals the shop's ciudad and estado from `shop_pickup_point`, with
  the note that the exact address appears once the seller accepts. When the shop
  has no pickup address, it reads *"Acuerden el punto de recolección en el
  chat"* and links to the thread in the centre column.
- Both reveal an optional **Otro contacto** disclosure: nombre, teléfono, nota.
- The confirm button is disabled until a method is chosen, and the fieldset
  carries the reason so a screen reader is told why. The server validates the
  same rule — a disabled button is a courtesy, not a check.

**Centre — item, then thread**

Top row is today's content: the cart items with their quantity and remove forms,
the subtotal, and the note that payment and delivery are arranged with the
seller.

Bottom row is `components/orders/cart-thread.tsx`. One tab per cart item. Each
tab shows that item's `pre_sale` conversation for `(buyer, shop, product)` and
renders `MessageThread` unchanged. A new query
`fetchCartThreads(shopId, productIds)` reads the conversations that exist.

**Rendering must never create a conversation.** A tab with no thread yet renders
`StartConversationButton` bound to `openConversation(shopId, productId)`; the
existing action is extended with an optional return path so the buyer comes back
to the cart instead of being redirected to `/mensajes/:id`. A GET that writes
rows is how a crawler ends up opening threads on a seller's behalf.

**Right — `components/orders/shop-panel.tsx`**

Shop name and image, `TrustTierBadge`, `TrustBadges` metrics, the seller's
display name, the shop's location, and a link to `/tiendas/[slug]`. All of it
reads through queries that already exist and are already public.

### Mobile

Below `lg` the grid collapses to one column ordered:

1. the item and its total,
2. the shop information,
3. the buyer panel and fulfillment choice,
4. the thread, inside a `<details>` **collapsed by default**.

Implemented with `order-*` utilities reset at the `lg` breakpoint, so the DOM
order stays the reading order for assistive technology on the wide layout too.

### Order pages

`/compras/[id]` and `/panel/pedidos/[id]` render one of two blocks:

- **Envío** — the delivery address, exactly as today.
- **Recolección** — the shop's pickup point. Ciudad and estado while the order is
  `requested`; the full street, postal code and referencias from `accepted`
  onward, read through `shop_pickup_point` so the page never decides the gate for
  itself.

The alternate contact, when given, renders in both, on both the buyer's and the
seller's view.

## Data flow

```
Buyer opens /carrito/[shopId]
        │
        ├─ getCart(shopId)                    items, subtotal, shop
        ├─ shop_pickup_point(shopId)          coarse form: enabled, city, state
        ├─ fetchCartThreads(shopId, ids)      existing conversations, read only
        └─ buyer profile + shop trust         existing queries
        │
        ▼
Buyer chooses recolección or envío  (mandatory, neither preselected)
        │
        ▼
checkout_cart_v3(shop_id, method, address?, alt_contact?, note, idempotency_key)
        │  security definer; re-checks method, address presence and absence,
        │  product availability, shop ownership, idempotency
        │
        ▼
orders (+ order_items, + order_addresses only for shipping, + order_events),
cart deleted — one transaction
        │
        ▼
/compras/[id]   pickup street stays hidden until the seller accepts
```

Nothing about money, ownership or the pickup address is taken from the browser.
The shop's pickup point is read from the shop row inside the function; the buyer
never posts it.

## Migration and rollback

Two additive migrations, created with `supabase migration new` — never a
hand-invented filename:

1. `shops` pickup columns, constraints added `not valid` then validated, the
   column-level `revoke select` on the three sensitive columns, and
   `public.shop_pickup_point`.
2. `orders.fulfillment_method` with a backfilling default that is then dropped,
   the alternate-contact columns, `private.checkout_cart_internal` extended, and
   `public.checkout_cart_v3` with `revoke ... from public, anon` and
   `grant execute ... to authenticated`.

`checkout_cart_v2` stays through the rollout. Every added `orders` column is
nullable or defaulted, so existing order reads are untouched. Rollback is
dropping `checkout_cart_v3` and `shop_pickup_point` and pointing the app back at
v2; the added columns can stay behind harmlessly. Local database only — the
linked project is never reset.

## Tests

**pgTAP** (`supabase/tests/database/`)

1. A shipping checkout writes an `order_addresses` row and
   `fulfillment_method = 'shipping'`.
2. A pickup checkout writes **no** `order_addresses` row and
   `fulfillment_method = 'pickup'`.
3. `shipping` with a null address is refused.
4. `pickup` with an address is refused.
5. An invalid `fulfillment_method` is refused.
6. A repeated `idempotency_key` returns the first order and writes nothing.
7. `shop_pickup_point` gives the owner the full address.
8. It gives a buyer with a `requested` order only city and state.
9. It gives that buyer the street once the order is `accepted`, and still at
   `completed`.
10. It gives an unrelated signed-in user, and an anonymous caller, only city and
    state.
11. A shop cannot set `pickup_enabled` with an incomplete address.
12. Alternate contact: a phone without a name is refused.
13. A direct `select pickup_address_line1 from shops` is refused for `anon` and
    for `authenticated`, so the function is the only way through.

**Unit** (Vitest) — `shopSchema` pickup refinement; `fulfillment-choice`
rendering with neither radio checked, revealing each branch, and keeping the
submit disabled until a choice is made; `buyer-panel`, `shop-panel` and
`cart-thread` tab switching; the pickup and shipping branches of the order
detail block.

**E2E** (Playwright, extending `tests/e2e/purchase-intent.spec.ts`) — confirm is
blocked with no method chosen; a shipping request end to end; a pickup request
end to end; and the pickup street being absent from the order page while the
request is pending.

## Limitations

- No shipping cost, no delivery estimate, no return or warranty policy. Buyer and
  seller agree all of it in the thread. The shelved landed-cost design remains
  the plan for the day that changes.
- Pickup has no hours or scheduling. The thread carries it.
- The alternate contact is per order and is not remembered for the next one.
- A cart with several items shows several threads but still produces one order.
  Nothing here changes that.
