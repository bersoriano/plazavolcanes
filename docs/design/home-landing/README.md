# Home page (/) restyle — design handoff

**Status:** ready to implement. Settle the open questions in §6 first.
**Design source:** Claude Design canvas "Plaza Volcanes · Vendedores", page "Inicio (/)" (private to Bear): https://claude.ai/artifact/4BmrW3KL7UEWQcV7EtccVj
**Exported:** 2026-09-25
**Scope:** the home page only. `/vender` is not touched, and neither are the header, the footer, the launch bar or the bottom nav.

## 1. What this is

The same sections the home page has today, in the same order, restyled with the language of the new `/vender` page: the purple and lime blocks, Bricolage Grotesque headlines with an italic accent, rounded cards, layered photos. The one structural change is the hero, which now carries a single buyer message instead of three rotating ones.

## 2. What's in this folder

| File | Use it for |
| --- | --- |
| `desktop.html` | Reference markup at 1440px: exact copy, spacing, sizes and structure. Open it in a browser. |
| `mobile.html` | Reference markup at 390px. |
| `screens/desktop-*.png` | One screenshot per section at 1440px, plus `desktop-full.png`. |
| `screens/mobile-*.png` | The same at 390px (2x). Tall sections are split into `-a`, `-b`. |
| `assets/` | The photos used in the mockup. The three hero images are copies of `public/herogirl.jpg`, `public/new-items.jpg` and `public/used-items.jpg`; the listing and shop photos are snapshots of live rows and come from the database in production. |
| `PROMPT.md` | The prompt to paste into Claude Code. |

Attributes in the reference markup: `data-component="…"` names the component each section maps to, and `data-global="…"` marks the chrome that must not change.

**Tokens, type scale, radii and the lucide icon mapping are the same as `/vender`: see `../vender-landing/README.md` §4 and §5.** Everything here uses those tokens; don't introduce raw hex.

## 3. Section by section

### 3.1 HomeHero — `components/home/home-hero.tsx`

The biggest change.

- **One message, no carousel.** Drop `MESSAGES`, the rotation `useEffect`, the reduced-motion hook and the dot buttons. The kept message is the buyer one: kicker "Hecho cerca. Encontrado aquí.", headline "Encuentra productos únicos *cerca de ti.*", deck "Explora artículos nuevos y usados, revisa quién vende y acuerda pago y entrega directamente con cada tienda." Without rotation the component no longer needs `"use client"`, except for the pieces noted below.
- **The seller pill is gone.** The launch bar above the header already carries the promotion.
- **Layout at lg:** a 12-column grid, copy on 7, collage on 5. Below lg it stacks, with the collage after the checklist.
- **Copy column:** the kicker becomes a pill (lime tint, purple dot); `h1` at 80px desktop / 46px phone, weight 500, `leading-[0.98]`, `tracking-[-0.035em]`, with the closing phrase in italic `text-brand`; the deck; then the two buttons — "Explorar productos" (`bg-brand`, 60px, arrow) and "Quiero vender" (white, `border-line`, → `/vender?desde=hero`). On phones the buttons are full width and stacked.
- **A three-item checklist** above a hairline: "Sin cuenta para mirar", "Pago directo con cada tienda", "Todo queda por escrito". All three are things the product actually does.
- **Collage (decorative, `aria-hidden`):** the buyer photo in a white card, the two catalogue photos as rotated cards (5° and −6°), a lime pill "Tiendas independientes de México", and a floating card for the newest listing (photo, "Recién publicado", name, price). Exact offsets are in the HTML. Keep `next/image` with `priority` on the large photo.
- **The floating listing card should use real data:** pass the first product of the home catalogue into the hero and hide the card when the catalogue is empty. See §6.

### 3.2 CatalogSearchPanel — new, from `components/catalog/catalog-screen.tsx`

The search bar and the category row move into one white card that overlaps the bottom of the hero (`-104px` at lg, `-84px` on phones, with `z-10`; the hero gets matching extra bottom padding). Same `SearchBar` and `CategoryNavigation`, restyled: a 64px pill-shaped field, a divider, the state select with a pin, and a round purple submit button. The category chips get a fade at the right edge to show the row scrolls.

Only the home branch (`homeHero`) gets this panel. The state and filter views keep the section they have now.

### 3.3 CatalogSection — `catalog-screen.tsx` + `components/catalog/product-card.tsx`

- Header: eyebrow, then the `h2` at 60px with "de la plaza." in italic `text-brand`; the view pills stay.
- **Product card:** photo goes from 4:3 to **4:5**, so the portrait photos your sellers upload stop being cropped; radius `1.5rem` desktop / `1.125rem` phone. The condition pill stays top-left; the Premium badge stays top-right on desktop and moves to bottom-left on phones, where the two would collide. Below the photo: shop name and category, the product name in display type (2 lines max), the price at 22px display, then the location with a pin icon on its own line.
- The Premium gold ring and the premium-coloured shop name are unchanged.

### 3.4 SellerPitch — `components/home/seller-pitch.tsx`

Same copy and the same three promises, restyled to match `/vender`: a purple panel with the volcano mark and a lime glow, the headline with "Plaza Volcanes." in italic lime, and, at lg, the `$0.00` receipt illustration from `/vender` on the right (decorative, `aria-hidden`). On phones the receipt sits between the promises and the buttons.

### 3.5 ShopsSection — `catalog-screen.tsx` + `components/catalog/shop-card.tsx`

- Card: 16:9 cover, then name, the trust-tier pill, the location with a pin, the description (2 lines) and the arrow. The Premium gold border and badge stay.
- Desktop shows a three-column grid; phones keep the horizontal scroll.
- **Optional (§6):** a dashed "Tu tienda podría estar aquí → Quiero vender" card as the last item, linking to `/vender?desde=tiendas`.

### 3.6 StateExplorer — `components/home/state-explorer.tsx`

A white panel: heading and text on the left (5 of 12), the states on the right as tiles with a purple pin tile, the state name in display type and the count below. Phones stack them.

### 3.7 BuyerSteps — `components/home/buyer-steps.tsx`

Becomes a full-bleed white band with hairlines top and bottom. Header row: eyebrow, `h2` at 60px, deck, and the "Ver productos" button on the right at lg. Three cards on cream with purple icon tiles and "PASO n". On phones it's a vertical list joined by a dashed line, with the button full width at the end — the same pattern as the `/vender` steps.

### 3.8 TrustStrip — `components/home/trust-strip.tsx`

The `aria-label` becomes a visible eyebrow, "Antes de acordar una compra". Four columns, each with a 2px purple rule on top, a lime icon tile and the same copy. The "Quejas y aclaraciones" link stays.

## 4. Behavior and performance

- The `h1` is the LCP element; the hero photo should keep `priority` and correct `sizes`.
- The overlapping search panel must not sit under the sticky header on small screens; check the scroll-margin on `#catalogo` still lands right after the panel.
- Category chips scroll horizontally with `overflow-x-auto`; the fade is decorative and `aria-hidden`.
- Every illustration (hero collage, receipt) is `aria-hidden` with an sr-only sentence; no interactive controls inside them.
- Hit areas stay at 44px (`tap` utility).
- Contrast: muted on cream is about 5.1:1, white/80 on brand about 10:1, brand-hover on lime about 14:1.

## 5. Tests to update

`components/home/home-hero.test.tsx` (the carousel assertions go away), `seller-pitch.test.tsx`, `trust-strip.test.tsx`, `state-explorer.test.tsx`, `buyer-steps` coverage, `components/catalog/product-card.test.tsx`, `shop-card.test.tsx`, and any home page test that asserts section order. Then `npm run lint`, `npm run typecheck`, `npm test`.

## 6. Open questions (ask Bear)

1. **The state counts.** The mockup labels them "4 productos" / "2 productos". Confirm what `getCatalogStateCounts` actually counts — products or shops — and fix the label before shipping.
2. **The hero's floating listing card.** Wire it to the newest product in the home catalogue (recommended), or keep it as a fixed illustration? If it's live, decide what happens when the catalogue is empty; the mockup hides it.
3. **The "Tu tienda podría estar aquí" card.** Keep it while the plaza has few shops, or leave the section with only the real shops?
4. **The two seller messages from the old hero carousel** ("Crea tu tienda y sube lo que quieras vender", "Construye tu reputación y vende a todo México") disappear with the carousel. Confirm that's fine — /vender and the launch bar now carry that pitch.
5. **Product photo ratio.** 4:5 suits the portrait photos in the catalogue today. If you expect mostly landscape photos later, say so and it stays 4:3.

## 7. Done when

- [ ] The page matches `mobile.html` at 390px and `desktop.html` at 1440px, with no horizontal scroll from 320px up.
- [ ] Only token utilities, no raw hex (§2).
- [ ] `/vender`, the header, the footer, the launch bar and the bottom nav are untouched.
- [ ] The §6 decisions are applied.
- [ ] Tests updated; lint, typecheck and tests pass.
- [ ] Screenshots of the home page at 390 and 1440 compared with `screens/`, and the differences listed.
