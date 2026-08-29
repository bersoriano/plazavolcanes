# Shop Publication Moderation — Design Specification

## Objective

Separate seller publication intent from administration publication approval. A product becomes publicly usable only when its seller has published it, its shop is approved, its product-level administration gate is enabled, and its lifecycle permits public display.

## Scope and Non-Goals

This project includes shop-level administration approval, product-level administration moderation backend, seller publication controls, effective-visibility enforcement, expiration behavior, admin and seller UI, and database/application tests.

This project does not include:

- Product-level administration switch UI
- Moderation reasons, comments, notifications, or audit dashboard
- Private Storage, signed URLs, Storage-policy changes, or image URL changes
- Private shop pages, seller-content deletion, or service-role browser access

`catalogo` remains public. Hiding a product prevents new marketplace discovery and commerce actions; it does not revoke an existing public image URL. Private images remain separate future work.

## Approved Policy Decisions

- Seller-controlled product states remain `draft`, `published`, `expired`, and `deleted`.
- `products.status` is seller intent/lifecycle, not effective public state.
- `shops.is_publishing_approved` is an administrator-controlled shop gate.
- `products.is_admin_enabled` is an administrator-controlled product gate.
- Effective public visibility is derived, never stored:

  ```text
  product.status = 'published'
  AND shop.is_publishing_approved
  AND product.is_admin_enabled
  AND product is neither expired nor deleted
  ```

- Listing capacity counts seller-enabled products (`status = 'published'`) even while approval or administration gates hide them.
- New non-admin shops start unapproved. New shops owned by a current `private.admin_users` member start approved. Removing admin role does not rewrite existing approval.
- New products always start `draft`; client-supplied creation status is ignored or forced to draft.
- Shop/product administration changes preserve seller status. Re-enabling makes a product public only when every other gate is true.
- Existing orders, order items, conversations, and disputes stay readable by their current participants. Current hidden product representation may state “Ya no disponible”.

## Architecture

Database rules are source of truth. RLS protects row reads, triggers protect moderation columns from ordinary Data API writes, and narrowly scoped security-definer RPCs carry administration mutations. Server Actions validate input and authorization again, call those RPCs, then revalidate public/admin/seller routes.

Every public read path must apply the same effective-visibility predicate. RLS is defense in depth for ordinary product and dependent-row queries. SQL RPCs and security-definer commerce/search functions must include explicit predicates because they can bypass RLS. Application queries retain explicit filtering for correctness, index use, and safe direct-route behavior.

No central stored `is_public` flag or materialized view is introduced. A small private predicate helper may be used in RLS only if it remains schema-qualified, stable, caller-safe, and does not conceal authorization from security-definer commerce functions. Those functions retain their explicit joins to `public.shops` and checks of both moderation fields.

## Data Model and Database Enforcement

### Columns

Add to `public.shops`:

- `is_publishing_approved boolean not null default false`

Add to `public.products`:

- `is_admin_enabled boolean not null default true`

Existing product statuses and all existing product rows remain intact. Existing products receive an enabled administration gate.

### Creation safeguards

A before-insert shop trigger determines approval from `private.admin_users` using actual `NEW.owner_id`; it overwrites any client-supplied approval value. This enforces the owner-role default in PostgreSQL rather than trusting application code or editable user metadata.

A before-insert product trigger forces `NEW.status = 'draft'` for ordinary authenticated product creation and leaves `is_admin_enabled` true. Trusted migration/maintenance execution remains narrowly identified by database role. Seller tests create then transition products instead of inserting published rows.

### Moderation safeguards and RPCs

A products guard trigger rejects ordinary changes to `is_admin_enabled`. A shops guard trigger rejects ordinary changes to `is_publishing_approved`; it combines safely with existing system-managed trust-field protection. Both allow only trusted security-definer administration functions to change their corresponding column.

Add these public RPC entry points:

- `set_shop_publishing_approval(p_shop_id bigint, p_enabled boolean)`
- `set_product_admin_enabled(p_product_id bigint, p_enabled boolean)`

Each is `security definer`, sets `search_path = ''`, schema-qualifies every object, requires non-null authenticated identity and `public.is_current_user_admin()`, and raises a Spanish authorization error otherwise. Both revoke default execution from `PUBLIC` and `anon`, grant only `authenticated`, update only intended moderation field plus required timestamps, and return safe affected identity/slug data for cache revalidation. Neither returns data from `private.admin_users`.

### RLS and dependent rows

Replace public product select condition with effective visibility. Shop owners retain access to all of their non-deleted/hidden product rows as panel workflow needs. Update `product_images`, `product_translations`, and other product-owned public relations found during implementation so public reads follow product effective visibility while owners retain their own rows.

Shops remain publicly readable. An unapproved shop page may render shop data but must show no hidden products.

## Migration and Expiration

Use `supabase migration new` to create the migration filename. Migration order is:

1. Add moderation columns and safe defaults.
2. Backfill shop approval true only for shops whose owner currently exists in `private.admin_users`; set all other existing shops false.
3. Backfill product administration gate true without changing status.
4. Install safeguards, RPCs, revised RLS/dependent policies, SQL function replacements, and indexes.
5. Reconcile listing expiration atomically.

Published products behind newly unapproved shops must stop appearing immediately and must not consume public listing time. Their expiration is cleared or suspended. Existing published products in approved admin-owned shops preserve valid expiration. Approving a shop assigns eligible seller-published/admin-enabled products a fresh 30-day window; disabling preserves seller status. Reapproval may refresh eligible products. Future product gate enable can refresh that product’s listing window. Drafts have no active expiration; cron must expire only listings with an active public window.

Existing product-expiry trigger and cron are updated together. Publication inside an unapproved shop records seller intent without starting 30 days. Seller publication in an approved shop starts fresh 30 days. Expired products remain hidden until seller reactivates them.

Review current published partial indexes. Add only indexes matched by updated queries: seller-published/admin-enabled products by shop, effective catalog join paths, and active-expiration scans.

## Public and Commerce Paths

Audit every current `status = 'published'` query and replace it with effective visibility or rely on revised RLS only when equivalent and test-covered. Required paths include:

- Homepage catalog, filtering, search RPC/fallback, state counts, and shop product lists
- Direct product detail routes, metadata, sitemap, and social sharing data
- Search selection recording
- Cart insertion and cart validation
- Checkout availability and purchase-intent creation
- Pre-sale conversation creation
- Security-definer functions referencing published products

New discovery and commerce requests against hidden products fail. Historical reads do not re-run current visibility gates against stored order/conversation records.

## Server Actions and UI

### Seller actions

`createProduct` validates seller-owned shop but always creates `draft`, excluding moderation values and forged publish status from the insert. Creation form has one save action and explains product is saved hidden first.

`updateProduct` changes seller-owned fields only and never spreads arbitrary form data into moderation columns. `setProductStatus` keeps ownership/category/listing-limit checks and changes seller intent only. Its success message distinguishes immediate publication from pending shop approval.

Seller product panels derive state from all gates:

- `Desactivado por ti`
- `Esperando aprobación de administración`
- `Tienda deshabilitada por administración`
- `Publicado`
- `Deshabilitado por administración`
- `Vencido`

“Ver publicación” appears only for effective-public products. Sellers still see their own existing public-bucket images for hidden products.

### Administration

Add an accessible, controlled shop switch to every shop in `/admin/usuarios`. It has clear checked state and Spanish labels: enabled “Publicaciones habilitadas”, disabled “Publicaciones pendientes”, plus explanation “Deshabilitar la tienda oculta sus productos sin cambiar las decisiones del vendedor.”

Its Server Action validates bigint ID and boolean input, independently rechecks admin authorization, calls `set_shop_publishing_approval`, returns Spanish pending/success/error status, and performs no optimistic state update. It revalidates `/`, `/admin/usuarios`, affected shop/product routes, sitemap/relevant cache tags, and seller route as appropriate.

Extend `list_admin_marketplace_users()` and generated types/mappers with shop approval, product admin gate, seller status, and data needed to derive effective public visibility. Admin rows distinguish draft, seller-published awaiting approval, public, administration-disabled, and expired entries. Public product links appear only for effective-public rows. No product-level switch renders yet.

## Testing and Verification

Follow focused TDD: failing test, observe failure, minimal implementation, passing focused test, refactor only green. Database tests prove defaults/backfill, forged writes blocked, RPC authorization and behavior, RLS gates, expiration reconciliation, hidden-commerce rejection, and historical readability.

Application tests cover mappings, effective state labels, accessible switch behavior/checked state, action authorization/RPC arguments/errors, draft-only creation, direct/catalog/shop queries, and public-link rules. Existing publication, listing-limit, expiration, deletion, checkout, and message tests continue passing.

Final verification runs:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- Repository-supported Supabase database tests
- `supabase db lint` / applicable database advisors
- `npm run build`
- Relevant Playwright flows when local Supabase supports them

Verification also searches for remaining published-only product gates, validates generated database types and migration ordering, confirms no service-role client appears in browser code, and confirms no private-image migration/signing work was introduced.
