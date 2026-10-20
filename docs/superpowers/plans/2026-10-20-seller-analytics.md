# Seller Analytics Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give every seller a private Estadísticas section with 7/30/90-day shop filters, trends, product activity, comparisons, and actionable low-interest signals.

**Architecture:** Extend existing daily product-view aggregates. Count CTA activity with short-lived anonymous per-product session deduplication, and derive saved inquiries/orders from existing business records. A database RPC checks ownership and returns one JSON response, avoiding API row-limit truncation. Render a native server page; retain PostHog's separate platform telemetry.

**Tech Stack:** Existing Next.js 16.3, React 19, Supabase Postgres, Vitest, pgTAP; no new dependencies.

**Spec:** Approved recommendation in this chat, 2026-10-20.

## Global Constraints

- All sellers get basic access; multiple shops are aggregated only for their owner.
- Never show buyer identities, raw session tokens, or form values in reports.
- Views and per-CTA counts deduplicate per product/browser-tab session of 30 minutes. Session tokens are purged after two days; daily totals remain.
- Authenticated owner's activity and nonpublic products never count. A session's activity belongs to its first-view day in America/Mexico_City.
- Preserve old view counts. Interest rate uses newly measured view sessions only; do not backfill historical CTA data.
- Saved questions and orders are outcomes, separate from CTA attempts. Aggregate purchase requests count each order once even when it includes multiple products.
- Keep existing visual language, accessible chart/table, empty/error states; no new reporting service, CSV, realtime streaming, rankings across sellers, or buyer profiling.

## Review Focus

- Another seller's shop ID must fail, never silently widen scope.
- Replayed and concurrent CTA calls must not inflate counts or interest rate.
- Midnight and previous-period boundaries use the same calendar and population.
- Historical views must not dilute a newly introduced interest-rate denominator.
- Multi-item orders count once in overview, once per included product in product rows.

### Task 1: Measurement and reporting database

- [x] Write pgTAP tests for deduplication, ownership, published-only collection, period boundaries, and order aggregation; observe missing-function failure.
- [x] Add migration: daily CTA columns, private short-lived session/quota/settings tables, narrow collection RPC, authenticated reporting RPC, retention job.
- [x] Apply locally and pass focused database tests plus existing product-view tests.
- [x] Commit database and tests.

### Task 2: Product instrumentation

- [x] Write browser-unit tests for shared session identity, view/CTA deduplication, expiry, blocked storage, and submission/link/button collection.
- [x] Add validated fail-open server action and client collector; wire product beacon and explicit CTA markers.
- [x] Run focused tests and commit instrumentation.

### Task 3: Seller reporting UI

- [x] Write tests for filters, zero-baseline comparisons, data errors, all-seller access, and chart/table presentation.
- [x] Add typed reporting contract/query, Estadísticas page, filters, comparison cards, accessible daily chart, product table, and sample-aware suggestions.
- [x] Add panel navigation and link from each shop; remove founders-only restriction on the existing card.
- [x] Run focused tests and commit UI.

### Task 4: Verification

- [x] Run full unit suite, lint, typecheck/build, database access tests, and browser checks at desktop/mobile sizes; record build and seeded-database limitations below.
- [x] Request fresh branch review; fix material findings with regression tests.
- [x] Document collection definitions, retention, start-date limitations, migration deployment requirements, and verification results.

## Execution Notes

- Initial workspace clean on main; task branch codex/seller-analytics created after sync.
- User approved implementation directly; proceeding inline without another approval cycle.
- All 2,063 unit/component tests pass (244 files). Both local browser flows pass: panel navigation and seller analytics, including concurrent replay, non-founder access, date/shop filters, CTA collection, screenshots, and mobile overflow.
- Focused database suite passes: 29 new checks plus 9 legacy product-view checks. Security advisors report only two existing mutable-search-path warnings outside this change.
- Review found no material new issue. Removed the legacy card's per-product summed order total to avoid disagreeing with the new deduplicated overview.
- Visual QA corrected repeated count-axis labels at low traffic and moved chart labels to normal-size HTML for readable mobile rendering.
- Local build is limited by Turbopack worker port binding; generated TypeScript validation also exposes the unchanged seller-orders page's optional-props error. No new application type errors remain.
- Production migration and deployment are separate release steps; only the local database was changed.
- Full database suite was attempted and exposes fixture collisions/global-count assumptions in the populated local stack. Affected files and build limits are listed in docs/seller-analytics.md. Existing data was preserved; only this run's orphaned synthetic account was removed.
- Historical CTA chart/table values now display as unavailable before the recorded collection date, with a regression test.
