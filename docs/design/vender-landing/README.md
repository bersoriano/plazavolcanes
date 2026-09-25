# /vender — seller landing redesign (design handoff)

**Status:** ready to implement. Resolve the open questions in §8 first.
**Design source:** Claude Design canvas "Plaza Volcanes · Vendedores" (private to Bear): https://claude.ai/artifact/4BmrW3KL7UEWQcV7EtccVj
**Exported:** 2026-09-21

## 1. Goal

`/vender` becomes a page with one job: getting small sellers to open a store. The page carries three messages:

1. **Sin retenciones ni comisiones**
2. **Transfiere tu reputación de otras plataformas**
3. **Maneja tu catálogo de productos aquí**

Every button on the page leads to the same action: **"Crear mi tienda gratis" → `/registro?vender=1`**.

## 2. What's in this folder

| File | Use it for |
| --- | --- |
| `desktop.html` | The reference markup at 1440px. Exact copy, spacing, sizes, colors and structure. Open it in a browser. |
| `mobile.html` | The reference markup at 390px. The phone layout is a design in its own right, not just the desktop layout squeezed. |
| `screens/desktop-*.png` | Section screenshots at 1440px (1x), plus `desktop-full.png`. |
| `screens/mobile-*.png` | Section screenshots at 390px (2x). Tall sections are split into `-a`, `-b`, and so on. `mobile-full.png` is a 1x overview. |
| `PROMPT.md` | The prompt to paste into Claude Code. |

The reference HTML uses inline styles and raw hex values on purpose, so the values are unambiguous. **Don't copy it verbatim.** Translate it into Tailwind utilities with the existing tokens (§4). Attributes in the mockup:

- `data-component="…"` names the React component each section becomes.
- `data-bind="…"` marks live values. The mockup shows sample numbers; the real ones come from the database.

## 3. Where it goes in the codebase

- **Route:** `app/vender/page.tsx` keeps rendering `<SellerProgram />`. Its metadata can stay.
- **Components:** replace the body of `components/sellers/seller-program.tsx`, so that `SellerProgram` composes the new sections. Suggested files, all in `components/sellers/`:

  | File | Component |
  | --- | --- |
  | `seller-hero.tsx` | `SellerHero` |
  | `seller-benefits.tsx` | `SellerBenefits` (with a `ReputationFlow` and a `CatalogPreview` illustration) |
  | `seller-steps.tsx` | `SellerSteps` |
  | `seller-faq.tsx` | `SellerFaq` |
  | `founders-cta.tsx` | `FoundersCta` |

- **Global chrome stays as it is.** `SiteHeader`, `SiteFooter` and `BottomNav` render from `app/layout.tsx`. The mockup leaves them out on purpose.
- **Data:** add a count query for the founders counter (§7).
- **Tests:**
  - Update `app/vender/page.test.tsx` and `components/sellers/seller-program.test.tsx`. They currently assert the old headings ("Vende en Plaza Volcanes", "Recibe solicitudes", "Mejor valorada").
  - Keep asserting both CTA hrefs.
- **Repo rules:** follow `AGENTS.md`, meaning branch check, conventional commits, and the Next 16 docs in `node_modules/next/dist/docs/` before using any caching or data API.

## 4. Tokens: mockup value → existing utility

| Mockup | Use | Notes |
| --- | --- | --- |
| `#32174d` | `bg-brand` / `text-brand` | Hero, card 01, founders panel, step icons |
| `#241035` | `text-brand-hover` / `bg-brand-hover` | Ink on lime |
| `#b8ff6a` | `bg-accent` / `text-accent` | Primary CTA on dark, card 03, italic highlights on dark |
| `#fbf8f4` | `bg-background` | Page ground, inner panels |
| `#ffffff` | `bg-surface` | Cards on cream |
| `#19171b` | `text-ink` | Body headings on light |
| `#6d6871` | `text-muted` | Secondary text on light (about 5.1:1 on background) |
| `#ded8d2` | `border-line` | Borders, dividers |
| `#eee8e1` | `bg-photo-backdrop` | Product thumbnail placeholders |
| `#19734c` | `text-success` / `bg-success` | `$0.00` lines, "on" switch |
| `#e4ffc4` | `bg-trust-tier-fill` (= accent 40%) | Check badge in the receipt |
| `#3a2a4a` | `text-brand-hover/85` | Body text on lime |
| `#efe9e2`, `#f1ece6`, `#ede7e0` | `border-line/60` | Hairlines inside illustrations |
| `#f3eee7` | `bg-photo-backdrop/60` | Inactive tab chips |
| `#9a929f` | `text-muted/70` | Placeholder image icon |
| `#cfc8c1` | `bg-line` | "Off" switch track |
| `rgba(255,255,255,.x)` | `text-white/80`, `border-white/15`, `bg-white/5` … | Same pattern as today's seller pitch |

- **Fonts:**
  - `font-display` is Bricolage Grotesque, used for headings, prices and big numbers.
  - The default `font-sans` is Instrument Sans.
  - Italic highlights are `<em className="italic …">`. Bricolage has no italic, so the browser slants it, exactly as on the home hero today.
- **Radii:** 32px → `rounded-[2rem]`; 28px → `rounded-[1.75rem]`; 24px → `rounded-[1.5rem]`; 20px → `rounded-[1.25rem]`; pills → `rounded-full`.
- **Layout:** the desktop content width is 1200px (`mx-auto max-w-[1200px]`). Horizontal padding is 20px on phones (`px-5`) and 32px at sm (`sm:px-8`). Sections use 120–128px vertical padding on desktop and 64px on phones.
- **Type scale (desktop → phone):**

  | Element | Desktop | Phone |
  | --- | --- | --- |
  | h1 | 84px | 46px |
  | Section h2 | 60px | 38px |
  | Card h3 | 34–42px | 28–30px |
  | Body | 17–20px | 15–17px |
  | Eyebrows | 13px, `uppercase`, `tracking-[0.18em]` | 12px, `uppercase`, `tracking-[0.18em]` |

  Display weight is 500 for h1/h2 and 600 for h3. Letter-spacing is −0.03em to −0.035em on the big headings.
- Raw hex is acceptable only inside the purely decorative SVG (the connector lines), and even there `currentColor` is preferred.

## 5. Icons: `lucide-react` (already a dependency)

| Mockup glyph | Icon |
| --- | --- |
| Arrow in CTAs | `ArrowRight` |
| Check bullets and chips | `Check` |
| Shield with check | `ShieldCheck` |
| Info in the fine print | `Info` |
| Storefront | `Store` |
| Box (step 3) | `Package` |
| Image placeholder | `ImageIcon` |
| Search | `Search` |
| Plus | `Plus` |
| Stars | `Star` (filled with `fill="currentColor"`) |

The big volcano line is **`components/brand/volcano-mark.tsx`**. At very large sizes its fixed `strokeWidth="13"` scales up and becomes too heavy, so add an optional `strokeWidth` prop (default 13). The mockup uses about 3–4 on the hero and 4–6 on the cards.

## 6. Section specs

Breakpoints: build mobile-first. The mobile layout below `lg`, the desktop layout from `lg` (1024px) up. At `md`, keep things single-column unless it clearly fits.

### 6.1 SellerHero — `data-component="SellerHero"`

- **Container:** `bg-brand text-white`, `overflow-hidden`, `relative`.
- **Decorations** (all `aria-hidden`, `pointer-events-none`):
  - A lime radial glow in the top-right (`radial-gradient(closest-side, accent/20%, transparent)`).
  - A large `VolcanoMark` along the bottom at about 10% opacity in `text-accent`.
  - Optional: a grain overlay (SVG `feTurbulence`, 16%, `mix-blend-mode: overlay`). Drop it if it costs performance.
- **Layout at lg:** a 12-column grid. Copy spans 7 columns, the illustration spans 5. Below lg it's one column, with the illustration after the checklist.
- **Content, top to bottom:**
  - **Pill:** `Lanzamiento · Quedan {spotsLeft} de 100 lugares`. If the count is unavailable, show `Lanzamiento · Primeras 100 tiendas` (§7).
  - **The page's only `<h1>`:** `Abre tu tienda gratis y quédate con <em>cada peso.</em>`. The `em` is italic `text-accent`. Use `id="vender-heading"` and label the section with it.
  - **Lede:** the paragraph from the HTML, at 80% white.
  - **Primary CTA:** a 60px tall `bg-accent text-brand-hover` pill with `ArrowRight`, pointing to `/registro?vender=1`.
  - **Secondary link:** "Ver cómo funciona" → `#como-empezar` (underline in accent).
  - **Checklist:** three items separated by a top hairline.
- **Illustration (decorative):**
  - A receipt card (white, `-rotate-2`) with a reputation card (accent, `rotate-4`) overlapping its top-right corner. Exact offsets are in the HTML.
  - Wrap the illustration in `aria-hidden="true"` and add one sr-only sentence: "Ejemplo: vendes un artículo en $1,999.00 y recibes $1,999.00; Plaza Volcanes no cobra comisión ni retiene tu pago."
  - Use `tabular-nums` for money.

### 6.2 SellerBenefits — `id="beneficios"`

- **Header:** eyebrow plus h2 `Hecho para quien vende <em>por su cuenta.</em>`, with the intro paragraph on the right at lg (a 7/5 grid).
- **Bento at lg:** a 12-column grid with `gap-6`.
  - **Card 01** (`col-span-5`, `bg-brand`): a giant `0%` (display, 220px desktop / 148px phone, weight 700, `text-accent`), the h3 "Sin retenciones ni comisiones", body text, and the fine print with `Info`.
  - **Card 02** (`col-span-7`, `bg-surface border-line`): the h3 "Transfiere tu reputación de otras plataformas", body text, and the `ReputationFlow` diagram.
    - At lg: a column of five platform chips on the left, dashed SVG connectors, and a "Tu tienda" card on the right. The positions are in `desktop.html`, inside a 608×300 box.
    - Below lg: the chips wrap and center, then a dashed down arrow, then the store card.
    - The platform names are **text chips only. Never use platform logos.**
  - **Card 03** (`col-span-12`, `bg-accent text-brand-hover`): an inner 5/7 grid with copy and a checklist on the left and `CatalogPreview` on the right. On phones the preview becomes a simple list: thumbnail, name, price and state, plus a switch.
- **Below lg:** the cards stack full-width with `gap-4`.
- **CatalogPreview is an illustration, not a working UI.**
  - Render the switches and tabs as non-interactive elements (no `<button>`), and mark the whole preview `aria-hidden` with an sr-only summary.
  - States must match the product: **Publicado / Borrador only** (`products.status` is `draft | published | expired | deleted`).
  - The example products are real listings from the site, hardcoded as illustration.

### 6.3 SellerSteps — `id="como-empezar"`

- **Layout at lg:** a header row with the h2 on the left and a `bg-brand` CTA on the right. Below it, three cards (`bg-background border-line/60 rounded-[1.75rem] p-8`) in a three-column grid.
- **Phones:** a vertical list. Each 52px icon tile is joined to the next by a dashed vertical line. The full-width CTA comes last.
- The steps are an `<ol>`. Keep the "PASO n" label.

### 6.4 SellerFaq — `id="preguntas"`

- **Layout at lg:** a 4/7 grid (the list starts at column 6). The h2 and the terms link are on the left, four Q&As on the right.
- All answers are visible. It's a static list with `h3` + `p` and `border-line` dividers. No accordion is needed for four items.
- The terms link goes to `/terminos-vendedores`.
- **Answer 4 is a placeholder until §8.3 is settled.**

### 6.5 FoundersCta

- A `bg-brand rounded-[2.25rem]` panel with a glow and `VolcanoMark`. Copy is on the left; a glassy progress card (`bg-white/5 border-white/15`) is on the right.
- **Progress card:**
  - `{spotsTaken}/100`
  - a bar (`bg-white/15` track, `bg-accent` fill, width = `spotsTaken`%, minimum 2% so it stays visible)
  - `Quedan {spotsLeft} lugares para tiendas fundadoras.`
  - the full-width accent CTA
  - "¿Ya tienes cuenta? Ingresa" → `/ingresar?intent=vender`. This is today's "Ya tengo cuenta" path, kept.
- The bar needs `role="progressbar"` with `aria-valuemin=0 aria-valuemax=100 aria-valuenow={spotsTaken}` and an accessible label.

## 7. Data, links and behavior

**Founders counter**

- Add a `FOUNDERS_CAP = 100` constant (e.g. in `lib/launch.ts`).
- Add a server query that counts the qualifying shops, following the existing pattern in `lib/queries/sitemap.server.ts`: `.select("id", { count: "exact", head: true })`. It must respect RLS.
- Which shops qualify and in what date window is **§8.2**.
- Cache it with the Next 16 mechanism from the bundled docs; it doesn't need to be real-time.
- **Never show a made-up number.**
  - If the query fails or returns `null`: the hero pill falls back to "Primeras 100 tiendas", and the progress card hides the number and bar but keeps the CTA.
  - If the cap is reached: this is a product decision (§8.2), so don't guess.

**Links**

| Link | Destination |
| --- | --- |
| Every "Crear mi tienda gratis" | `/registro?vender=1` |
| Returning sellers | `/ingresar?intent=vender` |
| Terms | `/terminos-vendedores` |
| In-page link | `#como-empezar` (smooth scroll is already global) |

**Accessibility**

- Exactly one `h1`, and a labelled section for each region.
- Decorative SVGs are `aria-hidden`.
- Focus rings come from `globals.css` already.
- Use the `tap` utility for 44px hit areas on small links.
- Contrast in the design holds: white/80 on brand is about 10:1, muted on background about 5.1:1, brand-hover on accent about 14:1.

**Other**

- **Images:** none required. The product thumbnails are placeholder tiles by design.
- **Motion:** none required.

## 8. Open questions (ask Bear before shipping)

1. **Reputation import doesn't exist in the codebase yet.** There's no import from Mercado Libre, Facebook Marketplace, Amazon, Etsy or Instagram. The options are:
   - (a) build the feature first;
   - (b) ship with an honest "Próximamente": a pill on card 02, "(pronto)" on the hero checklist item, the hero reputation card hidden, and step 2 swapped for the current copy "Publica tus productos — Foto, precio, categoría y condición. Guarda borradores y publica cuando quieras.";
   - (c) ship as designed. This is not recommended, because it promises something the product can't do.

   If you build (b), drive it from one constant, `REPUTATION_IMPORT_AVAILABLE`.
2. **The founders counter:**
   - Which shops count: every created shop, or only `is_publishing_approved`?
   - When did the launch window ("primeros tres meses") start?
   - What should the page say once the 100 spots are gone?
3. **What happens after the promo.** Today's `/vender` copy says: "La publicación y la comisión por artículo vendido seguirán siendo gratuitas." Confirm this, then write FAQ answer 4. Also note that `docs/legal/launch-state.json` marks the seller terms as unpublished (pre-launch).
4. **The trust-tier block.** The current page's "Cuanto mejor atiendes, más publicas" block (Estándar 15 / Confiable 40 / Mejor valorada 100 publications, from `getTrustTierMarker`) isn't in the new design. The recommendation is to keep it, restyled like the step cards, between Steps and FAQ, because sellers need to know their listing limit.
5. **Entry points: decided (2026-09-21).** Changing the header and footer is approved. The full routing plan is in `PROMPT-entry-points.md`, and it's done as a follow-up after the page itself.

## 9. Changes made vs. the canvas during export

- Removed the page-level header and footer, because the global ones render.
- Catalog preview: the tabs are now Todos / Publicados / Borradores. "Pausado" became "Borrador", and the bullet "Publica o pausa cuando quieras" became "Guarda borradores y publica cuando quieras", matching the real product states.
- Removed the "Nivel Estándar" pill from the store card, because the product deliberately never shows Estándar to buyers (see `components/shops/reputation-badge.tsx`).
- Added "¿Ya tienes cuenta? Ingresa" under the founders CTA, to keep the existing sign-in path.
- Filled in the real routes and anchors.

## 10. Done when

- [ ] It matches `mobile.html` at 390px and `desktop.html` at 1440px. There's no horizontal scroll anywhere from 320px to 1440px.
- [ ] Components use token utilities, not raw hex (§4).
- [ ] The founders counter reads real data and hides itself when the data is missing.
- [ ] The §8 decisions are applied.
- [ ] The tests are updated, and `npm run lint`, `npm run typecheck` and `npm test` all pass.
- [ ] The page has been screenshotted with Playwright at 390 and 1440, compared with `screens/`, and any differences are listed.
