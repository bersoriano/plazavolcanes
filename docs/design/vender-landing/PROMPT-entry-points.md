Update how visitors get from the home page to /vender (the seller landing). Changes to the header and footer are approved. This overrides README §8.5 in docs/design/vender-landing/.

Context: build this on top of the /vender redesign. It reuses FOUNDERS_CAP, the founders-count query and REPUTATION_IMPORT_AVAILABLE from that work. If any of those don't exist yet, stop and tell me.

Routing rule:
- Curious intent goes to /vender, where the offer is explained.
- Ready intent (a button that says "Crear mi tienda…") goes to /registro?vender=1.
- Stop using /registro?paso=vender for seller entry points, but keep that onboarding step itself working.

Changes:

1. SiteHeader: change "Publica tu tienda" to the label "Vender" with href "/vender?desde=header". Keep its current visibility (hidden below sm, because the bottom nav covers phones).

2. SiteFooter: change "Crear tienda" to the label "Vender" with href "/vender?desde=footer".

3. BottomNav (signed out): point "Vender" to "/vender?desde=nav". The active state must still work on /vender.

4. HomeHero: change the secondary button "Crear mi tienda gratis" to the label "Quiero vender" with href "/vender?desde=hero". The primary "Explorar productos" stays as it is.

5. CatalogScreen: in the empty-catalog state (coldStart), change the button "Crear mi tienda" to the label "Quiero vender" with href "/vender?desde=vacio".

6. SellerPitch:
   - In the normal home layout, move it up to right after the catalog section ("Descubrimientos de la plaza") and before the shops section. Keep the coldStart order as it is.
   - Under its paragraph, add three short chips in the style of the /vender hero checklist (an accent check icon plus text): "Sin retenciones ni comisiones", "Transfiere tu reputación", "Tu catálogo en un solo lugar". When REPUTATION_IMPORT_AVAILABLE is false, the second chip reads "Transfiere tu reputación (pronto)".
   - Buttons: "Crear mi tienda gratis" keeps /registro?vender=1. "Conoce cómo funciona" goes to /vender?desde=pitch.

7. Add a new LaunchBar, rendered above SiteHeader in app/layout.tsx.
   - Copy on desktop: "0% comisión para las primeras 100 tiendas · Quedan {spotsLeft} lugares", plus a link "Vender →" to /vender?desde=barra.
   - Copy on phones: the shorter "0% comisión · primeras 100 tiendas", plus "Vender →".
   - The bar is always a single line and never wraps.
   - If the founders count is unavailable, drop the "Quedan …" part. Never show a hardcoded number.
   - Hide the bar:
     - on /vender;
     - on /registro, /ingresar and the other auth routes;
     - on /panel and /admin;
     - for signed-in users who already own a shop;
     - once the cap is reached;
     - after the visitor dismisses it.
   - Dismiss control: a close button with a 44px hit area and aria-label "Cerrar aviso". Remember the dismissal in a cookie for 30 days, and read that cookie on the server so the bar never flashes in and out.
   - Rendering: SiteHeader already reads the session. Check whether the layout is already rendered dynamically. Don't make static pages dynamic just for this bar; if it would, explain the trade-off to me first.
   - Style: bg-brand with text-white and text-sm. Put the number and the link in text-accent. Make it about 40px tall, with the same horizontal padding as the header, and respect the top safe area on iOS.
   - Markup: wrap it in <aside aria-label="Promoción de lanzamiento">.

8. /vender metadata: add alternates.canonical "/vender", so the ?desde= variants don't split SEO. Apart from that, /vender ignores ?desde=.

9. Product page (app/productos/[slug]): below the shop info, add one quiet line: "¿Tienes uno igual? Véndelo en la plaza", linking to /vender?desde=producto. Show it to signed-out visitors and to buyers without a shop. Style it as a text link, not a button.

Before coding:
- Read AGENTS.md for the branch rules, and the Next 16 docs in node_modules/next/dist/docs on cookies and caching.
- Check how SiteHeader gets the current user and whether that user owns a shop.
- Check whether the project already has an analytics or event helper (e.g. app/api/search-events) that should also record the ?desde= source.
- Then propose a short plan and wait for my OK.

Done when:
- Every seller entry point follows the routing rule, and a grep finds no "/registro?paso=vender" in seller CTAs.
- Tests are updated or added for SiteHeader, SiteFooter, BottomNav, HomeHero, SellerPitch, CatalogScreen, LaunchBar (its visibility rules and dismissal) and the /vender metadata.
- npm run lint, npm run typecheck and npm test all pass.
- The work is in small conventional commits, one per change area.
- You've taken screenshots of the home page at 390 and 1440, with and without the launch bar, for me to review.
