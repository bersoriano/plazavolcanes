# Task 2 report: effective visibility, expiry, and commerce enforcement

## Scope

Implemented Task 2 in the generated moderation migration:

- effective public product visibility requires seller publication intent, admin
  enablement, approved shop publishing, and a non-null future expiry;
- owners retain their separate product/read branch, and historical order and
  conversation read models remain untouched;
- images and approved translations mirror effective product visibility;
- discovery and privileged commerce functions enforce the same explicit product
  and shop predicates instead of relying only on RLS;
- publication approval and product enablement now suspend/refresh expiry
  windows as required; the migration reconciles due expiration before public
  policies are installed;
- the two requested publication indexes were added.

The existing suite fixtures that intentionally create publicly purchasable
products now explicitly approve their shops. This keeps those tests about
their original concern rather than silently relying on pre-moderation public
visibility.

## TDD evidence

### RED

New behavior tests were written before the implementation. The current CLI
uses positional test paths; the brief's historical `--file` flag was rejected.

Command:

```sh
npx supabase test db supabase/tests/database/commerce_foundation.test.sql
```

Output (before the implementation):

```text
Failed test 28: "a hidden product cannot be added to a cart"
  caught: no exception
  wanted: P0002
Failed test 29: "checkout rejects a cart containing a product that became hidden"
  caught: no exception
  wanted: P0001
Failed 2/29 subtests
Result: FAIL
```

Command:

```sh
npx supabase test db supabase/tests/database/product_conversations.test.sql
```

Output (before the implementation):

```text
Failed test 25: "a hidden product cannot start a new pre-sale conversation"
  caught: no exception
  wanted: P0002
Failed 1/31 subtests
Result: FAIL
```

The focused pre-reset run also showed the expected missing effective visibility
behavior: three anonymous product gate checks, the dependent-image check, and
hidden-search-selection check failed. The status gate already existed, so its
new regression assertion was green against the old policy; the newly missing
admin, shop-approval, and expiry gates were red.

### GREEN

After a local database reset applied the generated migration, the five Task 2
test files passed together:

```sh
npx supabase test db \
  supabase/tests/database/commerce_foundation.test.sql \
  supabase/tests/database/product_conversations.test.sql \
  supabase/tests/database/product_expiry.test.sql \
  supabase/tests/database/product_images.test.sql \
  supabase/tests/database/categories_search.test.sql
```

```text
Files=5, Tests=170
Result: PASS
```

Final verification reset and ran the complete database suite:

```sh
npx supabase db reset --local --yes
npx supabase test db
```

```text
Applying migration 20260829055734_shop_publication_moderation.sql...
All tests successful.
Files=28, Tests=573
Result: PASS
```

## Self-review

- `git diff --check` completed without whitespace errors.
- Confirmed the expiry reconciliation and `private.expire_due_products()` call
  occur before the replacement public product policy.
- Confirmed each privileged path has its own product-to-shop join and all four
  effective-public conditions: `add_cart_item`, checkout v2/v3's shared
  private implementation, search, state counts, search-selection telemetry,
  and new pre-sale conversations.
- Confirmed expired/hidden products cannot start new commerce activity, while
  pre-existing order/conversation history remains readable.
- No storage, URL-signing, or listing-limit behavior was changed.

## Fix round 1

### RED

Added regressions for the remaining privileged-cart and search-limit gaps, then
ran the focused files against the prior implementation:

```sh
npx supabase test db \
  supabase/tests/database/commerce_foundation.test.sql \
  supabase/tests/database/categories_search.test.sql \
  supabase/tests/database/product_images.test.sql
```

```text
Failed test 29: "a cart quantity cannot be changed after its product becomes hidden"
  caught: no exception
  wanted: P0002
Failed test 83: "a hidden exact match cannot consume the only search result slot"
  have: NULL
  want: (visible product id)
Result: FAIL
```

The dependent-row tests also now prove both sides of the policy contract:
anonymous access disappears when the parent is hidden, while the owner still
reads the same image or approved translation.

### GREEN

- Replaced `public.set_cart_item_quantity` in the moderation migration with an
  explicit cart/product/shop effective-public lookup.
- The public search wrapper now requests the legacy candidate set at the
  maximum supported size, applies the effective-public gate, and only then
  orders and clamps the requested limit.
- Focused regressions passed: `Files=3, Tests=128, Result: PASS`.
- Full database suite passed after the fix: `Files=28, Tests=578, Result: PASS`.

## Fix round 2

### RED

Added a regression with 101 higher-ranked hidden exact matches and one lower-
ranked visible match, with `p_limit = 1`:

```sh
npx supabase test db supabase/tests/database/categories_search.test.sql
```

Before this fix it failed as intended:

```text
Failed test 84: "more than one hundred hidden exact matches cannot exhaust public search candidates"
  have: NULL
  want: (visible product id)
Result: FAIL
```

### GREEN

The migration now derives a private uncapped candidate function from the
established, inaccessible legacy ranking function, removing only its terminal
candidate limit. The public security-definer wrapper applies the effective
visibility join, orders the filtered rows, and then clamps the caller's
`p_limit`. The legacy and candidate helpers have no browser-role execute grant.

After a local reset applied the migration:

```text
npx supabase test db supabase/tests/database/categories_search.test.sql
Files=1, Tests=88
Result: PASS
```
