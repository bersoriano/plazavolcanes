# Conversational search foundations implementation plan

Goal: turn supported shopping phrases into validated, reproducible catalog searches.
Stack: existing Next.js server-rendered catalog, Zod, Supabase Postgres and Vitest.
Spec: docs/superpowers/specs/2026-11-08-conversational-search-foundations-design.md

- [ ] Build the pure criteria parser, refinement and URL codec in lib/search. Test strict budgets, literal brands, bilingual attributes, errors, and round trips.
- [ ] Add optional listing attributes to seller create/edit and type definitions. Exercise seller edits, omitted fields, and controlled values.
- [ ] Add an additive ranked RPC and database constraints. Verify eligible rows before limit, bilingual retrieval, visibility and compatibility.
- [ ] Connect criteria to existing catalog reads, fallback, navigation, metadata, telemetry and result feedback. Exercise state return, invalid and price-only searches, and hydration of changed products.
- [ ] Run focused and full checks, inspect migration and final diff, and record environment limitations.

Use MXN, a 500-character request limit, existing publication rules, and three-state waterproofing. Watch for old clients clearing attributes, contradictory bounds, delayed price updates, filters surviving resets, and founder promotion bypassing criteria.
