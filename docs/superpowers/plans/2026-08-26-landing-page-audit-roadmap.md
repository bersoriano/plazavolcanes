# Landing Page Audit Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise landing page from audited 5.8/10 to launch-ready, buyer-first experience with credible inventory, compact-mobile support, decision-point trust evidence, clear conversion paths, and tested accessibility.

**Architecture:** Keep existing server-rendered catalog and current brand system. Fix responsive presentation at component layer, enrich catalog card data in existing server query, move long seller education to dedicated route, and enforce launch quality through unit tests, Playwright checks, and content-readiness gate. Never invent inventory or seller evidence.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript 5, Tailwind CSS 4.3.3, Supabase 2.112.3, Vitest 4.1.11, Testing Library 16.3.2, Playwright 1.62.1.

**Spec:** [Landing-page audit](../../../artifacts/landing-page-audit-2026-08-26/audit.md)

## Global Constraints

- Read relevant Next.js 16 guide under `node_modules/next/dist/docs/` before changing framework behavior.
- Preserve purple/lime brand, display typography, populated/filtered/cold-start branches, search telemetry, and locale/state query parameters.
- Spanish (`es-MX`) remains default UI language.
- Add no runtime dependency for this roadmap.
- Use test-first loop: failing focused test, smallest implementation, focused pass, then full gate.
- Run Vitest as `npx vitest run --exclude '.worktrees/**'`; hidden legal worktree otherwise duplicates tests.
- Run browser tests only through `npm run test:e2e`; script provisions expected local Supabase environment.
- Never fabricate products, ratings, order counts, response times, delivery methods, verification, or seller proof.
- Show only stored or platform-computed data. No data means omit signal, not synthetic fallback.
- Separate legal-content plan owns legal routes, footer legal links, and unsupported verification-badge removal. Rebase before footer work; do not reintroduce verification claims.
- Keep each task independently shippable. Stop task when listed acceptance checks pass.

## Audit-to-Work Map

| Priority | Work item | Audit problem | Done when |
|---|---|---|---|
| Complete | Buyer-first section order | Buyer journey buried below seller acquisition | Populated home follows hero → products → shops → state explorer → buyer steps → risk/dispute explanation → seller CTA |
| Complete | Plain payment/dispute explanation | Policy language overpromised protection | Trust strip states direct-payment risk and Plaza dispute limits plainly |
| P0 | Compact header | 320 px page overflows by 66 px; logout leaves viewport | Signed-in and signed-out headers fit 320 px and every icon-only control has accessible name |
| P0 | Mobile discovery controls | State filter disappears; category overflow unclear | One state selector works at every width; category row shows scroll affordance |
| P0 | Image resilience | Missing/broken images damage trust | Missing and failed catalog images render intentional fallback without layout shift |
| P0 | Marketplace content gate | Two products/two shops make page look like prototype | Launch data has 24–40 complete products, 8–12 shops, category/state variety, clean copy |
| P0 | Card decision evidence | Cards omit location and seller standing | Product/shop cards show only real location and computed tier; unsupported metrics stay hidden |
| P1 | Hero conversion | Promise vague; browse/sell actions weak | Populated hero explains what/where/how and offers browse + sell CTAs |
| P1 | Compact seller acquisition | Seller block dominates page length | Home seller CTA is concise; detailed steps/tiers live at `/vender` |
| P1 | Accessibility/responsive gate | Small targets, unnamed control, untested keyboard/zoom | Automated 320/390/1440 checks plus manual keyboard, zoom, contrast, and screen-reader checklist pass |
| P2 | Measured trust metrics | Ratings/orders/response proof absent | Batched, platform-computed metrics appear only after statistically useful data exists |

## Milestone 1 — Compact-Mobile Foundation (P0)

### Task 1: Make Header Fit 320 px

**Files:**

- Modify: `components/layout/site-header.tsx`
- Modify: `components/auth/sign-out-button.tsx`
- Create: `components/auth/sign-out-button.test.tsx`
- Create: `components/layout/site-header.test.tsx`

- [ ] **Step 1: Write logout accessible-name regression**

Render `SignOutButton`; assert `getByRole("button", { name: "Salir" })` succeeds even though visible label is hidden below `sm`.

```tsx
it("keeps an accessible name when compact label is hidden", () => {
  render(<SignOutButton />);
  expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused test and confirm failure**

Run: `npx vitest run components/auth/sign-out-button.test.tsx`

Expected: fails because button has no stable accessible name outside visible `sm` label.

- [ ] **Step 3: Give logout button stable name and 44 px target**

Add `aria-label="Salir"`; retain `min-h-11` and icon `aria-hidden="true"`.

- [ ] **Step 4: Write header structure regressions**

Mock auth/query modules for signed-in and signed-out states. Assert:

- Home link has name `Plaza Volcanes, inicio`.
- Signed-in compact actions expose `Mi panel`, `Mensajes`, and `Salir` names.
- Signed-out `Ingresar` remains named.
- Navigation contains no element requiring visible text to provide accessible name.

- [ ] **Step 5: Replace compact text row with icon treatment below 400 px**

Use existing logo mark alone under 400 px; retain full wordmark at 400 px and above. Give panel/messages compact icon links with explicit `aria-label`; reveal text at 400 px. Keep `Mis compras` at `sm` and above.

```tsx
<span className="hidden min-[400px]:inline">Plaza Volcanes</span>
<Link aria-label="Mi panel" className="grid min-h-11 min-w-11 place-items-center ..." href="/panel">
  <LayoutDashboard aria-hidden="true" className="size-5 min-[400px]:hidden" />
  <span className="hidden min-[400px]:inline">Mi panel</span>
</Link>
```

Use `gap-1`, `px-3`, and icon-sized controls below 400 px; restore existing spacing at `min-[400px]`/`sm`.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run components/auth/sign-out-button.test.tsx components/layout/site-header.test.tsx`

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add components/auth/sign-out-button.tsx components/auth/sign-out-button.test.tsx components/layout/site-header.tsx components/layout/site-header.test.tsx
git commit -m "fix: fit account header on compact screens"
```

### Task 2: Preserve Mobile State Filter and Show Category Overflow

**Files:**

- Modify: `components/catalog/search-bar.tsx`
- Modify: `components/catalog/category-navigation.tsx`
- Modify: `components/catalog/category-navigation.test.tsx`

- [ ] **Step 1: Add failing mobile-control semantics tests**

Assert one `Estado` combobox exists, remains outside `hidden` container, and keeps selected `estado` value. Assert category scroller has accessible description `Desliza para ver más categorías` and decorative edge fade is hidden from assistive technology.

- [ ] **Step 2: Run focused test and confirm failure**

Run: `npx vitest run components/catalog/category-navigation.test.tsx`

Expected: state control still has `hidden ... sm:flex`; scroll guidance absent.

- [ ] **Step 3: Reflow search form into two rows below `sm`**

Render one state `<select>` only. Form wraps on mobile; search input/button occupy first row; location control occupies full second row. At `sm`, return to single pill.

```tsx
<form className="flex flex-wrap items-center gap-2 rounded-[1.5rem] ... sm:flex-nowrap sm:rounded-full">
  {/* search icon, input, submit */}
  <div className="order-3 flex min-h-11 basis-full items-center gap-2 border-t border-line px-1 pt-2 text-brand sm:order-none sm:basis-auto sm:border-l sm:border-t-0 sm:pt-0">
    <MapPin aria-hidden="true" className="size-4" />
    <label className="sr-only" htmlFor="filtrar-estado">Estado</label>
    <select className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold sm:max-w-[10rem]" id="filtrar-estado" name="estado">
      {/* existing options */}
    </select>
  </div>
</form>
```

Do not render duplicate desktop/mobile selects: hidden form fields still submit.

- [ ] **Step 4: Add category scroll affordance**

Wrap each horizontal row in `relative`; add right edge fade with `pointer-events-none` and `aria-hidden="true"`. Add `pr-10` to scroller so last chip clears fade. Add visually hidden guidance linked with `aria-describedby`.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run components/catalog/category-navigation.test.tsx`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add components/catalog/search-bar.tsx components/catalog/category-navigation.tsx components/catalog/category-navigation.test.tsx
git commit -m "fix: preserve discovery controls on mobile"
```

### Task 3: Make Catalog Images Fail Gracefully

**Files:**

- Create: `components/catalog/catalog-image.tsx`
- Create: `components/catalog/catalog-image.test.tsx`
- Modify: `components/catalog/product-card.tsx`
- Modify: `components/catalog/shop-card.tsx`
- Modify: `components/catalog/product-card.test.tsx`
- Modify: `components/catalog/shop-card.test.tsx`

- [ ] **Step 1: Add failing image-error tests**

For product and shop cards, fire `error` on rendered image. Assert image disappears, intentional fallback appears, card link remains usable, and product fallback exposes no misleading image text.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx vitest run components/catalog/catalog-image.test.tsx components/catalog/product-card.test.tsx components/catalog/shop-card.test.tsx`

Expected: failed image remains rendered because current cards handle only null paths.

- [ ] **Step 3: Add reusable client image boundary**

```tsx
"use client";

import { useState, type ReactNode } from "react";

type CatalogImageProps = {
  alt: string;
  className: string;
  fallback: ReactNode;
  src: string | null;
};

export function CatalogImage({ alt, className, fallback, src }: CatalogImageProps) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return <img alt={alt} className={className} onError={() => setFailed(true)} src={src} />;
}
```

Keep existing raw image element: deployment Supabase hostname is runtime-configured. Preserve product alt as product name and decorative shop image alt as empty string.

- [ ] **Step 4: Replace duplicated image branches in both cards**

Keep aspect-ratio containers and existing neutral fallback background. Use `ImageIcon` for products and `Store` for shops.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run components/catalog/catalog-image.test.tsx components/catalog/product-card.test.tsx components/catalog/shop-card.test.tsx`

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add components/catalog/catalog-image.tsx components/catalog/catalog-image.test.tsx components/catalog/product-card.tsx components/catalog/shop-card.tsx components/catalog/product-card.test.tsx components/catalog/shop-card.test.tsx
git commit -m "fix: add resilient catalog image fallbacks"
```

## Milestone 2 — Credibility at Decision Points (P0)

### Task 4: Add Real Location and Tier Evidence to Cards

**Files:**

- Modify: `lib/queries/catalog.server.ts`
- Modify: `lib/queries/catalog.server.test.ts`
- Modify: `components/catalog/product-card.tsx`
- Modify: `components/catalog/product-card.test.tsx`
- Modify: `components/catalog/shop-card.tsx`
- Modify: `components/catalog/shop-card.test.tsx`
- Reuse: `components/shops/trust-tier-badge.tsx`
- Reuse: `lib/shop-location.ts`

- [ ] **Step 1: Add failing query mapping test**

Expected product shop shape:

```ts
shop: {
  name: string;
  slug: string;
  country_code: string;
  administrative_area_codes: string[];
  trust_tier: "standard" | "reliable" | "top_rated";
}
```

Assert `mapProduct` preserves these selected fields.

- [ ] **Step 2: Extend joined product selection**

Add `administrative_area_codes` and `trust_tier` to existing `shops!inner(...)` projection and `ProductQueryRow`. Update `CatalogProduct` type. Do not add per-card RPC calls.

- [ ] **Step 3: Add failing card evidence tests**

Product card must answer seller + location; shop card must show location + platform-computed tier. Assert a `standard` shop does not claim verification, rating, reviews, orders, response time, shipping, or pickup.

- [ ] **Step 4: Render evidence using existing formatters/components**

Product metadata order:

1. seller name,
2. formatted state/country location,
3. category,
4. product name,
5. price.

Shop card adds `TrustTierBadge` beside shop name. Preserve current description and location. Accessible text must not imply guarantee.

- [ ] **Step 5: Run query and card tests**

Run: `npx vitest run lib/queries/catalog.server.test.ts components/catalog/product-card.test.tsx components/catalog/shop-card.test.tsx`

Expected: pass.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0; fixtures updated for enriched shop shape.

- [ ] **Step 7: Commit**

```bash
git add lib/queries/catalog.server.ts lib/queries/catalog.server.test.ts components/catalog/product-card.tsx components/catalog/product-card.test.tsx components/catalog/shop-card.tsx components/catalog/shop-card.test.tsx
git commit -m "feat: surface seller evidence on catalog cards"
```

### Task 5: Pass Marketplace Content-Readiness Gate

**Files:**

- Review through existing admin/product/shop flows; no production seed committed.
- Record results in release checklist or deployment ticket used by project.

- [ ] **Step 1: Inventory content against launch minimum**

Required populated default-market state:

- 24–40 published products.
- 8–12 public shops.
- At least 4 populated root categories.
- At least 3 represented Mexican states.
- Every published product has loadable primary image, production-ready title, price, condition, seller, and location.
- No repeated image used as unrelated product primary image.

- [ ] **Step 2: Quarantine incomplete listings**

Move incomplete listings from `published` to draft through existing product workflow. Do not delete source data.

- [ ] **Step 3: Edit visible copy**

Normalize spelling, accents, title casing, seller biographies, condition descriptions, and location names. Keep factual meaning.

- [ ] **Step 4: Review visual mix**

At 1440 px and 390 px, confirm first catalog rows contain useful category/shop variety rather than repeated seller or image clusters.

- [ ] **Step 5: Record gate result**

Capture counts, failed listing IDs, owner for each correction, and date checked. Landing is not launch-ready until all required counts and completeness checks pass.

No code commit required unless content tooling defect is found; plan that defect separately before editing.

## Milestone 3 — Proposition and Page Length (P1)

### Task 6: Sharpen Populated Hero and Conversion Paths

**Files:**

- Modify: `components/catalog/catalog-screen.tsx`
- Modify: `app/page.test.tsx`

- [ ] **Step 1: Add failing populated-hero test**

For populated, unfiltered home assert:

- Heading: `Encuentra productos únicos cerca de ti.`
- Supporting copy explains independent stores and direct payment/delivery agreement.
- Link `Explorar productos` points to `#catalogo`.
- Link `Abrir mi tienda` points to `/registro`.
- Cold-start and state-specific headings/actions remain unchanged.

- [ ] **Step 2: Run focused test and confirm failure**

Run: `npx vitest run app/page.test.tsx`

- [ ] **Step 3: Implement populated-only hero copy and CTAs**

Use:

```text
Encuentra productos únicos cerca de ti.
Explora artículos nuevos y usados, revisa quién vende y acuerda pago y entrega directamente con cada tienda.
```

Place primary `Explorar productos` and secondary `Abrir mi tienda` buttons above search on populated default home. Preserve search as strongest utility control and keep existing area/cold-start branches.

- [ ] **Step 4: Run page tests**

Run: `npx vitest run app/page.test.tsx`

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add components/catalog/catalog-screen.tsx app/page.test.tsx
git commit -m "feat: clarify landing hero conversion paths"
```

### Task 7: Move Seller Detail Off Home

**Files:**

- Modify: `components/home/seller-pitch.tsx`
- Create: `components/home/seller-pitch.test.tsx`
- Create: `components/sellers/seller-program.tsx`
- Create: `components/sellers/seller-program.test.tsx`
- Create: `app/vender/page.tsx`
- Create: `app/vender/page.test.tsx`
- Modify: `app/page.test.tsx`

- [ ] **Step 1: Add failing home compaction test**

Assert home seller region contains concise title/body, `Abrir mi tienda`, and `Conoce cómo funciona`; it must not contain three step cards or tier matrix.

- [ ] **Step 2: Add failing dedicated-page test**

Assert `/vender` contains:

- Existing three seller steps.
- Existing standard/reliable/top-rated tier explanations.
- Direct-payment statement consistent with trust strip.
- Primary `/registro` CTA and `/ingresar` secondary action.

- [ ] **Step 3: Extract detailed seller content**

Move current step/tier arrays and full layout into `SellerProgram`. Keep all tier data sourced through `getTrustTierMarker`; increase current 12 px low-opacity tier text to at least 14 px and stronger contrast.

- [ ] **Step 4: Reduce home seller pitch**

Keep one short brand panel, one paragraph, and two CTAs. Target less than half current vertical height on desktop/mobile. Link details to `/vender`.

- [ ] **Step 5: Create seller route metadata**

Use server page with static metadata describing store setup and direct-sale model. No new data fetch.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run components/home/seller-pitch.test.tsx components/sellers/seller-program.test.tsx app/vender/page.test.tsx app/page.test.tsx`

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add components/home/seller-pitch.tsx components/home/seller-pitch.test.tsx components/sellers/seller-program.tsx components/sellers/seller-program.test.tsx app/vender/page.tsx app/vender/page.test.tsx app/page.test.tsx
git commit -m "feat: move seller education to dedicated page"
```

## Milestone 4 — Accessibility and Release Proof (P1)

### Task 8: Add Responsive and Accessibility Regression Gate

**Files:**

- Modify: `components/layout/site-footer.tsx`
- Create: `tests/e2e/landing-page.spec.ts`
- Modify: `playwright.config.ts` only if current configuration cannot run required viewports inside one spec.

- [ ] **Step 1: Rebase/merge legal-content work before footer edit**

Confirm legal route/link changes are present. Preserve them. Only adjust target sizing/focus styles in this task.

- [ ] **Step 2: Add failing footer target test**

Give every footer navigation link at least 44 px interactive height using `inline-flex min-h-11 items-center`. Keep visible density through horizontal padding/line height, not undersized targets.

- [ ] **Step 3: Add responsive Playwright matrix**

Test widths 320, 390, and 1440. At each width:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
  await page.evaluate(() => window.innerWidth),
);
```

Also assert:

- Header home/account/logout controls have names.
- State combobox is visible and selectable at 320/390.
- Search submission preserves selected state.
- Category row is horizontally scrollable when content exceeds width, without increasing document width.
- `Explorar productos` moves focus/viewport to `#catalogo`.
- Footer links have bounding-box height at least 44 px.
- Broken image event leaves intentional fallback and no page error.

- [ ] **Step 4: Add keyboard flow test**

Use `page.keyboard.press("Tab")`; verify visible focus moves through header, hero CTAs, search input, state filter, search submit, and first category in DOM order. Assert focus indicator is not clipped at 320 px.

- [ ] **Step 5: Run browser gate**

Run: `npm run test:e2e -- tests/e2e/landing-page.spec.ts`

Expected: all viewport and keyboard checks pass.

- [ ] **Step 6: Perform manual accessibility checks**

Record results for:

- Browser zoom at 200% on 1280 px window: no lost content or two-axis scrolling.
- VoiceOver: landmark order, search/filter names, account actions, card image alternatives, risk/dispute section.
- Reduced motion: no meaning depends on animation; hover transforms do not block use.
- Contrast: body/small text, focus rings, lime-on-purple, muted text on surface.
- Touch: all persistent header/footer controls at least 44 × 44 CSS px.

- [ ] **Step 7: Commit**

```bash
git add components/layout/site-footer.tsx tests/e2e/landing-page.spec.ts playwright.config.ts
git commit -m "test: gate landing responsive accessibility"
```

### Task 9: Run Full Release Gate and Re-Audit

**Files:**

- Update: `artifacts/landing-page-audit-2026-08-26/audit.md` with dated follow-up section or create new dated audit folder if screenshots change materially.

- [ ] **Step 1: Run static and unit gates**

```bash
npm run typecheck
npm run lint
npx vitest run --exclude '.worktrees/**'
```

Expected: all exit 0.

- [ ] **Step 2: Run full browser suite**

Run: `npm run test:e2e`

Expected: exit 0.

- [ ] **Step 3: Capture comparison screenshots**

Capture populated home at 320, 390, and 1440 px plus filtered search state. Use same viewport widths and comparable data as original audit.

- [ ] **Step 4: Re-score audit**

Target:

- No score below 7/10.
- Mobile responsiveness at least 8/10.
- Buyer conversion at least 8/10.
- Overall at least 8/10.
- Content-readiness gate complete.
- No unsupported protection or verification claim.

- [ ] **Step 5: Commit audit evidence**

```bash
git add artifacts/landing-page-audit-2026-08-26
git commit -m "docs: record landing page follow-up audit"
```

## Deferred P2 — Measured Metrics After Data Maturity

Create separate Supabase implementation plan only when enough real transactions exist. Scope: batched public trust metrics for visible shop IDs, no N+1 RPC calls, minimum sample thresholds, no-data omission, and legal/product review of labels. Candidate signals: rating with review count, completed-order count, response-time band, fulfillment rate. Do not start from current sparse development data.

## Plan Self-Review

- [ ] Every remaining audit finding maps to work item or explicit deferred dependency.
- [ ] Completed reorder and payment/dispute-copy work remain unchanged.
- [ ] Every code task starts with observable failing test.
- [ ] Query/type/fixture changes stay consistent.
- [ ] Legal-content ownership respected; no unsupported verification claim returns.
- [ ] No invented inventory, seller evidence, or production metric.
- [ ] Full gate includes compact mobile, keyboard, zoom, and screen-reader checks.
- [ ] Scope ends after follow-up audit; unrelated marketplace features excluded.
