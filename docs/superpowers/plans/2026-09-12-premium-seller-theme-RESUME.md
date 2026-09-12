# Premium Seller Theme — Resume Notes

Paused 2026-09-12 on branch `feat/premium-seller-theme`, working tree clean at `48951d3`.

- Spec: `docs/superpowers/specs/2026-09-12-premium-seller-theme-design.md`
- Plan: `docs/superpowers/plans/2026-09-12-premium-seller-theme.md`
- Execution ledger (rulings, deferred minors, per-task commits): `.superpowers/sdd/2026-09-12-premium-seller-theme/progress.md`
- Task briefs for every remaining task are already extracted in that same directory as `task-N-brief.md`

Execution method: superpowers:subagent-driven-development — one implementer per task, then a task review, then a fix loop until clean.

## Done

| Task | Commits | State |
| --- | --- | --- |
| 1 — token gaps (`--photo-backdrop`, `--on-brand`, `--surface-raised`) | `cf15db1`, `fff1eca` | reviewed clean |
| 2 — `shops.is_premium` + guards + `set_shop_premium` RPC | `a538872`, `59ac0e3` | reviewed clean |
| 3 — types and query plumbing | `9a394d5` | reviewed clean |
| 4 — `[data-theme="premium"]` scope, `PremiumScope`, Fraunces | `cab1a7e`, `46774a0` | reviewed clean |
| 5 — `PremiumBadge` | `46ea5cd` | reviewed clean |
| 6 — premium public shop page | `48951d3` | **implemented, NOT reviewed** |

## Resume here

1. Review Task 6 before anything else:
   `scripts/review-package <plan> 46ea5cd 48951d3`, then dispatch the task reviewer with `task-6-brief.md` and `task-6-report.md`.
2. Then Tasks 7-11, each implement → review → fix loop:
   - **7 — product page.** Scope wrapper when `product.shop.is_premium`; badge beside the shop backlink.
   - **8 — catalog cards.** Deliberate exception: cards keep the light surface and gain a gold ring on the image plus an obsidian chip with gold `Premium` text. A dark card in a light grid reads as a layout defect.
   - **9 — seller panel header.** Badge and a line confirming the distinction; forms stay light.
   - **10 — admin control.** `setShopPremium` server action mirroring `setShopPublishingApproval`, plus the switch in `/admin/usuarios`. Until this ships, nothing can grant the status through the UI.
   - **11 — verification.** Full suite, lint, typecheck, build, `npx supabase test db`, a repo-wide grep for hardcoded colors inside premium subtrees, and a real-browser contrast pass at phone and desktop width.
3. Then a whole-branch review on the most capable model, then superpowers:finishing-a-development-branch.

## Carry these into the remaining work

- **`TrustTierBadge` tooltip contrast.** `components/shops/trust-tier-badge.tsx:28` uses `text-white` on `bg-brand-hover`. Inside the premium scope `--brand-hover` becomes light gold `#f2d894`, so white-on-light-gold fails contrast. The badge renders on the shop page (Task 6, already shipped) and the product page (Task 7) — fix it in Task 7 or 11, not by overriding one component's color but by giving the tooltip a token that works in both themes.
- **Deferred minors**, all recorded in the ledger, for the final review to triage: the date-dependent pre-existing failure in `components/products/product-row.test.tsx` (asserts `/Vence el/` against a fixture expiring 2026-09-20; predates this branch); no test for `set_shop_premium`'s `P0002` missing-shop branch; `lib/queries/admin.test.ts` `base` fixture uses an `as AdminMarketplaceRpcRow` cast that hides new required members; redundant `color: var(--text)` in the scope block; `premium-badge.tsx` tooltip uses a literal `#f5f1ea`.
- **Two plan defects already corrected** — do not reintroduce them. The scope must override `--font-bricolage`, not `--font-display`, because `@theme inline` bakes the value into the compiled utility (verified empirically twice). And `plan(15)` in the pgTAP test was a miscount; it is now 17 after the INSERT regression.
- **One ruling of mine was wrong:** I claimed `getByText("Nivel Estándar")` could not match across two text nodes. Testing Library joins sibling text nodes, so it would have. The regex now in the test is harmless.

## Environment

Docker (colima) and the local Supabase stack were started for the pgTAP runs and may still be up. `npx supabase test db` baseline before this work: Files=30, Tests=626. After Task 2: Files=31, Tests=643.

Another Claude session shares this single checkout (`git worktree list` shows one tree), and it moved this branch's HEAD once mid-session — a plan commit landed on its branch and had to be cherry-picked back. Before resuming, confirm `git branch --show-current` and that the tree is clean, and keep every commit path-scoped.
