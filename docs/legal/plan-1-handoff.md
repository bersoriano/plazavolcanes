# Legal content system — what plan 2 inherits

Plan 1 (`docs/superpowers/plans/2026-08-26-legal-content-system.md`) is complete.
This records what was deliberately left, so the next person does not rediscover
it. Everything here was found by review and consciously deferred, not missed.

## Blocking prerequisites for plan 2

**1. There is no write path.** No role holds `INSERT` on
`legal_document_versions`, and no RPC creates or approves a draft.
`public.publish_legal_version` is therefore unreachable in production today: an
approved row can only come from a direct database connection. Plan 2 must build
the drafting and approval writer before the publish function it depends on can
be exercised at all. This is a consequence of ruling R7 — DML was revoked from
`service_role` because a grant, not a trigger, is what stops a forged publish —
and it is the correct trade, but it has to be paid.

**2. No partial unique index enforces one published version per type.** Two
concurrent publishes can leave two rows `published`. The resolver's tiebreak is
deterministic, so nothing breaks visibly, but `record_acceptances` in plan 2
will resolve "the current published version" against an ambiguous set. The fix
is a partial unique index plus reordering `publish_legal_version` to retire
before it publishes. It was not done here because the pgTAP suite could not be
run cleanly (see below) and an unverified change to the publish path is worse
than a recorded one.

**3. The buyer-side verification claim is still emitted by the database.**
`private.evaluate_buyer_trust` (migration `20260820191826`) still builds
`'Comprador verificado'` and `'Altamente verificado — completó verificación
avanzada con documentos oficiales'` into the buyer-trust payload, and
`lib/buyer-trust.ts` still requires the field in a `.strict()` schema. The
strings reach the client even though `BuyerTrustCard` stopped rendering them in
plan 1. This is the same unbacked claim as the seller-side badges, one layer
down. **Fix it first in plan 2**, and in the same change extend
`tests/claims-audit.test.ts` to scan `supabase/migrations/*.sql`. The two are
coupled: that scan cannot be added until the strings are gone, because it would
fail on them.

**4. `locale` is inert.** Not in the unique constraint, not in the resolver's
signature, not in the RLS predicate. A second locale today collides on
`(document_type, version)`.

## Environment problem that blocked verification

`npx supabase test db` could not be run cleanly at the end of plan 1. The local
Docker database is shared with another active session, carries a migration this
branch does not have (`20260826120000`, adding `conversations.product_id`), and
holds leftover rows producing `duplicate key value violates unique constraint
"shops_pkey"`. Twelve unrelated pgTAP files abort on that.

This is the repository's own audit P0 item 6 ("fix local database sequence drift
and test isolation"), aggravated by two sessions sharing one container. It was
not resolved because the fix is `npx supabase db reset`, which would destroy the
other session's applied migration and data.

**This branch's own database work was verified by running its suites directly**
against the same database: `legal_documents.test.sql` passes 28/28. Re-run the
full suite after a reset before trusting anything else.

## Deferred minor findings

Carried deliberately; none blocks merge.

- The `SELECT ... INTO` in the constraint-discovery block is not `STRICT`, so a
  second matching constraint would be silently ignored rather than erroring.
- `private.guard_published_legal_versions()` is `SECURITY INVOKER` with no
  pinned `search_path`, unlike its sibling trigger functions, and contains an
  unqualified `pg_class` reference.
- `content_hash` covers `body || issuer_identity` only — not `title`, `version`,
  `document_type`, `effective_at` or `locale`.
- The first migration's rollback comment leaves the widened
  `admin_audit_events` action constraint in place.
- The `admin_audit_events` action vocabulary is hard-coded to four values; a
  concurrently merged migration adding a fifth would silently drop one.
- `pre_launch` suppresses the build failure for an unreachable database; only a
  genuinely missing schema now hard-fails.
- `REQUIRED_LEGAL_TYPES` equals `LEGAL_DOCUMENT_TYPES` only because every seeded
  row happens to be `is_required`; nothing derives it from the column.
- `lib/legal/platform-identity.ts` still has no production caller — the build
  gate re-declares its list in plain JS, guarded by a sync test. Its real
  consumer is plan 2's publish action.
- No test covers the `""` fallback on `title` / `contentHash` / `effectiveAt`.
- An unparseable `effective_at` renders the raw ISO string inside Spanish prose.
- `html` background is not reset inside `@media print`; only `body` is.
- The print stylesheet hard-codes `plazavolcanes.com`, duplicating
  `NEXT_PUBLIC_SITE_URL`, and applies its URL suffix site-wide.
- `lib/queries/catalog.server.ts` still selects and types `verification_level`
  for a field no consumer reads.
- `lib/database.types.ts` types `current_legal_document` as `Returns: Row`
  rather than `Row | null`.
- `generateMetadata` and the page each call `getPublishedLegalDocument`, so a
  legal page view makes two RPC round trips; `React.cache` would collapse them.
- Duplicate section ids in a document body would produce duplicate DOM ids and
  React key collisions; nothing validates uniqueness or id charset.
- pgTAP gaps: no case for a future `effective_at` being excluded, and none for
  `authenticated` (as opposed to `service_role`) lacking write grants.
- `app/(legal)/layout.tsx` does not carry the skip target the plan's file table
  promised; no skip link exists site-wide, so this is not a regression.

## Accepted, not deferred

- The eight legal routes are in the sitemap **and** are `noindex` while
  unpublished, which produces "Submitted URL marked noindex" warnings for all
  eight. The URLs are permanent, so listing them is correct; suppressing them
  would mean editing the sitemap again at launch.
- `tests/claims-audit.test.ts` covers code, not document text. Policy bodies live
  in `legal_document_versions.body` and are published through the admin
  workflow, so the scanner structurally cannot see them. A publish-time ban
  would be wrong: counsel-approved text may legitimately need to name a phrase
  in order to disclaim it. The control for document text is the human approval
  recorded in `approved_by`, and it is the only one.
