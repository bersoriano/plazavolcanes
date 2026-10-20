# Seller statistics

`/panel/estadisticas` is available to every authenticated seller. It shows all
owned shops or one owned shop for 7, 30 (default), or 90 calendar days, including
today, in America/Mexico_City. Comparisons use the immediately preceding equal
window. Today is incomplete; changes are directional, not controlled experiments.

## Deployment

Apply `supabase/migrations/20261020181346_seller_analytics.sql` before deploying
the application. It expands the existing private view table without rewriting
historical counts, adds private collection tables and narrowly granted RPCs, and
schedules hourly cleanup. Normal deployment does not need new environment
variables or PostHog credentials. Existing Supabase configuration is sufficient.

Collection fails open if the RPC is unavailable. The report shows an explicit
load error instead of fabricated zero metrics. An invalid or unowned shop
selection returns not found; it never falls back to all shops.

This work adds first-party seller counters. The separate PostHog integration
continues to measure platform behavior; PostHog event ingestion does not supply
these seller reports.

## Definitions

| Measure | Definition |
| --- | --- |
| Visits | Existing historical product views plus new measured product sessions. Not unique people. |
| Tracked views | New product sessions observed by this collector, including a view recorded atomically when a CTA arrives first. |
| Question / purchase / share activity | At most one attempt per action type, product and tab session. A share attempt does not prove the destination received anything. |
| Interest | Product sessions with at least one question or purchase CTA. Sharing is excluded. |
| Interest rate | Interest divided by tracked views. Historical views are excluded from the denominator because historical CTA activity is unknown. Missing denominator displays “Sin datos”. |
| Questions | New pre-sale conversation records about a product, not message count or question-button clicks. Reopening an existing conversation is not a new question. |
| Purchase requests | Saved orders containing the selected products, including later canceled or expired requests. Does not assert payment or completed sales. Overview/daily counts deduplicate order IDs across products; product rows count each included order once per product. |

Product sessions expire after 30 minutes from their creation. Their first-view
day owns subsequent activity, including a CTA after midnight. Reloads and
remounts reuse the tab's token; database locking prevents concurrent replays from
inflating daily totals. Different tabs/devices are separate sessions. If browser
storage is unavailable, collection uses the mounted component's in-memory state.

Only public, approved products collect activity. The database excludes the
authenticated shop owner's requests; a signed-out owner cannot be distinguished
from another visitor. JavaScript blockers, automation, storage changes, and
forged public telemetry can affect counts. Server-side per-product minute quotas
limit write amplification but do not establish unique people or fraud-proof data.

CTA history starts at migration application time, recorded once by the database
and shown in the report. Never manufacture older CTA history. The chart includes
zero-view days and a shared count axis; interest before collection started is
unavailable, not zero. The accessible daily table contains exact
values. Low-interest suggestions require at least 10 newly tracked views with no
primary CTA, new question, or purchase request. Ten is a product heuristic, not
a statistical significance threshold or a performance benchmark.

## Access and retention

The backend obtains authorization from `auth.uid()`, filters every report to
owned shops, and rejects explicit cross-shop reads. It does not accept a seller
ID from the browser. Only authenticated roles may execute the reporting RPC.
Telemetry can be submitted anonymously, but cannot read counters or session rows.

Session tokens are random pseudonymous UUIDs stored per product in tab-local
sessionStorage. The private deduplication table stores token, product, first day,
creation time, and action types; no names, email, IP, phone, message text, form
contents, or account identifiers are recorded there. Hourly cleanup deletes
tokens older than two days and quota buckets older than one day. Daily aggregate
counts remain. The report never exposes raw tokens. Include these collection and
retention rules when maintaining the privacy notice.

## Validation

Database tests cover ownership, publication restrictions, replays, midnight,
retention, rate limits, historical denominator boundaries, and multi-item order
totals. Browser tests exercise an anonymous product visitor, all three CTAs,
seller filters, a non-founder report, concurrent calls, mobile overflow, and
invalid shop selection against the local Supabase stack only. Test fixtures are
removed after each browser run.

Recorded checks on 2026-10-20: focused analytics and legacy-view database suites
pass (38 checks); both local browser flows pass, including desktop/mobile
screenshots and concurrent replay. ESLint passes. Security advisors report two
existing mutable-search-path warnings (`private.display_label` and
`private.guard_published_legal_versions`), neither introduced here.

The complete database suite was also attempted against the populated local
stack. Fixture primary-key collisions and global-count assumptions affect
`admin_marketplace_users`, `catalog_state_filter`, `categories_search`,
`commerce_foundation`, `founding_shops`, `fulfillment_communication`,
`marketplace_rls`, `product_expiry`, `product_images`, `product_slugs`,
`product_units`, `seller_notifications`, `trust_evidence`, and
`trust_tier_evaluator`. Existing local data was preserved; the full database
suite is not claimed green.

Local production compilation succeeds with webpack, then generated Next.js
validation stops on the unchanged optional page-props signature in
`app/panel/pedidos/page.tsx`. Turbopack production building separately fails to
bind a worker port in this environment. These limits do not affect the passing
local browser flows, but a production build is not claimed verified locally.

Rollback: revert application callers first. Unschedule
`plaza-product-activity-retention`, remove the two new public RPCs and private
cleanup function, then remove the three new private tables. Leave daily columns
and aggregates intact if collected history must be preserved.
