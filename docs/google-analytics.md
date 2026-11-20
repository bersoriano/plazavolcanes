# Google Analytics (GA4)

Google Analytics measures the public site: which pages bring visitors, which
calls to action they use, and how many become seller accounts. PostHog
receives the same events through the same core (`docs/posthog-analytics.md`).
Neither replaces the database-backed seller statistics.

The code is the shared core of the `landing-page-ga` skill, copied in on
2026-11-20 (`ANALYTICS_CORE_VERSION` in `lib/analytics.client.ts`). Keep the
copied files as they are so a later version of the skill can replace them; this
site's choices live in the files marked "site" below.

| File | What |
| --- | --- |
| `lib/analytics.ts` | Event names, parameter types, URL cleaning (skill; `CtaType` and `PageType` extended here) |
| `lib/analytics.client.ts` | `initAnalytics`, `track`, the gtag loader and privacy gates (skill) |
| `components/analytics/page-analytics.tsx` | `page_view`, `section_view`, `cta_click` (skill) |
| `lib/analytics-pages.ts` | Public-page allowlist and `page_type` (site) |
| `lib/analytics-forms.ts` | Form events for signup and contact (site) |
| `components/analytics/read-progress.tsx`, `content-analytics.tsx` | Blog reading depth, FAQ opens (site) |
| `instrumentation-client.ts` | Starts the core once, before hydration, with PostHog as its second destination |

## Activation

The Measurement ID (`G-…`) is in GA: Admin → Data collection and modification →
Data streams → the web stream for `plazavolcanes.com`.

| Variable | Production | Preview | Local |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_GA_ID` | the ID | the ID, or unset for no GA at all | the ID, only to test |
| `NEXT_PUBLIC_SITE_URL` | `https://plazavolcanes.com` (already set) | same | `http://localhost:3000` |
| `NEXT_PUBLIC_GA_DEBUG` | unset (ignored anyway) | `true` to use DebugView | `true` to use DebugView |

```bash
vercel env add NEXT_PUBLIC_GA_ID production
vercel env add NEXT_PUBLIC_GA_ID preview
vercel env add NEXT_PUBLIC_GA_DEBUG preview   # true
```

`NEXT_PUBLIC_*` values are inlined at build time: set them, then redeploy.
Without `NEXT_PUBLIC_GA_ID` nothing loads and nothing is sent.

**Turn off Enhanced measurement before the first production deploy with the
ID** (GA Admin step 1 below). It is on by default and sends its own page views
with the raw URL, so every page would count twice and query strings would
reach GA.

## What is collected, and what is not

GA loads only when all of these hold; otherwise no Google script is requested:

- The page is served from `NEXT_PUBLIC_SITE_URL`'s host. `www`, `*.vercel.app`
  deployments and previews are excluded, even though Vercel calls the
  production alias "production" too. `www.plazavolcanes.com` already redirects
  to the apex.
- The browser sends neither Do Not Track nor Global Privacy Control.
- The first page is public (`lib/analytics-pages.ts`): `/`, `/vender`,
  `/explorar`, `/como-comprar`, `/blog` and its posts, `/productos/*`,
  `/tiendas/*`, `/estado/*`, `/registro`, `/ingresar` and the legal pages.
  Everything else is private by default: `/panel`, `/admin`, `/mensajes`,
  `/compras`, `/carrito`, `/recuperar`, `/nueva-contrasena`,
  `/confirmar-correo`. A client-side navigation into one of them stops GA for
  the rest of that page load. New routes stay private until listed there.

Every hit carries the page URL without its query string, except the five
`utm_*` campaign tags, and without the fragment. Search terms, `?desde=`,
`?continuar=` and click IDs (`gclid`, `fbclid`) are dropped. Other sites
appear as origin only. Google signals and ad personalization are off
(`npa=1`), the `_ga` cookies last about 13 months, and no form field, name,
email, phone, message or account ID is ever sent.

Consent Mode is not used: the site serves Mexico and does not target the EEA,
UK or Switzerland. Revisit if that changes. The privacy notice still has to
name Google Analytics before or when it is published:
`docs/legal/privacy-notice-analytics-draft.md`.

## Events

Shared names from the skill's taxonomy, so this property compares with other
sites. Started 2026-11-20; there is no earlier GA series to reconcile.

| Event | When | Parameters |
| --- | --- | --- |
| `page_view` | Each public route, initial load included (manual, one per route) | `page_type`: `landing` (`/`, `/vender`), `catalog`, `product`, `shop`, `blog_index`, `blog_post`, `auth`, `legal`, `supporting` |
| `cta_click` | Click on a `[data-cta]` link | `cta_type`: `signup` (visitor's create-store links), `create_shop` (signed in, no shop yet), `login`, `form` (assisted publishing); `cta_location`: section id, `header`, `menu`, `sticky` |
| `section_view` | A `[data-analytics-section]` is a quarter visible, once per page view | `section_id`: on `/`: `inicio`, `vista-previa`, `vender`, `pasos`, `articulo`, `tiendas`, `explorar`, `fundadoras`; on `/vender`: `inicio`, `fundadoras`, `beneficios`, `compara`, `catalogo`, `pasos`, `niveles`, `preguntas`, `final` |
| `form_start` | First focus inside the signup or contact form | `form_name`: `signup`, `seller_signup`, `contact` |
| `form_submit` | Submit attempt | `form_name` |
| `form_error` | The server refused it, or the request failed | `form_name`, `error_type`: `validation`, `server`, `network` |
| `sign_up` | The server opened the account (success state, or its redirect into the app) | `method: email`, `form_name` |
| `generate_lead` | The plaza received a contact message | `form_name: contact` |
| `read_progress` | Blog post read to 25/50/75/100 %, while scrolling | `percent`, `content_type: article` |
| `select_content` | A `/vender` FAQ question opened by the visitor | `content_type: faq`, `content_id`: `fundadora`, `comision`, `productos`, `compradores`, `pago`, `cliente`, `fraude`, `mes-13`, `salir` |

`seller_signup` is a signup from a seller entry point (`?vender=1`, or
continuing to `/panel/tiendas/nueva`). Signing in sends no form events.

To mark a new call to action, add `data-cta="<CtaType>"` to the link (and
`data-analytics-section` to its section); no click handler is needed. Add new
values to the unions in `lib/analytics.ts`. Components call `track()` from
`lib/analytics.client.ts`, never `gtag()`.

### PostHog

PostHog gets every event above under the same name and parameters, except
`page_view`, which it calls `$pageview`. Both use the same gates, so totals
should track closely; a large gap means one destination is not loading.
Details and the events PostHog used before 2026-11-20: `docs/posthog-analytics.md`.

## GA Admin (manual, someone with Editor access)

```
GA4 manual steps for plazavolcanes.com (property G-XXXXXXXXXX):
[ ] Enhanced measurement OFF (before the deploy that adds the ID)
[ ] Data retention 14 months
[ ] Developer traffic filter created (Exclude) and switched to Active
[ ] Unwanted referrals: none today (no payment or booking domain sends visitors back)
[ ] Custom dimensions (event scope): page_type, cta_type, cta_location, link_domain,
    form_name, error_type, section_id, content_type, content_id
[ ] Optional custom metric: percent (read_progress)
[ ] Key events: sign_up; generate_lead only if contact messages count as leads
    (the form also receives complaints)
[ ] Google signals stays off; the Google tag has no other GA tag attached
```

Custom parameters are invisible in reports until registered, and only from
that day on, so register them before or right after the first deploy.

Google Ads: auto-tagging (`gclid`) cannot attribute visits because click IDs are
dropped. If the plaza buys Google Ads, tag the final URLs with `utm_*`.

## Verification

Automated (`npm test`): the skill's contract tests (`lib/analytics.test.ts`:
host gate, DNT/GPC, `set` before `js`, clean URLs, one page view per route,
secret-path shutdown), the allowlist, the form events, read progress, FAQ opens
and the markup of every marked CTA and section.

After setting the ID and redeploying:

1. `bash ~/.claude/skills/landing-page-ga/scripts/audit.sh . --live https://plazavolcanes.com`
   shows the ID in a bundle chunk and a single `gtag.js` loader.
2. In a clean browser profile (no blocker, no GPC), open
   `https://plazavolcanes.com/?utm_source=qa&utm_medium=test&utm_campaign=ga&gclid=x&email=a`,
   filter the network panel by `collect`: one `en=page_view` per route, `dl`
   keeps only the three `utm_*`, `npa=1`, no `_dbg`.
3. Navigate to `/vender` and back: one more `page_view` each. Click "Crear mi
   tienda": `en=cta_click` with `ep.cta_type=signup`.
4. Signed in, open `/panel` with a full page load: no `gtag/js` request at all.
   (Signed out it redirects to `/ingresar`, which is public.)
5. GA Realtime shows the visit. DebugView needs a preview or local run with
   `NEXT_PUBLIC_GA_DEBUG=true`, or Tag Assistant on the live URL.
6. Create a test seller account from a preview with DebugView and confirm
   `sign_up` arrives: it is sent just before the redirect into `/panel`, which
   then switches GA off for that page load.
