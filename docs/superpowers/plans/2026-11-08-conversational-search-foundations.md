# Conversational search foundations implementation plan

Goal: turn supported shopping phrases into validated, reproducible catalog searches.
Stack: existing Next.js server-rendered catalog, Zod, Supabase Postgres and Vitest.
Spec: docs/superpowers/specs/2026-11-08-conversational-search-foundations-design.md

- [x] Build the pure criteria parser, refinement and URL codec in lib/search. Test strict budgets, literal brands, bilingual attributes, errors, and round trips.
- [x] Add optional listing attributes to seller create/edit and type definitions. Exercise seller edits, omitted fields, and controlled values.
- [x] Add an additive ranked RPC and database constraints. Verify eligible rows before limit, bilingual retrieval, visibility and compatibility.
- [x] Connect criteria to existing catalog reads, fallback, navigation, metadata, telemetry and result feedback. Exercise state return, invalid and price-only searches, and hydration of changed products.
- [x] Run focused and full checks, inspect migration and final diff, and record environment limitations.

Use MXN, a 500-character request limit, existing publication rules, and three-state waterproofing. Watch for old clients clearing attributes, contradictory bounds, delayed price updates, filters surviving resets, and founder promotion bypassing criteria.

Verification on 2026-11-08: all 2,239 Vitest cases and 1,039 pgTAP assertions passed with the pinned project dependencies. Typecheck, lint, and the production build passed. Chromium exercised seller attribute creation, recovery, clearing, and an anonymous buyer finding a 99.99 MXN chamarra, returning to the Jalisco results and removing only waterproofing.

Database verification used local Supabase. Two local identity sequences were advanced past existing fixture IDs to run the browser flows. Local thumbnail requests returned 404 during browser testing; image rendering was outside those assertions. The build reported the existing pre-launch legal document configuration. Apply the additive database migration before deploying the app.
