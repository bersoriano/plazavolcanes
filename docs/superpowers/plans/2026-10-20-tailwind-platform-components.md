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

- [ ] Add focused regression tests; observe failures.
- [ ] Extend Button and add ButtonLink, Input, Select, Textarea, Card, Badge, and class helper.
- [ ] Update Field and StatusBadge to compose primitives; verify targeted tests.
- [ ] Commit `feat(ui): add shared Tailwind component primitives`.

### Task 2: Platform-wide adoption

- [ ] Replace visible native form controls and action links while retaining props and handlers.
- [ ] Consolidate repeated card and badge styling across public, buyer, seller, messaging, legal, and admin areas.
- [ ] Include shared UI sources in seller stylesheet; document component usage.
- [ ] Run existing interaction tests, lint, typecheck, and production build.
- [ ] Commit `refactor(ui): adopt Tailwind components across the platform`.

### Task 3: Browser verification and review

- [ ] Inspect desktop/mobile public pages and existing buyer/seller E2E coverage where services permit.
- [ ] Review diff for semantics, missing imports, styling overrides, and confirmation changes.
- [ ] Record final verification results and commit any required repairs.

## Baseline evidence

Before edits: 243 test files / 2062 tests passed. `scripts/e2e-env.test.ts` failed its ephemeral-loopback assertion under sandbox restrictions. No product changes existed at baseline.
