# Unified navigation: one main nav, a section bar on /vender

Date: 2026-10-06
Status: approved in chat, building

## Problem

The signed-out header swaps its whole link set on `/vender`
(`SELLER_VARIANT` in `signed-out-header-nav.tsx`). Same labels lead to
different places ("Explorar" is `/#explorar` on one page and `/explorar` on
the other; "Cómo funciona" is the landing's `#pasos` or /vender's), and the
pill changes label and destination. Underneath, the header is a table of
contents of whichever long page is open, not site navigation.

Audit findings it also fixes:

1. On `/explorar`, header "Explorar" leaves the catalogue for a landing section.
2. "Para vender" (`/#vender`, a landing section) and "Vender" (`/vender`, a page)
   are two seller destinations a visitor cannot tell apart.
3. The phone bar's "Explorar" opens `/`, the seller pitch, not the catalogue.
4. A phone on `/vender` shows "Ingresar" twice (header and bar).
5. `/como-comprar` has no nav link; only the landing's buyer panel reaches it.
6. The signed-in desktop header has no way to browse (no "Explorar").

## Design

Global nav (destinations, identical on every route) plus a local nav on
`/vender` (that page's sections, clearly scoped to it).

### Main header, signed out

- Links: Explorar → `/explorar` · Cómo comprar → `/como-comprar` ·
  Vender → `/vender?desde=header`. Shown inline from `lg`; the menu sheet
  below `lg`.
- The current destination carries `aria-current="page"` and a visible marker,
  matched on the path (so "Vender" lights up on `/vender`).
- Ingresar, then the pill "Crear mi tienda" → `/registro?vender=1&desde=header`
  on every page. The pill's label now matches its action; "Vender" is the
  read-first path #33 wanted the pill to be. Both from `sm`.
- Phone (< `sm`): brand and menu button only. The quick access bar already
  holds Explorar, Vender and Ingresar.
- Menu sheet: the three links, Ingresar, and the "Crear mi tienda" pill.
  Same on every route.
- `SELLER_VARIANT` and the per-route variant machinery are removed.

### Main header, signed in

- Adds "Explorar" → `/explorar` before "Mi panel", from `md` like its
  neighbours. The text links tighten to `px-3` at `md` (`lg:px-4` above) so
  the row still fits at 768px (measured: 33px to spare).
- Marks the current destination with `aria-current="page"`.

### Quick access bar (phone)

- "Explorar" → `/explorar` for both signed-in and signed-out visitors.

### Footer

- The "Plaza" column adds "Cómo comprar" → `/como-comprar`.

### /vender section bar (new, `components/sellers/seller-section-nav.tsx`)

- A `nav` named "Secciones de Vender", the first thing below the header,
  plum like the hero, `sticky top-0`.
- Links in page order: Fundadoras `#fundadoras` (only while the founders
  promotion is open), Beneficios `#beneficios`, Compara `#compara`,
  Catálogo `#catalogo`, Cómo empezar `#pasos`, Niveles `#niveles`,
  Preguntas `#preguntas`.
- From `lg` the bar names the page ("Vender en Plaza Volcanes") on the left.
  Below `lg` the links scroll sideways as one row (a visible row of options
  rather than the popover floated in chat: nothing is hidden behind a tap
  and there is no overlay to position under a sticky bar).
- Scroll-spy: the section crossing the middle of the viewport gets
  `aria-current="location"`, and the row scrolls it into view sideways only.
- While the bar is on the page, the main header gives up `sticky` (plain CSS
  `:has()` rule in `app/vender/vender.css`), so the header scrolls away and the
  section bar is the one fixed strip. The section bar sits below the launch
  bar's slot; the launch bar is already absent on `/vender`.
- Section anchors keep their `scroll-mt-20 lg:scroll-mt-24`: the bar is 48px,
  so headings land clear of it.

### Unchanged

- Landing sections and their in-page CTAs; launch bar; admin header links;
  `?desde=` tagging; `/` remains the seller-first landing for everyone (a
  separate decision).

## CSS budget

The section bar lives in `components/sellers`, which only `vender.css` scans,
so it adds nothing to the global stylesheet. Header and bar changes reuse
existing utilities where possible. After the build, `/` must still link one
stylesheet.

## Testing

- `site-header.test.tsx`: one link set on `/`, `/explorar` and `/vender`;
  pill always signup; current-page marking; signed-in "Explorar"; menu sheet
  contents; phone header without pill or Ingresar.
- `bottom-nav.test.tsx`: Explorar → `/explorar`.
- `site-footer.test.tsx`: Cómo comprar.
- `seller-section-nav.test.tsx`: links and order, founders link follows the
  promotion, scroll-spy marking.
- `seller-program.test.tsx`: the page renders the section bar.
- e2e `mobile-polish.spec.ts`: bar's Explorar href.
- Manual: 320 / 390 / 768 / 1024 / 1440 on `/`, `/explorar`, `/vender`;
  no horizontal overflow; header scrolls away on `/vender` only.
