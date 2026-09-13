# Premium Seller Theme — Design Specification

## Objective

Give administratively distinguished shops a visually distinct, higher-craft presentation across their public shop page, their product pages, their listings in the catalog, and their own seller workspace. The distinction is granted by an administrator per shop, is never self-awarded, and is expressed through a scoped theme rather than duplicated components.

## Scope

This project includes:

- An administrator-controlled `is_premium` flag on `public.shops`, with grant provenance kept in a private table
- Database-level protection preventing sellers from awarding themselves the flag
- An admin RPC and server action mirroring the existing publishing-approval control
- A token-scoped premium theme (`[data-theme="premium"]`) in `app/globals.css`
- Three new design tokens that remove hardcoded colors blocking any theme scope, plus a `--trust-tier-fill` token that keeps the measured tier apart from the Premium badge
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

### `public.shops` addition

- `is_premium boolean not null default false`

Pages need the flag, so it lives on the public table. It is system-managed and protected on both write paths:

- **Update.** `private.guard_shop_trust_cache()` is extended to raise `42501` when a role other than `postgres` or `service_role` changes `is_premium`. This matches the existing protection on `trust_tier`, `listing_limit`, `trust_evaluated_at`, `is_publishing_approved`, and `publishing_reviewed_at`.
- **Insert.** The guard is `BEFORE UPDATE` only. RLS lets a seller insert their own shop row with any column values, so a dedicated `BEFORE INSERT` trigger, `private.apply_shop_premium_defaults()`, forces `is_premium` to `false` for any role other than `postgres` or `service_role`. It mirrors `apply_shop_publishing_approval`. An upsert is closed too: its conflict branch is an update, which the guard rejects.

### `private.shop_premium_grants`

- `shop_id bigint primary key`, referencing `public.shops (id)` `on delete cascade`
- `granted_at timestamptz not null default now()`
- `granted_by uuid null`, referencing the administrator account that granted it, `on delete set null`

Grant provenance is kept out of `public.shops` on purpose. That table is readable by `anon`, so a grantor column there would publish administrator account ids and, through `owner_id`, reveal which shop owners are administrators. The table grants nothing to `anon` or `authenticated`, has RLS enabled with no policies, and is written only by `set_shop_premium`.

### `public.set_shop_premium(p_shop_id bigint, p_enabled boolean)`

`security definer`, `set search_path = ''`, execute granted to `authenticated` only. Raises `42501` unless the caller is an administrator. Raises `P0002` when the shop does not exist. On success it writes `is_premium`. When enabling, it upserts the shop's `private.shop_premium_grants` row with `now()` and the caller. If the shop was already premium, the original grant row is kept rather than re-stamped. When disabling, it deletes the row. It returns one row of `shop_id`, `shop_slug`, `product_slugs` so the caller can revalidate exactly the affected paths. This mirrors `set_shop_publishing_approval`.

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
  --accent: #1e1a24;
  --on-brand: #16131a;
  --photo-backdrop: #211c27;
  --premium-text: #e8c777;
  --trust-tier-fill: color-mix(in srgb, var(--premium-gold) 30%, var(--surface));
  --success: #4ec98c;
  --font-bricolage: var(--font-fraunces-variable);
  color-scheme: dark;
}
```

Notes on values that differ from the first draft:

- **`--accent` is `#1e1a24`, not gold.** Components pair brand and accent as fill and ink: a measured trust value on a brand pill, or the shop backlink in `text-brand-hover` on `bg-accent`. With both set to gold, those pairs measured 1.00:1. WCAG AA is the hard rule, so accent inside the scope is the raised obsidian, which reads against gold both ways.
- **`--trust-tier-fill`** is a new token. At `:root` it is `color-mix(in oklab, var(--accent) 40%, transparent)`, which is exactly what `bg-accent/40` painted, so ordinary pages are unchanged. Inside the scope it is a toned bronze (30% gold over surface). That keeps the measured tier pill apart from the obsidian, gold-edged Premium badge beside it: 2.09:1 between the two fills, with the tier label at 6.28:1. The `:root` value resolves `var(--accent)` at the root, so any scope that overrides `--accent` must also override this token.
- **`--success`** is lightened because the light theme's `#19734c` is about 3.1:1 on obsidian, and share and status messages render inside the scope.
- **`color-scheme: dark`** makes native controls inside the scope, such as the quantity field, render dark.
- The wrapper element carries `text-ink`, so the scope block itself sets no `color`.

Because components are written against `bg-surface`, `text-brand`, `text-muted`, and `border-line`, they invert without prop threading or conditional class strings.

Additional scope rules:

- Focus rings. The global rule pairs a purple outline with a lime shadow; purple is invisible on obsidian. Inside the scope the outline becomes gold with a dark inner shadow, preserving a visible two-tone ring.
- `::selection` inside the scope uses gold background with obsidian text.
- `@utility gold-rule` provides the 1px gradient hairline used as a section divider.

### Typography

Fraunces is added through `next/font/google` in `app/layout.tsx` as the CSS variable `--font-fraunces-variable` only. `@theme inline` bakes each theme value into the utility, so `font-display` compiles to `font-family: var(--font-bricolage)` and never reads `--font-display` at runtime. Overriding `--font-display` in the scope would therefore change nothing. The premium scope overrides `--font-bricolage: var(--font-fraunces-variable)` instead; ordinary pages continue to use Bricolage Grotesque. Cost is one additional font file on first load.

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

The workspace header stays in the light theme and gains the `Premium` badge beside the shop name plus a short line confirming the shop is Premium. `ShopWorkspaceHeader` is a bare header (back links, name, tab nav), not a card. Darkening it would drop an obsidian block on a light work page, the same layout defect rejected for catalog cards. The badge paints with its own `--premium-gold` / `--premium-ink` tokens, so it needs no scope wrapper. Forms stay in the ordinary theme: long form pages are a much wider surface to verify for contrast and state styling, and the seller's public page is where the distinction matters.

## Administration

`setShopPremium` is added to `lib/actions/admin-publication.ts`, following `setShopPublishingApproval` exactly: parse and validate input, confirm a session, confirm administrator status through `is_current_user_admin`, call the RPC, then revalidate `/`, `/admin/usuarios`, the shop path, each affected product path, `/sitemap.xml`, and the seller workspace path.

The admin screen gains a second switch below the publishing switch in `components/admin/marketplace-users.tsx`, styled gold when active, with copy explaining that the shop and its products will use the distinguished theme.

## Testing

Database tests in `supabase/tests/database/shop_premium.test.sql`:

- `public.shops` has `is_premium` and no grant provenance columns; `private.shop_premium_grants` exists and `anon` and `authenticated` cannot read it.
- A seller setting `is_premium` on their own shop through update or upsert raises `42501`; through insert it is scrubbed to `false`.
- A non-administrator calling `set_shop_premium` raises `42501`; a missing shop raises `P0002`.
- An administrator enabling the flag sets `is_premium` and records the grant row with the grantor, and the returned row names the shop and its product slugs.
- Re-granting an already-premium shop keeps the original grant row.
- Disabling clears the flag and deletes the grant row.

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
