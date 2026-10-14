# Public Shop Page Redesign — Design Specification

## Objective

Give a shop's catalogue the first screen of `/tiendas/[slug]`. Today the delivery policy box and eleven trust pills sit between the shop's name and its products: on a 1440×900 desktop the first product starts about 1,340px down, on a phone about 1,660px (the pills alone are 328px tall there, the policy 202px). The page should read like a clean storefront — banner with the name on it, a short line of facts, then the products — while every signal and the policy stay one tap away.

## Scope

This project includes:

- A shorter, frameless banner with the shop name over a bottom gradient
- One info row: trust tier, founder and premium badges, location, description, and up to three earned signals as plain text
- A closed `<details>` disclosure holding the delivery policy, the full trust badge list, and its footnote
- A quieter catalogue heading with a product count
- A `ProductCard` option that hides the shop name and location, used only on this page
- A `className` prop on `TrustTierBadge`
- A loading skeleton reshaped to match

This project excludes:

- Category chips, filters, or sort on the shop page. Shops carry few products today.
- Any change to the trust markers, their wording, or how they are measured.
- Any change to `ProductCard` on other screens, or to `TrustTierBadge` on other screens.
- New global CSS. `app/globals.css` sits near Turbopack's 100 KiB split point.

## Layout, top to bottom

### Back link

`Volver a la plaza` stays, with less space above and below it.

### Banner

- No bordered card around it, and no `Tienda independiente` eyebrow.
- Rounded corners. Aspect `16/7` on a phone and `5/1` from `sm`; a Premium shop keeps a slightly taller frame (`16/8`, `4/1`).
- With a photo: the image fills the frame, a bottom gradient (`from-black/70`) darkens the lower part, and the `h1` sits on it in white. White is fixed rather than a token: the text sits on a photograph in both themes.
- Without a photo: a solid `bg-brand` band, the `h1` in `text-on-brand`. Both tokens flip under `data-theme="premium"`, so the pair stays legible there.

### Info row

Two columns from `lg` (info on the left, actions on the right, top-aligned); stacked below that.

Left column, in order:

1. Badges and place in one wrapped row: `TrustTierBadge`, `FounderBadge` when `founder_since` is set, `PremiumBadge` when `is_premium`, then the location with its pin.
2. The description, full, in the seller's words.
3. Earned signals: the first three *measured* signals, in the order `TrustBadges` already uses (membership first, then `PUBLIC_TRUST_MARKERS`), as `label value` text joined by `·`. Unmeasured signals never appear here. If none is measured, the line is not rendered.
4. A `<details>`, closed by default. Its summary reads `Entregas y señales de confianza` when the shop has a delivery policy, `Señales de confianza` when it has none. Opened, it shows:
   - the delivery policy section exactly as today (`h2` `Política de entregas`, the seller's text with its line breaks), only when there is one;
   - the full `TrustBadges` list, measured and unmeasured;
   - the footnote `Estas son todas las señales que Plaza Volcanes mide para cada tienda. Nadie puede editar sus propias métricas.`

Right column: `StartConversationButton` and `ShareActions`, unchanged.

### Catalogue

- A hairline rule, then `h2` `Productos` with the count beside it in muted text. The `Escaparate` eyebrow goes.
- `ProductGrid` as today.
- Each `ProductCard` gets `showShop={false}`: no shop-name line and no location line, because every card on this page belongs to the same shop. Photo, condition pill, founder/premium chip and ring, title and price stay.
- The empty state stays as it is.

### Loading skeleton

A banner block, two short info lines, then the four-card grid, with the new spacing.

## Component changes

| File | Change |
| --- | --- |
| `app/tiendas/[slug]/page.tsx` | New layout above |
| `app/tiendas/[slug]/loading.tsx` | New skeleton |
| `components/shops/trust-badges.tsx` | Export the badge builder so the page can pick the earned signals from the same list the disclosure shows |
| `components/shops/trust-tier-badge.tsx` | `className` prop, default `mt-4`, so other screens are unchanged |
| `components/catalog/product-card.tsx` | `showShop` prop, default `true`, applied to the default variant |

## Testing

Vitest, written first:

- The page shows up to three measured signals in the info row and none of the unmeasured ones.
- The page keeps the delivery policy heading and text, and the full trust badge list, inside the disclosure; its summary names entregas only when there is a policy.
- Existing page tests (enquiry action, return path, pending shop, policy shown or absent, premium room, ordinary theme, tier badge contrast) stay green.
- `ProductCard` with `showShop={false}` renders neither the shop name nor the location; the default still renders both.
- `TrustTierBadge` keeps `mt-4` by default and takes a replacement class.

In the browser, against local dev: 1440×900 and 390×844, an ordinary and a Premium shop, with and without a banner photo. The first product row is visible in the first desktop screen, and the page has no horizontal scroll on a phone. The existing e2e (`shop-onboarding-feedback`) only looks for the `h1` by name, which stays.
