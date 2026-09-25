Implement the /vender seller landing redesign.

Read these first, in order:
1. AGENTS.md: branch and commit rules. Next 16 changed APIs, so check node_modules/next/dist/docs before using caching or data APIs.
2. docs/design/vender-landing/README.md: the spec.
3. docs/design/vender-landing/desktop.html and mobile.html: the reference markup, with exact copy, spacing and sizes. Open them in a browser.
4. docs/design/vender-landing/screens/*.png: what the result must look like.

Before writing any code:
- Ask me the open questions in README §8 that block you, especially the reputation import and the founders counter.
- Then propose a short plan: the components, the data query, the tests, and any header or footer link change. Wait for my OK.

Constraints:
- Build the page in components/sellers/ with Tailwind v4 utilities and the tokens in app/globals.css. Use no raw hex, except where README §4 allows it. Use lucide-react icons and components/brand/volcano-mark.tsx.
- Keep SiteHeader, SiteFooter and BottomNav as they are, unless I approve README §8.5.
- Use the Spanish copy exactly as it appears in the reference HTML.
- The illustrations (the receipt, the reputation card and the catalog preview) are decorative. Make them aria-hidden with an sr-only summary, and give them no interactive controls.
- Never display a hardcoded founders count. If the data is missing, hide the counter.
- Build mobile-first. The page must match mobile.html at 390px and desktop.html at 1440px, with no horizontal scroll from 320px up.
- Update the existing tests for /vender and SellerProgram, then run npm run lint, npm run typecheck and npm test.
- When you're done, screenshot the page at 390 and 1440 with Playwright, compare it with docs/design/vender-landing/screens/, and list any differences.
