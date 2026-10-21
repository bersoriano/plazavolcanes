# Tailwind components

Use these shared components throughout public pages, buyer and seller workspaces, authentication, messages, legal/contact, and administration.

- `Button`: actions; defaults to `type="button"`. Forms must set `type="submit"`. Variants: primary, secondary, ghost, danger, accent. Sizes: default, sm, lg, icon.
- `ButtonLink`: styled Next.js navigation. Supports normal Link props and the same variants/sizes. Use ordinary `Link` for inline text links and navigation items.
- `Input`, `Select`, `Textarea`: native controls with shared styling, disabled and invalid states. They preserve native props, refs, validation, names/values, and controlled inputs. Keep hidden fields as native `<input type="hidden">`.
- `Field`: labeled input with hint/error descriptions. Caller-provided `aria-describedby` is retained. An ID is generated when neither `id` nor `name` is supplied.
- `Card`: surface container. `as` preserves div/section/article/aside semantics; `padding` supports none, sm, md, lg; `variant` supports default, muted, brand.
- `Badge`: compact status or metadata. Variants: neutral, accent, brand, success, danger. `StatusBadge` provides listing-status labels.
- `cn`: merge Tailwind classes so page-specific overrides win over defaults.

Use `variant="unstyled"` for specialized controls such as gallery buttons, search-bar controls, marketing CTAs, or compact chips that have their own geometry. This keeps their native contract inside the shared component without imposing standard padding or layout.

Prefer standard variants for new UI. Pass `className` only for local spacing or deliberate overrides. All standard styles use shared theme tokens, including premium shop themes. Global focus rings and reduced-motion rules remain in `app/globals.css`. The seller route's separate stylesheet scans this directory as well.
