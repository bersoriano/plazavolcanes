# PostHog analytics

## Activation

Set both `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` in
`.env.local` or the deployment environment. Use the public project token from
PostHog project settings, never a personal API key. The host must match the
project region (`https://us.i.posthog.com` or `https://eu.i.posthog.com`), or your
self-hosted ingestion endpoint. Without both settings, analytics stays inert.
Restart development or rebuild the deployment after changing these values:
Next.js embeds public environment variables at build time. Leave them unset in
previews and automated end-to-end runs to keep test traffic out of production.

The browser SDK initializes through Next.js `instrumentation-client.ts`, before
hydration, following the [PostHog Next.js integration](https://posthog.com/docs/libraries/next-js).
Its history tracking handles initial visits, client navigation, and browser
back/forward navigation without a React provider or duplicate pageview tracker.

## Events and reports

| Event | Meaning | Custom properties |
| --- | --- | --- |
| `$pageview` | A page becomes visible, including client-side route changes | SDK page and browser metadata, sanitized URL |
| `$pageleave` | Visitor leaves a page | SDK page duration metadata, sanitized URL |
| `navigation_clicked` | Internal link clicked on `/` or `/vender`, including header/footer and section navigation | `source_path`, `destination_path`, `source_section`, `seller_intent`, optional `target_section` |
| `seller_signup_submitted` | Seller-intent registration form submitted | None |
| `seller_shop_submitted` | Shop creation or editing form submitted | None |
| `seller_product_submitted` | Product creation or editing form submitted | None |

Suggested PostHog reports:

- Web analytics: pageviews, anonymous visitors, sessions and referrer domains.
- Landing navigation: filter `navigation_clicked` by `source_path`, break down
  by `destination_path` or `source_section`; use `target_section` for in-page links.
- Seller acquisition: landing pageview → `navigation_clicked` with
  `seller_intent=true` → `seller_signup_submitted` → pageview of
  `/panel/tiendas/nueva` → `seller_shop_submitted`.
- Seller activity: pageviews under `/panel` and trends for shop/product submissions.

Submission events are attempts, including validation failures and retries. They
do not prove that an account was created, email confirmed, shop saved, product
published, or sale completed. Successful conversion events would require a
separate integration with those confirmed outcomes. These events do not replace
the database-backed shop analytics shown to sellers.

Visitors are anonymous browser identities persisted in localStorage, not
authenticated accounts. Counts are affected by shared browsers, device changes,
storage clearing, blockers, and Do Not Track. No cross-device identity or
authenticated seller identification is performed. Referrer domains remain
available; campaign/query attribution is deliberately disabled.

## Privacy boundaries

PostHog is a new third-party analytics recipient. The older legal design's
assumption that no third-party tracking exists no longer describes a deployment
with these variables enabled. Review and update the published privacy notice
and any applicable consent flow before production activation. Environment
configuration enables collection; it is not visitor consent.

The integration uses localStorage for anonymous analytics persistence and
respects Do Not Track. It does not enable session replay, DOM autocapture,
heatmaps, performance/network capture, exception capture, surveys, product
tours, feature flags, or person profiles. Form contents, passwords, email,
phone, messages, link text and arbitrary element attributes are not captured by
the custom trackers. Only the three explicitly tagged seller forms emit submit
events. Other forms, including sign-in, recovery and messaging, are ignored.

URL query strings and fragments are removed from current URLs and outbound URL,
path and referrer properties. Page titles and person-property updates are
discarded. Page paths, including dynamic route identifiers, still reach PostHog;
browser metadata and IP-derived location may also be processed by PostHog.
This is data minimization, not a claim that analytics collects no personal data.
Only the documented event names pass the send filter.

## Verification

1. Configure a test PostHog project and open its live events view.
2. Visit `/`, follow a seller CTA, and navigate back using the browser.
   Check one `$pageview` per route visit and `navigation_clicked` for the CTA.
3. On `/vender`, click a section link and check `target_section`.
4. Submit a seller-intent signup and a shop/product form. Confirm the named
   submission events contain no form values; unsuccessful attempts also count.
5. Inspect a URL with a harmless test query/fragment. Confirm neither appears in
   captured URLs, referrers, or page titles. Never use real credentials to test.
6. Remove either setting, rebuild/restart, and confirm no PostHog requests.

Automated checks cover configuration guards, initialization failure, URL
redaction, event filtering, landing links, and seller submissions. Live ingestion
requires a real project token and cannot be proven by unit tests alone.
