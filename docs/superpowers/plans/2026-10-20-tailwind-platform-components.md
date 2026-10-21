# Shared Tailwind Components Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation. Track each deliverable below.

**Goal:** Adopt reusable Tailwind components across every platform area.

**Architecture:** Extend `components/ui` around native HTML and Next Link. Merge utility overrides with tailwind-merge; preserve existing business logic and specialized layouts.

**Tech Stack:** Next.js 16.3.1, React 19, TypeScript, Tailwind v4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-tailwind-platform-components-design.md`

## Global Constraints

- Work on `codex/tailwind-platform-components`; no worktrees or main changes.
- Preserve branding, premium tokens, content, responsive behavior, native semantics, and confirmation flows.
- Hidden inputs remain native; visual controls use shared components.

## Review Focus

- Button default types must not cause unintended form submissions.
- Controlled fields, refs, browser constraints, and action names/values must survive extraction.
- Merged classes must preserve mobile/responsive overrides and premium theme contrast.
- Accessible field descriptions must include caller-provided hints and generated errors.
- Seller stylesheet must scan shared UI, preventing later utilities from undoing responsive classes.

### Task 1: Shared primitive contracts

- [x] Add focused regression tests; observe failures.
- [x] Extend Button and add ButtonLink, Input, Select, Textarea, Card, Badge, and class helper.
- [x] Update Field and StatusBadge to compose primitives; verify targeted tests.
- [x] Commit `feat(ui): add shared Tailwind component primitives`.

### Task 2: Platform-wide adoption

- [x] Replace visible native form controls and action links while retaining props and handlers.
- [x] Consolidate repeated card and badge styling across public, buyer, seller, messaging, legal, and admin areas.
- [x] Include shared UI sources in seller stylesheet; document component usage.
- [x] Run existing interaction tests, lint, typecheck, and production build.
- [x] Commit `refactor(ui): adopt Tailwind components across the platform`.

### Task 3: Browser verification and review

- [x] Inspect desktop/mobile public pages and existing buyer/seller E2E coverage where services permit.
- [x] Review diff for semantics, missing imports, styling overrides, and confirmation changes.
- [x] Record final verification results and commit any required repairs.

## Baseline evidence

Before edits: 243 test files / 2062 tests passed. `scripts/e2e-env.test.ts` failed its ephemeral-loopback assertion under sandbox restrictions. No product changes existed at baseline.


## Final evidence

- Shared components used by 109 application/component files: 78 Button, 42 ButtonLink, 30 Input, 17 Select, 15 Textarea, 42 Card, 25 Badge usages, plus existing Field/EmptyState consumers.
- No visible native buttons/selects/textareas/inputs remain outside UI primitives. Hidden form inputs and the invisible contact honeypot remain native.
- Full suite: 245 files, 2069 tests passed with local-port access. Lint and TypeScript passed.
- Production build passed using `npm run build -- --webpack`. Turbopack's build worker could not bind a port in this environment; Turbopack development preview worked.
- Corrected a pre-existing seller-orders page default-props signature rejected by Next.js production type checks; test callers now pass `{}` like the framework.
- Browser checks: landing at 320/390/1440px, seller page at 390/1440px, login form at 320px, premium shop at 320px. No horizontal overflow. Seller-to-home client navigation preserved responsive header/CTA styling. Login fields measured 48px tall, actions 44px; premium share controls retained gold text and dark surfaces.
- Fresh reviewer found no actionable regression in semantics, refs, forms, class composition, or server/client boundaries.
- Authenticated buyer/seller flows were covered by the existing unit interaction suite. Full authenticated E2E was not run: no local backend stack was listening.
- Existing legal pre-launch warning remains: unpublished documents and unset identity variables. No legal/database configuration changed.
