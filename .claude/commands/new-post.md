---
description: Draft a new blog post (es-MX MDX) that passes the site's rules
argument-hint: <topic> [audience, key points, source notes, slug, length]
---

Write a new blog post for Plaza Volcanes.

Brief from the user:

$ARGUMENTS

If the brief contains finished post text, it is the post: keep the author's wording, structure and claims. Only fix typos, convert it to MDX (headings, lists, links), and write the title, description and slug from it. List any edit beyond typos in your reply, and flag (don't silently remove) anything that breaks the honesty rules below. Skip the outline step.

If the brief is empty, ask for the topic and stop. Otherwise fill the gaps yourself: infer the audience (independent shops and their buyers in Mexico), propose a slug, and aim for about 800 words unless the brief says otherwise. If the brief gives no key points, show a 4–6 point outline and wait for approval before writing.

## Files

- Create `content/posts/<slug>.mdx`. Copy the format from `content/posts/example-post.mdx`.
- Frontmatter: `title`, `description` (one sentence, under 160 characters, used for SEO), `date` (today, YYYY-MM-DD), `draft: true`. Optional: `seoTitle` (a shorter search title), `updated`.
- If the file already exists, stop and ask.

## Writing

- Write native Mexican Spanish, using *tú* with the reader, as the rest of the site does.
- Start the body with a paragraph; the page already renders the title and description. Use `##` and `###` headings, short paragraphs, and lists or a table only where they help. `<Takeaway>` boxes an optional summary at the top. Don't use raw `<` or `{` in prose (MDX reads them as JSX); put them in backticks.
- Link to site pages with plain paths (`/vender`, `/como-comprar`, `/explorar`). Link external sources with full URLs. Cite sources with footnotes (`[^1]`), which render as a "Fuentes" list.

## Honesty (non-negotiable)

- Never invent stats, shops, sellers, results, quotes, or certifications. Present scenarios as examples.
- Prices appear only as labelled illustrative examples, in MXN.
- Commission, founders-package and listing-limit claims must match the live offer in `lib/launch.ts` and `/vender`. Don't describe the plaza as processing or holding payments: the buyer pays the shop directly.
- If a point needs a number or fact the brief doesn't give, leave `[TODO: source]` instead of making one up.
- Images: only ones the user provides. Put them in `public/blog/<slug>/` and reference them with a local path and alt text.

## Finish

1. Run `npx vitest run lib/posts` and fix anything it flags.
2. Reply with the title and description, a short outline, every `[TODO]` left, and the preview URL (`/blog/<slug>` under `npm run dev`; drafts show only in development).
3. Don't commit, and don't set `draft: false`. The user publishes.
