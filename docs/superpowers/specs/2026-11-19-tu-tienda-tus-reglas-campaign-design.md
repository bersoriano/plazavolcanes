# "Tu tienda, tus reglas" landing campaign

Date: 2026-11-19 · Status: approved in chat · Size: small change

## Intent

Bring independent sellers to Plaza Volcanes. The home landing (`/`, `components/home/landing/*`) becomes one campaign around the line **"Tu tienda, tus reglas."** Each "rule" is a freedom a seller already has today, so the campaign makes no new promise:

- they set their own prices;
- they choose how they get paid (paid directly, no retention, no commission on direct payment);
- they agree delivery with each customer, in writing inside the order;
- they decide what goes in their catalogue (new or used) and share it with one link.

## Goals / non-goals / anti-goals

- Goal: one recognisable campaign voice from hero to closing band, and in the link preview a shared `/` shows.
- Goal: keep the seller portrait (`/mexican-woman.jpg`) and the hero's tuned layout (h1 is the LCP at every width; collage scales in cqw).
- Non-goal: `/vender` (own hero, collage and tapes), the steps section, the buyer panel, SEO `<title>`/description (keyword-bearing; unchanged).
- Anti-goal: copy that promises anything not live (reputation tile stays gated on `REPUTATION_IMPORT_AVAILABLE`; founder copy keeps reading `lib/launch.ts`).
- Anti-goal: a second render-blocking stylesheet on `/` (global CSS must stay under ~100 KiB with fonts).

## Approaches

1. **Copy-led campaign on the existing layout (picked).** New headline, subtitle and collage cards; section copy retouched. Keeps the measured performance work and the CTAs analytics/e2e rely on.
2. New hero layout (full-bleed photo, text over image). Rejected: would move the LCP to the photo and redo the cqw collage tuned for 320px→desktop.
3. Headline swap only. Rejected: the rest of the page would keep the old "catalogue for WhatsApp" voice.

## Design

**Hero** (`seller-hero.tsx`)
- Eyebrow unchanged: "Para tiendas independientes de México".
- H1 on two lines: "Tu tienda," / "tus reglas." with "tus reglas." on a tilted lime marker (brand plum text), echoing the share image's lime pill. Accessible name "Tu tienda, tus reglas.". The comma is a copy call (Spanish needs it).
- Subtitle: "Tú pones los precios, eliges cómo cobrar y acuerdas la entrega con cada cliente. Plaza Volcanes no toca tu dinero: sin comisión en pago directo."
- CTAs unchanged ("Abrir mi tienda gratis", "Ver una tienda de ejemplo").

**Collage** (`hero-collage.tsx`)
- Portrait unchanged.
- Receipt becomes the "Reglas de mi tienda" card ("Las pongo yo"): Mi precio $1,999.00 (from sm, as before), Cómo cobro · Directo, Comisión Plaza Volcanes · $0.00, then "Tú recibes $1,999.00". Same row count, so the cqw geometry holds.
- Chip "Te pagan directo" → "Tú pones el precio" (tag icon). 0% sticker and the newest-listing card unchanged.
- Screen-reader summary follows the card.

**Other sections**
- Customer preview (`home-landing.tsx`): eyebrow "Tu vitrina, a tu manera"; text "Tú eliges qué publicar, con tus fotos y tus precios. Este producto pertenece a una tienda real de la plaza." Heading unchanged.
- Lime tape (`crossing-tapes.tsx` default promises, home only): "Tus precios ✦ *tu forma de cobrar* ✦ Sin comisiones ✦ *todo por escrito* ✦ 100% mexicana".
- Benefits (`benefits-bento.tsx`): eyebrow "Tus reglas"; heading "Lo que vendes, es tuyo." unchanged; tiles "Cobras a tu manera", "Tu reputación viene contigo", "Tú armas tu catálogo" ("Nuevo o usado, tú eliges qué publicar y lo compartes con un solo enlace."), "Tus acuerdos, por escrito".
- Stores (`landing-stores.tsx`): aside "Tiendas reales, cada una con sus reglas, su nivel y sus reseñas. La siguiente puede ser la tuya."
- Closing band (`final-cta.tsx`): heading "Tus reglas, *desde el primer día.*"; eyebrow, founder sentence and CTAs unchanged.
- Share image (`app/opengraph-image.tsx`): "Tu tienda," / lime pill "tus reglas."; sub-line becomes evergreen ("Tus precios, tu forma de cobrar, sin comisión en pago directo.") so a cached preview never outlives the founders offer; alt "Plaza Volcanes: tu tienda, tus reglas".

## Left to the builder

Marker styling details, icon choice, test wording. Verify with Vitest, lint, typecheck, `next build` (one stylesheet on `/`), and a visual check at phone and desktop widths.
