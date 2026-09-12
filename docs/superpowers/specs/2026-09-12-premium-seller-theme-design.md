# Premium Seller Theme — Design Specification

## Objective

Give administratively distinguished shops a visually distinct, higher-craft presentation across their public shop page, their product pages, their listings in the catalog, and their own seller workspace. The distinction is granted by an administrator per shop, is never self-awarded, and is expressed through a scoped theme rather than duplicated components.

## Scope

This project includes:

- An administrator-controlled `is_premium` flag on `public.shops`, with grant provenance
- Database-level protection preventing sellers from awarding themselves the flag
- An admin RPC and server action mirroring the existing publishing-approval control
- A token-scoped premium theme (`[data-theme="premium"]`) in `app/globals.css`
- Three new design tokens that remove hardcoded colors blocking any theme scope
- A `PremiumBadge` component shown beside the existing trust tier badge
- Premium presentation on the public shop page, public product page, catalog cards, and the seller workspace header

This project excludes:

- Any change to the automatic trust tier system (`standard`, `reliable`, `top_rated`)
- Paid promotion, ranking boosts, or search weighting for premium shops
- Premium theming of the site header, footer, bottom navigation, or checkout
- A seller-facing request or application flow for premium status
- Dark mode for non-premium surfaces

## Approved Product Policies

- Premium status is granted per shop by an administrator. It is independent of the computed trust tier.
- Sellers cannot set, request, or influence the flag from the application. Attempts are rejected by the database.
- Premium status is cosmetic distinction, not a measured trust signal. Its badge tooltip states that Plaza Volcanes grants it, so buyers are not misled into reading it as an earned metric.
- Premium presentation never removes or weakens the trust information an ordinary shop shows. The trust tier badge and trust metrics remain present and unchanged in meaning.
- Buyer-facing label is `Premium`. Accessible name and tooltip use `Tienda Premium`.
- The premium theme is scoped to the shop's own surfaces. Site chrome stays in the ordinary theme so the marketplace remains one place.

## Canonical Evidence

### `public.shops` additions

- `is_premium boolean not null default false`
- `premium_granted_at timestamptz null`
- `premium_granted_by uuid null`, referencing the administrator account that granted it, `on delete set null`

These three columns are system-managed. `private.guard_shop_trust_cache()` is extended to raise `42501` when a role other than `postgres` or `service_role` changes any of them, matching the existing protection on `trust_tier`, `listing_limit`, `trust_evaluated_at`, `is_publishing_approved`, and `publishing_reviewed_at`.

### `public.set_shop_premium(p_shop_id bigint, p_enabled boolean)`

`security definer`, `set search_path = ''`, execute granted to `authenticated` only. Raises `42501` unless the caller is an administrator. On success it writes `is_premium`, stamps `premium_granted_at` and `premium_granted_by` when enabling, clears both when disabling, and returns one row of `shop_id`, `shop_slug`, `product_slugs` so the caller can revalidate exactly the affected paths. This mirrors `set_shop_publishing_approval`.

### `list_admin_marketplace_users`

Extended to include `is_premium` per shop so the admin screen can render current state without a second query.

## Theme Architecture

### Token gaps closed first

The existing stylesheet already drives color through custom properties, but three hardcoded values would survive any theme scope and break a dark surface. Each is replaced by a token whose default value is the current color, so ordinary pages render identically.

| Hardcoded value | Occurrences | New token | Default | Premium |
| --- | --- | --- | --- | --- |
| `bg-[#eee8e1]` | shop hero, product card, product gallery (3), catalog shop card | `--photo-backdrop` | `#eee8e1` | `#211c27` |
| `text-white` on brand fill | `components/ui/button.tsx` and brand-filled buttons | `--on-brand` | `#ffffff` | `#16131a` |
| `bg-white` on secondary surfaces | `components/ui/button.tsx`, share actions | `--surface-raised` | `#ffffff` | `#1e1a24` |

`--on-brand` is required, not cosmetic: in the premium scope the brand color becomes gold, and white text on gold fails contrast.

### Premium scope

```css
[data-theme="premium"] {
  --background: #0f0d12;
  --surface: #16131a;
  --surface-raised: #1e1a24;
  --text: #f5f1ea;
  --text-muted: #a9a0b0;
  --border: #3a3142;
  --brand: #e8c777;
  --brand-hover: #f2d894;
  --accent: #e8c777;
  --on-brand: #16131a;
  --photo-backdrop: #211c27;
  --font-display: var(--font-fraunces);
}
```

Because components are written against `bg-surface`, `text-brand`, `text-muted`, and `border-line`, they invert without prop threading or conditional class strings.

Additional scope rules:

- Focus rings. The global rule pairs a purple outline with a lime shadow; purple is invisible on obsidian. Inside the scope the outline becomes gold with a dark inner shadow, preserving a visible two-tone ring.
- `::selection` inside the scope uses gold background with obsidian text.
- `@utility gold-rule` provides the 1px gradient hairline used as a section divider.

### Typography

Fraunces is added through `next/font/google` in `app/layout.tsx` as a CSS variable only. The premium scope binds `--font-display` to it; ordinary pages continue to use Bricolage Grotesque. Cost is one additional font file on first load.

### Contrast

Target is WCAG AA for all text. Gold `#e8c777` on obsidian `#16131a` is approximately 9.8:1; muted `#a9a0b0` on the same is approximately 6.4:1. Ratios are verified during implementation, and any pair below 4.5:1 for body text is corrected before the work is considered complete.

## Surfaces

### Public shop page — `app/tiendas/[slug]/page.tsx`

The premium wrapper sits outside the `max-w-[1440px]` section so the obsidian background reaches the viewport edges. The hero image moves from `16/9` to `21/9`, the shop name renders in the serif display face at wider tracking, a gold hairline separates the identity block from the description, and `PremiumBadge` sits beside `TrustTierBadge`. The delivery policy panel and trust badges require no edits; they follow the tokens.

### Public product page — `app/productos/[slug]/page.tsx`

The same wrapper applies when the product's shop is premium. The gallery backdrop follows `--photo-backdrop`, the price renders in the brand color (gold in scope), and the badge appears beside the shop backlink.

### Catalog cards — `components/catalog/product-card.tsx`, `components/catalog/shop-card.tsx`

Cards keep the ordinary light surface. A dark card inside a light grid reads as a layout defect rather than as distinction, and the grid must stay legible as one catalog. Premium cards instead carry a gold hairline ring around the image, a small gold `Premium` chip in the upper right, and the shop name in a deeper gold ink. The full theme is the payoff on click-through.

### Seller workspace — `app/panel/tiendas/[id]`

The premium scope applies to the workspace header card only, carrying the badge and a short line confirming the shop is Premium. Forms stay in the ordinary theme: long form pages are a much wider surface to verify for contrast and state styling, and the seller's public page is where the distinction matters.

## Administration

`setShopPremium` is added to `lib/actions/admin-publication.ts`, following `setShopPublishingApproval` exactly: parse and validate input, confirm a session, confirm administrator status through `is_current_user_admin`, call the RPC, then revalidate `/`, `/admin/usuarios`, the shop path, each affected product path, `/sitemap.xml`, and the seller workspace path.

The admin screen gains a second switch below the publishing switch in `components/admin/marketplace-users.tsx`, styled gold when active, with copy explaining that the shop and its products will use the distinguished theme.

## Testing

Database tests in `supabase/tests/database/shop_premium.test.sql`:

- A seller updating `is_premium` on their own shop raises `42501`.
- A non-administrator calling `set_shop_premium` raises `42501`.
- An administrator enabling the flag sets `is_premium`, `premium_granted_at`, and `premium_granted_by`, and the returned row names the shop and its product slugs.
- Disabling clears the timestamp and grantor.

Application tests:

- `app/tiendas/[slug]/page.test.tsx` and `app/productos/[slug]/page.test.tsx` assert the premium scope is present for a flagged shop and absent otherwise.
- `components/catalog/product-card` test asserts the chip and ring appear only when flagged.
- A `PremiumBadge` test asserts label, accessible name, and tooltip text.
- Admin mapper test asserts `is_premium` passthrough; admin action tests cover unauthorized, invalid input, and success states.

Development follows the project's test-first workflow. The work is complete when `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` all pass.

## Risks

- **Missed hardcoded color.** Any color not driven by a token stays light inside the premium scope and reads as a rendering bug. Mitigated by the audit recorded above and a visual check of each premium surface.
- **Perceived pay-to-play.** Buyers may read the distinction as purchased placement. Mitigated by wording that names Plaza Volcanes as the grantor and by leaving all trust signals unchanged.
- **Contrast regressions in shared components.** Components used on both themes must be checked in both. Mitigated by keeping the scope narrow and verifying ratios during implementation.
