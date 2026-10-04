# Stock Reservation — Design Specification

## Objective

Stop overselling. Today `products.units_available` is a static claim: it is checked when a buyer adds to cart, but checkout neither checks nor decrements it, so a one-unit listing can collect any number of purchase requests. After this change a unit a buyer orders is held for that order the moment the request is placed, and goes back on the shelf exactly once if the order ends without a sale.

## Scope

This project includes:

- Checking and decrementing `units_available` inside checkout, under row locks
- A per-order `stock_reserved` flag so only orders that actually took units give them back
- One trigger on `public.orders` that restores units when an order is rejected or canceled
- Allowing 0 units (sold out) and raising the per-listing cap from 10 to 999
- "Agotado" presentation on catalog cards, the product page, the cart and the seller catalog row
- Blocking publication and reactivation of a listing with 0 units

This project excludes:

- Expiring stale purchase requests (a request still holds its units until the seller decides)
- Seller notifications
- Hiding sold-out listings from explore, search or shop grids
- Inline stock editing or bulk actions in the seller catalog
- Restocking after shipment, completion or dispute resolution

## Approved Product Policies

- A unit is reserved when the buyer places the purchase request, not when the seller accepts it.
- `units_available` means "units a buyer can order right now". The seller edits that number; orders change it.
- A rejected or canceled order gives its units back once. A seller cancellation with reason `inventory_unavailable` does not: the seller has said the unit does not exist.
- Orders placed before this change never reserved stock and never release any.
- A sold-out published listing stays published and listed, with an "Agotado" badge. Buyers cannot add it to a cart. Conversations about it remain possible.
- Publishing or reactivating requires at least one unit. An already-published listing may be saved with 0.
- The per-listing cap is 999. A single cart line remains capped at 99.

## Database

One migration.

1. Replace `products_units_available_check` with `check (units_available between 0 and 999)`. Drafts stay nullable; the column default stays 1.
2. Add `orders.stock_reserved boolean not null default false`. Existing rows stay `false`.
3. Redefine `private.checkout_cart_internal_v2` from its latest version (`20260829055734_shop_publication_moderation.sql`). After locking the cart, lock every product in the cart with `for update` in `id` order, so two checkouts touching the same products always queue in the same order. For each line, if `quantity > coalesce(units_available, 0)`, raise `P0001`:
   - `«<name>» se agotó.` when no units remain
   - `Solo quedan <n> unidades de «<name>».` (singular `Solo queda 1 unidad de «<name>».`) otherwise

   Then decrement every line and insert the order with `stock_reserved = true`. Everything runs in the checkout transaction, so any failure leaves stock and cart untouched.
4. Add `private.release_order_stock()` as a `before update of status` trigger on `public.orders`. When `old.stock_reserved` is true and `new.status` is `rejected`, `canceled_by_buyer`, `canceled_by_seller` or `canceled_by_admin`, it adds each order line's quantity back to its product, clamped with `least(999, coalesce(units_available, 0) + quantity)`, unless the order is a seller cancellation with reason `inventory_unavailable`. It always sets `new.stock_reserved = false`, which makes a second release impossible. Lines whose `product_id` is null are skipped. Lock order is order row then product rows; checkout never locks an existing order, so the two paths cannot deadlock.
5. Redefine `public.add_cart_item` and `public.set_cart_item_quantity` from their latest versions so that a listing with no units raises `Este producto se agotó.` instead of `Solo hay 0 unidades disponibles.`

Shipped, delivered and completed orders keep their units consumed.

## Application

- `lib/listing-readiness.ts`: `MAX_UNITS = 999`. `MIN_UNITS = 1` stays the publication requirement.
- `lib/validation/product.ts`: the form accepts 0–999.
- `lib/actions/products.ts` (`setProductStatus`): publishing or reactivating a listing with fewer than one unit returns `Agrega unidades antes de publicar.`
- `components/products/product-form.tsx`: `min=0 max=999`, with a hint that orders subtract units and 0 means sold out.
- Seller catalog (`app/panel/tiendas/[id]/page.tsx`, `components/products/product-row.tsx`): select `units_available`; show the unit count, or an "Agotado" chip at 0.
- `components/catalog/product-card.tsx`: an "Agotado" badge at 0 units. The catalog query already selects the column.
- `app/productos/[slug]/page.tsx`: at 0 units the add-to-cart form is replaced by an "Agotado" notice; the conversation button stays.
- `components/orders/cart-items.tsx`: a line whose quantity exceeds current stock says `Solo quedan <n>` or `Agotado`; checkout for that cart is disabled until it is fixed. The database message remains the backstop.
- The existing dashboard task "Repón inventario" becomes reachable without changes.

## Testing

- pgTAP `supabase/tests/database/stock_reservation.test.sql`: checkout decrements each line; ordering more than remains fails with the product's name; the second buyer of a last unit fails; reject, buyer cancel and seller cancel restore exactly once; seller cancel with `inventory_unavailable` does not restore; a legacy order with `stock_reserved = false` does not restore; restoration clamps at 999; `add_cart_item` on a sold-out listing says it sold out.
- pgTAP `product_units.test.sql` updated: the constraint accepts 0 and 999 and rejects 1000.
- Vitest: validation bounds, readiness, reactivation block, product card badge, sold-out product page, cart over-stock line, seller catalog chip.
- Concurrency between two live sessions is not exercised by pgTAP. The guarantee is the `for update` lock on product rows inside the checkout transaction.
