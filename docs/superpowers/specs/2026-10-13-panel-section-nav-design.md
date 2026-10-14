# Panel section navigation: one bar for /panel

Date: 2026-10-13
Status: approved in chat, building

## Problem

`app/panel/layout.tsx` only checks the session; it draws no navigation. Each
page under `/panel` carries its own, so the section has no single place to move
from:

1. Every move between areas goes through `/panel`. From a shop's catalogue to
   the account page is two steps, and the account page is linked from the
   dashboard only.
2. The same page has several names: the links back to `/panel` read "Panel"
   (orders), "Mi panel" (account) and "Mis tiendas" (new shop, shop workspace),
   and the page they open is titled "Panel de ventas".
3. Nothing says which area of the panel the reader is in.
4. The shops are listed at the foot of the dashboard and have no page of their
   own; `/panel/tiendas` does not exist.
5. The dashboard's own links repeat "Mensajes", which the header and the phone's
   quick access bar already carry on every page, with the unread count.
6. The link back is written out by hand in seven files, in two styles.

## Design

One bar, drawn by the panel's layout, holds the panel's areas. Pages keep only
the link to their real parent.

### Section bar (new, `components/layout/panel-nav.tsx`)

- A `nav` named "Secciones del panel", the first thing below the header on
  every `/panel` route, including the loading and error states. Not sticky: the
  header already is, and one fixed strip is enough.
- Links, in order: Resumen → `/panel` · Pedidos → `/panel/pedidos` ·
  Tiendas → `/panel/tiendas` · Cuenta → `/panel/cuenta`.
- The bar is a white band with a rule under it, inside the same content box as
  the header, so it reads as part of the frame. It is neither the underlined
  tabs of a shop's workspace nor the pills of the catalogue filters, which it
  sits above.
- The area being read carries `aria-current="page"` and a filled marker:
  - Resumen: `/panel` exactly. A prefix match would mark it on every route.
  - Pedidos: `/panel/pedidos` and below.
  - Tiendas: `/panel/tiendas` and below, and `/panel/productos` and below (a
    product's editor lives outside its shop's path).
  - Cuenta: `/panel/cuenta` and below.
- A layout does not render again on navigation, so the links are fixed and the
  marker is decided in a Client Component with `usePathname`. The layout reads
  nothing for the bar.
- On a phone the links are one row that scrolls sideways if it has to, as on
  `/vender`. Each link is at least 44px high and wide.
- "Mensajes" is not in the bar: it is a destination of the whole site and stays
  in the header and the quick access bar.

### `/panel/tiendas` (new)

"Tiendas" needs somewhere to go, and most sellers have one shop and a limit of
one.

- One shop and no room for another: redirect to that shop's catalogue,
  `/panel/tiendas/{id}`. A list of one with nothing else to do is a wasted tap.
- Otherwise: the list of shops, using `ShopOverview` with its title as the
  page's `h1`. It already shows the "Crear tienda" button and the limit notice.
- No shops and room to create one: an empty state with "Crear tienda" →
  `/panel/tiendas/nueva`.
- The read failed: the same kind of message the dashboard shows, with a retry.
- Data: `getSellerShops()` in `lib/queries/shops.server.ts` reads the caller's
  shops and shop limit, then the published listings of those shops to count the
  quota. `ShopOverview` narrows its `shops` prop to the fields it draws, so the
  dashboard's richer rows and this page's lighter ones both fit.
- The dashboard keeps its "Mis tiendas" section as it is.

### Pages keep only the link to their parent

- Dashboard: the "Accesos del panel" links (Mensajes, Pedidos, Mi cuenta) go.
- Orders list, account, new shop: the link back to `/panel` goes.
- Shop workspace header: "Mis tiendas" and "Pedidos" go. "Ver tienda pública"
  moves beside the shop's name. The Catálogo / Ajustes tabs stay.
- Order detail keeps "Pedidos" → `/panel/pedidos`; new product and product
  editor keep the shop's name → `/panel/tiendas/{id}`. These three use one
  `BackLink` (`components/layout/back-link.tsx`).

### Unchanged

- The header, the quick access bar and their labels; the panel's session check
  and presence ping; every URL that exists today; the dashboard's content below
  its title; links inside the action queue and the first-sale guide.

## CSS budget

The bar and the back link live in `components/layout`, which the global
stylesheet scans. They reuse utilities already in it where possible. After the
build, `/` must still link one stylesheet.

## Testing

- `panel-nav.test.tsx`: the four links in order; the marker on `/panel`, an
  order, a shop, a product editor and the account page; Resumen unmarked below
  `/panel`.
- `app/panel/layout.test.tsx`: the bar is drawn for a signed-in visitor and not
  on the "configure Supabase" screen.
- `shops.server.test.ts`: `getSellerShops` pins both reads to the owner's shops,
  counts published listings per shop, reports a failed listing read without
  failing the page, and reads nothing signed out.
- `app/panel/tiendas/page.test.tsx`: redirect with one shop at the limit; list
  with several; list with one and room for more; empty state; limit notice;
  error.
- `shop-workspace-header.test.tsx`: no link to `/panel` or orders; the public
  shop link and the tabs remain.
- `app/panel/page.test.tsx`: no "Accesos del panel"; catalogue, settings and
  public shop still linked.
- Orders, account and new shop pages: no link to `/panel` in the page itself.
- e2e `panel-navigation.spec.ts`: a seller with one shop walks the bar and the
  marker follows; "Tiendas" lands in the catalogue, and in the list once a
  second shop is allowed; no sideways page scroll at 320px.
  `mobile-polish.spec.ts` sweeps `/panel/pedidos` as well (`/panel/tiendas`
  redirects to the shop it already sweeps).
- Manual: 320 / 390 / 768 / 1280 on the dashboard, a shop and an order; no
  sideways page scroll.
