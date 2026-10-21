# Shared Tailwind components across Plaza Volcanes

Implement the requested platform-wide Tailwind component system using the existing Next.js 16.3.1, React 19, and Tailwind v4 setup.

## Scope and defaults

- Keep Plaza Volcanes' plum/lime branding, typography, Spanish copy, premium theme, responsive layouts, and existing interactions. This is the implementation default, not a requested redesign.
- Consolidate buttons, action links, inputs, selects, textareas, cards, and badges under `components/ui`.
- Adopt these primitives throughout landing pages, catalog/product/shop pages, buyer purchases/cart, seller onboarding/dashboard/shop/product/order screens, authentication/account, messages, legal/contact, and admin.
- Keep navigation links as links, actions as buttons, hidden fields native, and existing confirmation flows intact.
- Use `tailwind-merge` to let local utility overrides reliably win. Preserve specialized controls through an explicit unstyled variant.
- Keep primitives compatible with server-rendered pages; add no app-wide client boundary.
- Include shared UI sources in the seller route's separate Tailwind compilation to preserve responsive utility ordering.

## Verification

Use existing interaction tests as the behavior boundary. Add focused regression tests for native form submission, refs, controlled controls, action-link semantics, class overrides, and accessible field descriptions. Run the full unit suite, lint, typecheck, production build, and browser checks where local services permit. Document baseline/environment failures separately.
