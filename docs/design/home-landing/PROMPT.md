Restyle the home page (/) to the new design. Do not touch /vender, the header, the footer, the launch bar or the bottom nav.

Read these first, in order:
1. AGENTS.md: branch and commit rules, and the Next 16 docs in node_modules/next/dist/docs before using any data or caching API.
2. docs/design/home-landing/README.md: the spec, component by component.
3. docs/design/home-landing/desktop.html and mobile.html: the reference markup, with exact copy, spacing and sizes. Open them in a browser.
4. docs/design/home-landing/screens/*.png: what the result must look like.
5. docs/design/vender-landing/README.md §4 and §5: the token and icon mapping, which this page reuses.

Before writing any code:
- Ask me the open questions in README §6, especially what the state counts actually count and whether the hero's featured listing card should use live data.
- Then propose a short plan — which components change, which become server components, what the tests need — and wait for my OK.

Constraints:
- Same sections in the same order as today. The only structural changes are the single-message hero (the carousel goes) and the search panel moving into a card that overlaps the hero.
- Tailwind v4 utilities with the tokens in app/globals.css; no raw hex. lucide-react icons and components/brand/volcano-mark.tsx.
- Spanish copy exactly as in the reference HTML.
- The hero collage and the receipt illustration are decorative: aria-hidden with an sr-only summary, and no interactive controls inside them.
- Keep the Premium treatment (gold ring, badge, premium-coloured shop name) as it is.
- Build mobile-first. The page must match mobile.html at 390px and desktop.html at 1440px, with no horizontal scroll from 320px up.
- Update the tests listed in README §5, then run npm run lint, npm run typecheck and npm test.
- When you're done, screenshot the home page at 390 and 1440 with Playwright, compare with docs/design/home-landing/screens/, and list any differences.
