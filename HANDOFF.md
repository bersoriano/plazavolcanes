# Handoff — three-column Solicitud de compra

Paste everything below the line into a fresh Claude Code session started in this worktree.

---

You are taking over a partly-executed implementation plan. The previous session ran out of
credits mid-task. Nothing is broken: the working tree is clean and every landed commit was
reviewed and passed.

## Where the work lives

- **Worktree (work here, do not cd out):** `/Users/bersoriano/dev/plaza-volcanes-shop/.worktrees/checkout-three-column`
- **Branch:** `feat/checkout-three-column-fulfillment`, currently at `c0368e2`
- **Base:** `8f93fce` on `main`
- **Spec:** `docs/superpowers/specs/2026-08-27-checkout-three-column-fulfillment-design.md`
- **Plan:** `docs/superpowers/plans/2026-08-27-checkout-three-column-fulfillment.md`
- **Ledger (read this first):** `.superpowers/sdd/2026-08-27-checkout-three-column-fulfillment/progress.md`
- **Per-task briefs, already extracted:** `.superpowers/sdd/2026-08-27-checkout-three-column-fulfillment/task-N-brief.md` for N = 1..12
- **Per-task reports:** `task-N-report.md` in the same directory

## What this builds

Plaza Volcanes is a Spanish-language (Mexico) request marketplace on Next.js 16 + Supabase.
No payment processing; delivery cost and timing are agreed in a message thread.

The purchase-request page `/carrito/[shopId]` is being rebuilt into three columns: the buyer
and how they want to receive the item on the left, the item and its per-item message thread in
the centre, the shop on the right. The buyer must choose **recolección** or **envío** — neither
is preselected — and a collected order never collects the buyer's address at all. A shop's
pickup street is withheld from the buyer until the seller accepts the order.

## Process to follow

Use the `superpowers:subagent-driven-development` skill. Its loop, verbatim:

1. Record BASE (`git rev-parse HEAD`).
2. Dispatch ONE implementer subagent per task with its brief path and a report-file path.
   Never run two implementers at once. Always specify a model explicitly.
3. On DONE, build the review package:
   `<skill-dir>/scripts/review-package <plan> <BASE> HEAD` — it prints a diff file path.
4. Dispatch a task reviewer with the brief, the report, and that diff path.
5. Critical/Important findings go to a fix loop: resume the same implementer with the
   findings verbatim, then run a scoped re-review over the fix range only. Minors go to the
   ledger as deferred, never into the loop.
6. Append a completion line to the ledger, then move on. Do not stop to check in between tasks.

The skill scripts are at:
`/Users/bersoriano/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/subagent-driven-development/scripts/`

Model guidance that worked: `sonnet` for implementers and reviewers; `haiku` for a task whose
brief contains complete code and nothing else (Task 3 went fine on it); `opus` for the final
whole-branch review.

## Completed and reviewed — do not redo

| Task | Commits | What landed |
|---|---|---|
| 1 | `ca71648` | `public.shop_pickup_points` table + `shop_pickup_point(p_shop_id)` reveal-gate function. pgTAP 10/10. |
| 2 | `470a394`, `a352b8c` | `orders.fulfillment_method`, `alt_contact_*`, `checkout_cart_v3`, `checkout_cart_internal_v2`. pgTAP plan(12). |
| 3 | `2b8c9aa` | `pickupPointSchema` + `PickupPointInput` in `lib/validation/shop.ts`. |
| 4 | `78cfd98` | Recolección block in `components/shops/shop-form.tsx`. |
| 5 | `8657cd8`, `157d373` | `lib/actions/shop-pickup-point.ts` (`pickupPointFrom`, `pickupValidationError`, `savePickupPoint`), wired into both shop actions and the seller page. |
| 6 | `2569059` | `lib/queries/checkout.ts` (`PickupPoint`, `parsePickupPoint`, `hasFullAddress`) and `lib/queries/checkout.server.ts` (`fetchPickupPoint`, `fetchCartThreads`, `fetchBuyerProfile`, `CartThread`). |

`a548367` is a docs-only commit correcting the plan.

Current suite: **100 files / 605 tests passing**; `npx supabase test db` green; typecheck and lint clean.

## START HERE — Task 7 fix round 1, both findings OPEN

Task 7 landed `c0368e2` (`components/orders/fulfillment-choice.tsx` + its test, 5/5 passing) and
was reviewed. The review returned **spec ✅, quality "Needs fixes"** with two Important findings.
A fix round was dispatched and **died on the rate limit before making a single edit**. Verified:
working tree clean, `aria-label` still at `fulfillment-choice.tsx:67,84`, shipping block still
conditionally rendered at `:127`.

Re-dispatch the fix as a fresh implementer against `task-7-brief.md`, carrying these two findings
and the exact repair shapes already ruled on. Then run a scoped re-review over the fix range.

### Finding 1 (Important) — `aria-label` drops the privacy sentence from the accessible name

`components/orders/fulfillment-choice.tsx`, the two radio inputs.

Background: the plan's own component failed its own tests, because each radio's short name and
its longer description sit inside one `<label>`, so exact-match `getByLabelText` saw the
concatenated string. The previous implementer patched it with `aria-label`. That works for the
test, but `aria-label` wins the accessible-name computation over the label's content, so a
screen-reader user hears "Recolección en tienda" / "Envío a domicilio" and never hears
"Vas por él y no compartes tu dirección." / "Solo esta tienda y tú verán tu dirección." That
sentence is the one thing distinguishing the options on the axis this component exists to
protect — whether a stranger learns the buyer's home address.

Required fix: remove `aria-label` from both radios. Give the name `<span>` and the description
`<span>` each an id (`pickup-name`/`pickup-desc`, `shipping-name`/`shipping-desc`); put
`aria-labelledby` at the name span and `aria-describedby` at the description span on each input.
The accessible name stays short so `getByLabelText("Recolección en tienda")` still matches
exactly, and the description is announced as a description rather than discarded.

Add a test asserting each radio's `aria-describedby` resolves to the element carrying the
description text, so the regression cannot come back silently.

### Finding 2 (Important) — the typed address is destroyed by toggling to pickup and back

`components/orders/fulfillment-choice.tsx`, the `{method === "shipping" ? ... : null}` block.

The address `Field`s are uncontrolled with `defaultValue` from the last server-action result.
Switching to pickup unmounts them; switching back remounts fresh nodes with the stale default.
A buyer who fills in their address, clicks "Recolección en tienda" to see what collection
involves, then clicks back has to retype everything, unwarned.

Required fix: keep the fields mounted and make them inert. Wrap the block in a `<fieldset>`
carrying BOTH `hidden` and `disabled` when `method !== "shipping"`.

`disabled` is not optional and `hidden` alone is wrong. Disabled descendants keep their DOM
values (so the typing survives) but are not submitted — and that second half matters, because
`checkout_cart_v3` refuses a pickup order carrying a delivery address. A hidden-but-enabled
field would post a stale address on a pickup submission and turn a valid request into a
database error.

`Field` spreads props onto its input and the form already carries `noValidate`, so the
`required` attributes will not block submission while the fieldset is hidden.

Add tests: choose shipping, type into "Calle y número", switch to pickup, switch back, assert
the value survived; and assert the fieldset is `disabled` while pickup is selected.

Both Minor findings on Task 7 are deferred. Do not act on them.

## Then run Tasks 8–12 normally

Briefs are already extracted. Nothing has been started on any of them.

- **Task 8** — `BuyerPanel` and `ShopPanel` (`components/orders/`). `TrustBadges` takes
  `metrics` and `profile`; `getPublicShop` supplies `trust_tier`, `trust_metrics`, `imageUrl`.
- **Task 9** — `CartThreads` tabs (`components/orders/cart-thread.tsx`), plus adding a third
  `returnTo` parameter to `openConversation` in `lib/actions/start-conversation.ts` and updating
  every existing caller to pass `null`. Rendering must never open a conversation — a render is a
  GET; `start_pre_sale_conversation` is called only from the explicit button.
- **Task 10** — the page rewrite, `checkoutCart` moved onto `checkout_cart_v3`, `altContactSchema`
  and `fulfillmentMethodSchema` added to `lib/validation/commerce.ts`, `CartItems` extracted, and
  `components/orders/checkout-form.tsx` deleted. Largest task; consider `opus`.
- **Task 11** — `FulfillmentSummary` on `/compras/[id]` and `/panel/pedidos/[id]`, plus
  `fulfillment_method` and `alt_contact` carried through `getOrderDetail`, `mapOrderDetailRow`
  and `OrderDetail`. **Task 11 owns `lib/queries/orders.types.ts`** — Task 6 was ruled off it.
- **Task 12** — the two Playwright end-to-end paths. Note both tests need a published product;
  copy those steps from the existing first test in `tests/e2e/purchase-intent.spec.ts` rather
  than factoring a helper.

Then the final whole-branch review on `opus`, using
`superpowers:requesting-code-review`'s `code-reviewer.md` over
`review-package <plan> 8f93fce HEAD`. Point it at the ledger's deferred-minor and parked lines.
Then `superpowers:finishing-a-development-branch`.

## Global constraints — these bind every task

- **This is not the Next.js you know.** Read the relevant guide in `node_modules/next/dist/docs/`
  before writing component or route code. `AGENTS.md` requires it.
- All user-facing copy is Spanish (Mexico), **including database exception messages**.
- Every new `public.` SQL function: `security definer`, `set search_path = ''`, `revoke` from
  `public, anon`, `grant execute` to `authenticated`. `private.` functions revoke from
  `authenticated` too. Copy `public.checkout_cart_v2`'s shape.
- Migrations only via `npx supabase migration new <name>`. Never a hand-invented filename.
- `lib/database.types.ts` is **hand-written**. Mirror every schema change by hand.
- Money is `numeric(14,2)`. No floating point.
- Never a `pickup_enabled` boolean — a `shop_pickup_points` row's existence is the flag.
- `MEXICO_ADMINISTRATIVE_AREAS` entries are `{ code, slug, label }`. There is no `name` field.
- Commands: `npm test`, `npx supabase test db`, `npm run typecheck`, `npm run lint`,
  `npm run test:e2e`. The local Supabase stack is running and `linked_project` is null — keep it
  that way; never touch the remote project.

## Plan defects already found, so you know what to expect

The plan has been wrong four times, each caught by an implementer or reviewer rather than by the
pre-flight scan. Treat its code blocks as a strong draft, not as gospel — if a brief's code does
not compile or does not pass the brief's own tests, that is a plan defect to rule on, not a
mistake to work around silently. The four so far:

1. `orders.fulfillment_method` NOT NULL with no default broke nine existing pgTAP fixtures and
   the legacy v1 `checkout_cart` path the plan never mentioned.
2. A pgTAP product fixture omitted `category_id`, now required by a leaf-category trigger.
3. `area.name` was read in three places; the module exposes `label`. Fixed in the plan at
   `a548367`.
4. Task 7's component and its tests disagreed about the accessible name — Finding 1 above.

## One deferred item worth raising at the final review

`public.checkout_cart` (v1) now has no remaining application caller — `lib/actions/cart.ts` uses
v2, and Task 10 moves it to v3. Retiring v1 would also delete the ~90 duplicated lines between
`private.checkout_cart_internal` and `private.checkout_cart_internal_v2`. It was deliberately
left alone during the tasks; the final review should decide.

The ledger holds fourteen other deferred minors. Read it before the final review.
