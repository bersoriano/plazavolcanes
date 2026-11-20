# Landing: the newest posts, not just one

Date: 2026-11-19
Status: approved in chat

## Problem

The landing's "Del blog" section briefs only the newest published post. With a
second post live (`tienda-propia-o-mercado-libre`), the first one
(`cuanto-te-queda-al-vender-en-mercado-libre`) dropped off the landing and is
reachable only from `/blog`.

## Design

Featured + list, inside the existing lime card (`#articulo`):

- **Featured:** the newest post, unchanged: eyebrow, display h2 title,
  description, "Leer el artículo" button.
- **Older posts:** up to two more, as compact rows under a divider in the same
  card. Each row is one link (accessible name = the post title) with the title
  at h3 size, the date (`formatPostDate`, in a `<time>`), and an arrow.
- **"Ver todo el blog":** a link to `/blog` under the card, whenever the
  section shows.
- **Limit:** the newest 3 published posts (`LANDING_POSTS = 3`). With one post,
  the section looks as it does today plus the "Ver todo el blog" link.
- **Labelling:** the region is labelled by its eyebrow, "Del blog", since it
  now holds more than one post.

## Data flow

`app/page.tsx` already reads `getPosts()` (sorted newest first, drafts hidden in
production). It passes the list to `HomeLanding` as `posts` instead of
`latestPost = posts[0]`; `LandingArticle` takes the first `LANDING_POSTS`.

## Constraints

- The global stylesheet has about 3 KB of headroom before Turbopack splits the
  font CSS out (+0.3 s mobile FCP). Reuse classes the site already uses; after
  the change, `next build` must still link one stylesheet on `/`.

## Tests

- `landing-article.test.tsx`: featured post briefed with its button; older
  posts as links to their pages with their dates; at most 3 posts; the
  "Ver todo el blog" link; a single post shows no list.
- `home-landing.test.tsx` / `app/page.test.tsx`: the landing passes every
  post through and the section disappears when there are none.
