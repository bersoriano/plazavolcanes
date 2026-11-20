# PostHog analytics

PostHog receives the same events as Google Analytics, through the same code:
it is a destination of the shared analytics core (`landing-page-posthog`
skill), not a separate integration. Gates, pages and event names are those of
`docs/google-analytics.md`; this file covers what is PostHog's own.

| File | What |
| --- | --- |
| `lib/analytics.posthog.ts` | The destination: SDK config, `before_send` filter, queue (skill) |
| `lib/posthog-proxy.ts` | Which PostHog host a `/ingest` request goes to, and which headers it keeps (skill) |
| `proxy.ts` | Runs that proxy first, then the Supabase session refresh |
| `instrumentation-client.ts` | The only start-up: `initAnalytics({ …, destinations: [posthogDestination()] })` |

Components never import `posthog-js` (the claims audit enforces it). They mark
links with `data-cta` and sections with `data-analytics-section`, and call
`track()` for anything else.

## Change log

**2026-11-20: rebuilt on the shared core.** Until then PostHog had its own
start-up, a persistent anonymous ID in localStorage, automatic page views on
every route (the signed-in app included), and its own events. Compared with
earlier data:

- **Unique visitors are counted per day** (cookieless hashing): someone
  returning tomorrow counts again. Weekly and monthly uniques are not
  comparable across the change, nor are country breakdowns (none now).
- **Signed-in pages are gone:** `/panel`, `/admin`, `/mensajes`, `/compras`,
  `/carrito` and the auth-link pages send nothing.
- **Retired events:** `navigation_clicked` (seller links are now `cta_click`),
  `seller_signup_submitted` (now `form_submit` with `form_name: seller_signup`,
  plus `sign_up` when the account opens), `seller_shop_submitted`,
  `seller_product_submitted` and `seller_storefront_share_intent` (signed-in
  seller activity, no longer sent). Update saved insights to the new names.
- **Campaign tags kept:** URLs carry the five `utm_*` tags; other query
  parameters are still dropped.

## Activation

| Variable | Production | Preview | Local |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_…` of the Plaza Volcanes project | `phc_…` of a **test project**, or unset | test project, only to try it |
| `NEXT_PUBLIC_POSTHOG_HOST` | `/ingest` | `/ingest` | `/ingest` |
| `NEXT_PUBLIC_POSTHOG_REGION` | `us` (the project's region) | `us` | `us` |
| `NEXT_PUBLIC_POSTHOG_DEBUG` | unset | `true` | `true` |

Plus `NEXT_PUBLIC_SITE_URL`: PostHog, like GA, only sends from that host.
Elsewhere it sends nothing unless `NEXT_PUBLIC_POSTHOG_DEBUG=true`, and then to
whatever project the key names. PostHog has no debug filter, so a preview or
local run with the production key lands in production data: use a test
project.

Only `phc_` project tokens work; the destination refuses anything else, and a
personal `phx_` key must never be in a `NEXT_PUBLIC_*` variable. Values are
inlined at build time: redeploy after changing them.

```bash
vercel env rm NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN production   # old name
vercel env add NEXT_PUBLIC_POSTHOG_KEY production            # phc_…
vercel env add NEXT_PUBLIC_POSTHOG_HOST production           # /ingest (was https://us.i.posthog.com)
vercel env add NEXT_PUBLIC_POSTHOG_REGION production         # us
```

**Order matters.** Turn on the project's cookieless setting (checklist step 1)
**before** the deploy that ships this code. Without it PostHog accepts the
requests (200) and silently discards every event.

## Proxy

The SDK sends to `/ingest` on the site's own domain. `proxy.ts` forwards it to
`us.i.posthog.com` (assets to `us-assets.i.posthog.com`), after deleting the
`cookie`, `referer` and any non-PostHog `authorization` header, and before the
Supabase session refresh runs. Vercel adds the visitor's IP
(`x-forwarded-for`), which cookieless hashing needs. Each proxied call is a
Vercel Edge Request.

`next.config.ts` sets `skipTrailingSlashRedirect` because PostHog's paths end
in `/`. `proxy.ts` re-creates Next's permanent `/path/` → `/path` redirect for
every page, so URLs behave as before.

Do not replace this with `rewrites()` in `next.config`: rewrites forward every
header, so session cookies and full page URLs would reach PostHog.

## Privacy

- Cookieless (`cookieless_mode: "always"`): no cookies, no localStorage or
  sessionStorage. PostHog counts visitors with a daily-rotating hash of IP and
  user agent on its servers. Consent calls do nothing in this mode; the core's
  gates are the only switch.
- Do Not Track or Global Privacy Control: the SDK is not even downloaded.
- `person_profiles: "never"`, no `identify()`. Autocapture, session replay,
  heatmaps, dead and rage clicks, exception and performance capture, surveys,
  feature flags, product tours and remote scripts are off.
- `before_send` passes only the shared event names plus `$pageview` and
  `$pageleave`, cleans every URL to the campaign tags, cuts other sites'
  referrers to their origin and removes click IDs (`gclid`, `fbclid`…).
- Page titles and paths of public pages are sent; product and shop pages
  carry their slugs. No form field, message or account ID is sent.

The privacy notice must say this: `docs/legal/privacy-notice-analytics-draft.md`.

## Reports

Events and parameters are GA's (`docs/google-analytics.md` → Events), with
`$pageview` for `page_view`. Parameters are queryable at once; no registration.

- Acquisition: Web analytics on `/` and `/vender`; channels, referring
  domains, UTMs, devices. No countries.
- Seller funnel: `$pageview` (`page_type = landing`) → `cta_click`
  (`cta_type = signup`) → `form_start` (`form_name = seller_signup`) →
  `form_submit` → `sign_up`.
- Section reach: `section_view` by `section_id`, divided by `$pageview` on the
  same page.
- Content: `read_progress` with `percent = 100` by path; `select_content` by
  `content_id` for the `/vender` FAQ.

Compare totals and per-page-view rates, not weekly or monthly uniques. PostHog
and GA totals should track closely; a large gap means one of them is not
loading (check the proxy).

## PostHog project settings (manual)

```
PostHog manual steps for plazavolcanes.com (project Plaza Volcanes, region us):
[ ] Cookieless server hash mode ON (Settings → Project → Web analytics), before the deploy
[ ] Autocapture / heatmaps / web vitals / dead clicks / replay off at project level
[ ] Billing limit set
[ ] Test-user filters: utm_source = internal, $host != plazavolcanes.com
[ ] Actions: "Seller signup" = sign_up where form_name = seller_signup;
    "Seller CTA" = cta_click where cta_type = signup; "Lead" = generate_lead
[ ] Test project created; its key in Vercel Preview (and .env.local), with DEBUG=true
[ ] Proxy live: https://plazavolcanes.com/ingest/static/array.js returns 200, no location header
[ ] Old data: person records and the retired events stay in the project;
    deleting them is permanent and optional
```

## Verification

Automated (`npm test`): the skill's destination tests
(`lib/analytics.posthog.test.ts`: event allowlist, URL and click-ID cleaning,
host/debug/key gates, cookieless config, queue, beacon clicks, shutdown on
private pages), the proxy helper (`lib/posthog-proxy.test.ts`) and `proxy.ts`
(`proxy.test.ts`: cookies and Referer stripped, session refresh skipped,
trailing-slash redirect kept on the site's host).

After the deploy, in a **real browser** (the SDK sends nothing from
Playwright or other automation), no blocker, no DNT/GPC:

1. `bash ~/.claude/skills/landing-page-posthog/scripts/audit.sh . --live https://plazavolcanes.com`:
   token shipped, ingestion host `/ingest`, proxy probe 200.
2. Open `https://plazavolcanes.com/?utm_source=internal&utm_medium=qa&utm_campaign=posthog&gclid=x&token=secret#hero`.
   Network: requests go to `/ingest/…` and return 200; none to `*.posthog.com`.
3. Application tab: no `ph_*` cookie, no PostHog keys in localStorage or sessionStorage.
4. PostHog → Activity → Live events: one `$pageview` per route,
   `$current_url` with the three `utm_*` only; `cta_click` when "Crear mi
   tienda" is clicked.
5. Signed in, open `/panel` with a full page load: no `posthog` chunk, no `/ingest` request.
6. Data management → Ingestion warnings: none about cookieless.
