# Shop Publication Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Require seller publication, shop approval, and product administration enablement for every public product while preserving seller intent and historical commerce data.

**Architecture:** PostgreSQL owns defaults, moderation authorization, expiry, RLS, Storage read authorization, and privileged commerce checks. Next.js actions call protected RPCs; server reads create short-lived signed media URLs; UI renders derived state.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Supabase/Postgres, pgTAP, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-08-28-shop-publication-moderation-design.md

## Global Constraints

- Preserve unrelated work; use apply_patch for all edits.
- Create migration with: npx supabase migration new shop_publication_moderation. Use generated filename.
- Security-definer functions use empty search path, qualified names, internal authorization, revoked default execution, and minimum grants.
- New products insert as draft; seller forms never send moderation fields.
- catalogo becomes private. Server code batches five-minute signed URLs; no service-role browser use.
- Public visibility requires published seller status, approved shop, admin-enabled product, and an active non-expired listing window.
- Listing capacity deliberately counts seller-published products even if administration hides them.
- Each task begins with a focused failing test and ends green.

---

### Task 1: Database moderation schema, defaults, and protected RPCs

**Files:**
- Create: generated supabase/migrations/<timestamp>_shop_publication_moderation.sql
- Modify: supabase/tests/database/marketplace_rls.test.sql
- Modify: supabase/tests/database/admin_marketplace_users.test.sql
- Modify: supabase/tests/database/product_expiry.test.sql

**Interfaces:**
- Produces: shops.is_publishing_approved, products.is_admin_enabled, set_shop_publishing_approval(bigint, boolean), set_product_admin_enabled(bigint, boolean).
- Consumed by: Tasks 2–7.

- [ ] **Step 1: Write failing pgTAP assertions**

  Add column/default assertions. Create admin and non-admin users; assert a non-admin owned shop starts false and a current-admin owned shop starts true. Insert a product carrying status published and assert persisted status draft. Assert direct seller update attempts to both moderation fields fail. Assert anonymous/non-admin RPC calls fail and admin RPC calls preserve status while changing only moderation field.

- [ ] **Step 2: Confirm failure**

  Run:
  
      npx supabase test db --file supabase/tests/database/marketplace_rls.test.sql
  
  Expected: missing columns/functions.

- [ ] **Step 3: Generate migration**

  Run:
  
      npx supabase migration new shop_publication_moderation
  
  In generated file add columns/backfill:
  
      alter table public.shops
        add column is_publishing_approved boolean not null default false;
      alter table public.products
        add column is_admin_enabled boolean not null default true;
      update public.shops s
      set is_publishing_approved = exists (
        select 1 from private.admin_users a where a.user_id = s.owner_id
      );
      update public.products set is_admin_enabled = true;

- [ ] **Step 4: Add creation and column guards**

  Add shop before-insert trigger deriving approval from private.admin_users and overwriting forged value. Add product before-insert trigger that forces draft and true administration gate for ordinary app-role creation. Extend existing system-managed-column guard or add narrow guards so authenticated owners cannot update approval/admin enablement; security-definer RPC execution can.

- [ ] **Step 5: Add secured RPCs**

  Each function checks auth.uid and public.is_current_user_admin(), updates only intended field plus updated_at, returns id/slug/shop data required for revalidation, has search_path empty, and runs:
  
      revoke all on function public.set_shop_publishing_approval(bigint, boolean) from public, anon;
      grant execute on function public.set_shop_publishing_approval(bigint, boolean) to authenticated;

  Repeat for product function.

- [ ] **Step 6: Run focused tests and commit**

      npx supabase test db --file supabase/tests/database/marketplace_rls.test.sql
      npx supabase test db --file supabase/tests/database/admin_marketplace_users.test.sql
      git add supabase/migrations supabase/tests/database
      git commit -m "feat: add publication moderation database gates"

### Task 2: Effective visibility, expiry, and privileged commerce enforcement

**Files:**
- Modify: generated moderation migration
- Modify: supabase/tests/database/categories_search.test.sql
- Modify: supabase/tests/database/commerce_foundation.test.sql
- Modify: supabase/tests/database/product_conversations.test.sql
- Modify: supabase/tests/database/product_images.test.sql
- Modify: supabase/tests/database/product_expiry.test.sql

**Interfaces:**
- Produces: effective product SELECT policy; all discovery/commerce SQL functions reject hidden products; expiry only runs for active public windows.

- [ ] **Step 1: Write failing database tests**

  For each individual false gate, assert anon cannot select published product and owner can select own hidden product. Assert product images/translations follow same public visibility. Assert hidden product cannot be added to cart, checked out, used for purchase intent/pre-sale, or selected in search telemetry. Assert existing order/conversation history remains readable.

- [ ] **Step 2: Confirm failure**

      npx supabase test db --file supabase/tests/database/commerce_foundation.test.sql
      npx supabase test db --file supabase/tests/database/product_conversations.test.sql

- [ ] **Step 3: Replace policy and SQL predicates**

  Public product and dependent-row policy requires:
  
      products.status = 'published'
      and products.is_admin_enabled
      and shops.is_publishing_approved
      and products.expires_at > now()

  Owner branch remains separate. Update search_product_ids, catalog_state_counts, record_search_selection, add_cart_item, checkout functions, purchase-intent function, and start_pre_sale_conversation. Security-definer functions contain explicit joins/conditions; do not rely solely on RLS.

- [ ] **Step 4: Reconcile expiration**

  Replace private.set_product_expiry and private.expire_due_products so published-but-unapproved products carry null expiry; approval enables eligible products for 30 days; disabling preserves status and suspends expiry; reapproval/admin reenable refresh eligible 30-day window. Preserve valid current expiry of existing approved admin-owned listing.

- [ ] **Step 5: Index only current query paths**

      create index if not exists products_publication_gate_by_shop_idx
        on public.products (shop_id, created_at desc)
        where status = 'published' and is_admin_enabled;
      create index if not exists products_active_publication_expiry_idx
        on public.products (expires_at)
        where status = 'published' and is_admin_enabled and expires_at is not null;

- [ ] **Step 6: Run files green and commit**

      npx supabase test db
      git add supabase/migrations supabase/tests/database
      git commit -m "feat: enforce effective product visibility"

### Task 3: Admin RPC model, generated types, mapping, and action

**Files:**
- Modify: generated moderation migration
- Modify: lib/database.types.ts
- Modify: lib/queries/admin.ts
- Modify: lib/queries/admin.test.ts
- Modify: lib/queries/admin.server.test.ts
- Create: lib/actions/admin-publication.ts
- Create: lib/actions/admin-publication.test.ts

**Interfaces:**
- Produces: AdminMarketplaceShop.isPublishingApproved, AdminMarketplaceProduct.isAdminEnabled/effectiveVisibility, setShopPublishingApproval action.

- [ ] **Step 1: Write failing TypeScript tests**

  Extend admin RPC row fixtures with shop approval, product admin gate, and expiry. Assert rows map to draft, pending approval, public, admin-disabled, and expired states. Test action invalid input, missing session, non-admin rejection, exact RPC arguments/error message, and revalidation targets.

- [ ] **Step 2: Confirm failure**

      npx vitest run lib/queries/admin.test.ts lib/queries/admin.server.test.ts lib/actions/admin-publication.test.ts

- [ ] **Step 3: Extend RPC and generated types**

  Replace list_admin_marketplace_users return table/body in migration to include needed fields. Update Database table/RPC types. Map snake_case fields to camelCase; compute effective visibility with all gates, never a stored field.

- [ ] **Step 4: Implement action**

  Use Server Action module with strict bigint/boolean parsing, server claims and is_current_user_admin recheck, set_shop_publishing_approval RPC, Spanish ActionState result, and revalidatePath for home, admin users, affected shop/product/public sitemap, and seller page.

- [ ] **Step 5: Run green and commit**

      npx vitest run lib/queries/admin.test.ts lib/queries/admin.server.test.ts lib/actions/admin-publication.test.ts
      git add lib/database.types.ts lib/queries/admin.ts lib/queries/admin.test.ts lib/queries/admin.server.test.ts lib/actions/admin-publication.ts lib/actions/admin-publication.test.ts supabase/migrations
      git commit -m "feat: expose shop publication approval"

### Task 4: Accessible admin approval UI

**Files:**
- Modify: components/admin/marketplace-users.tsx
- Modify: components/admin/marketplace-users.test.tsx
- Modify: app/admin/usuarios/page.test.tsx

**Interfaces:**
- Consumes: AdminMarketplaceShop fields and setShopPublishingApproval.
- Produces: non-optimistic accessible shop switch with Spanish feedback.

- [ ] **Step 1: Write failing component tests**

  Assert each shop has switch accessible name “Publicaciones habilitadas”, exact checked state, pending disabled state, no optimistic mutation, explanatory copy, success/error status. Assert product public link appears only when effectiveVisibility true.

- [ ] **Step 2: Confirm failure**

      npx vitest run components/admin/marketplace-users.test.tsx app/admin/usuarios/page.test.tsx

- [ ] **Step 3: Implement**

  Use existing useFormAction/useActionState pattern. Bind shop ID, submit boolean current target value, use server return status, and render “Publicaciones pendientes” when false. Do not render product-level admin control.

- [ ] **Step 4: Run green and commit**

      npx vitest run components/admin/marketplace-users.test.tsx app/admin/usuarios/page.test.tsx
      git add components/admin/marketplace-users.tsx components/admin/marketplace-users.test.tsx app/admin/usuarios/page.test.tsx
      git commit -m "feat: add admin shop approval switch"

### Task 5: Seller product actions and creation UI

**Files:**
- Modify: lib/actions/products.ts
- Create or modify: lib/actions/products.test.ts
- Modify: components/products/product-form.tsx
- Modify: components/products/product-form.test.tsx
- Modify: lib/validation/product.ts
- Modify: lib/validation/product.test.ts

**Interfaces:**
- Produces: createProduct literal draft insert; seller-safe updates; public-vs-pending publish feedback.

- [ ] **Step 1: Write failing tests**

  Submit creation FormData with status published/is_admin_enabled false; assert insert receives status draft and no moderation field. Assert create form has one “Guardar producto” submit action plus hidden-first copy. Assert update never spreads moderation values and seller publish says either public or awaiting approval.

- [ ] **Step 2: Confirm failure**

      npx vitest run lib/actions/products.test.ts components/products/product-form.test.tsx lib/validation/product.test.ts

- [ ] **Step 3: Implement minimum changes**

  Exclude status from creation parsing/insertion and construct explicit Insert object. Keep edit publication intent separate and build explicit seller-owned update object. Query gate fields needed for correct success feedback. Change only creation form action affordance; retain existing edit publish/unpublish controls.

- [ ] **Step 4: Run green and commit**

      npx vitest run lib/actions/products.test.ts components/products/product-form.test.tsx lib/validation/product.test.ts
      git add lib/actions/products.ts lib/actions/products.test.ts components/products/product-form.tsx components/products/product-form.test.tsx lib/validation/product.ts lib/validation/product.test.ts
      git commit -m "feat: save new products as drafts"

### Task 6: Seller effective state presentation

**Files:**
- Modify: components/products/product-row.tsx
- Modify: components/products/product-row.test.tsx
- Modify: app/panel/tiendas/[id]/page.tsx
- Modify: app/panel/tiendas/[id]/page.test.tsx
- Modify: app/panel/productos/[id]/editar/page.tsx
- Modify: app/panel/productos/[id]/editar/page.test.tsx

**Interfaces:**
- Produces: pure display derivation for status plus gates; seller-only routes continue rendering hidden products.

- [ ] **Step 1: Write failing state matrix tests**

  Assert exact Spanish output for seller-disabled, approval-pending, shop-disabled, public, product-admin-disabled, and expired. Assert “Ver publicación” absent for every hidden combination.

- [ ] **Step 2: Implement and test**

  Select product gate and related shop approval in seller pages. Add a focused pure helper/type if it reduces duplicated display logic; it is presentation only, never authorization. Pass derived state into row/edit UI.

      npx vitest run components/products/product-row.test.tsx app/panel/tiendas/[id]/page.test.tsx app/panel/productos/[id]/editar/page.test.tsx

- [ ] **Step 3: Commit**

      git add components/products app/panel/tiendas app/panel/productos
      git commit -m "feat: show seller publication gate states"

### Task 7: Public query, route, sitemap, and telemetry audit

**Files:**
- Modify: lib/queries/catalog.server.ts
- Modify: lib/queries/catalog.server.test.ts
- Modify: lib/queries/sitemap.server.ts
- Modify: app/sitemap.test.ts
- Modify: app/tiendas/[slug]/page.tsx
- Modify: app/tiendas/[slug]/page.test.tsx
- Modify: app/productos/[slug]/page.tsx
- Modify: app/productos/[slug]/page.test.tsx
- Modify: lib/cart-insert.ts
- Modify: lib/cart-insert.test.ts
- Modify: app/api/search-events/selection/route.test.ts
- Modify: any product-public-path file found by audit.

**Interfaces:**
- Produces: app-level defense-in-depth filters mirroring database gates.

- [ ] **Step 1: Add failing mocks/tests**

  Feed pending-shop and admin-disabled published rows to catalog, shop, detail, metadata, sitemap, cart precheck, and selection code. Assert no public rendering/link/selection.

- [ ] **Step 2: Implement joined gate filtering**

  Select/isolate is_admin_enabled and shops.is_publishing_approved and require both next to status/expiry conditions. Direct product route treats gate failure as not found; public shop remains visible but has no hidden products.

- [ ] **Step 3: Audit all remaining status-only product queries**

      rg -n -S '\\.eq\\("status", "published"\\)|products\\.status = '\\''published'\\''|status = '\\''published'\\''' app lib supabase

  Classify legal-document and listing-limit references as unrelated/intentional. Add gates to every product discovery/security-definer case.

- [ ] **Step 4: Run focused suite and commit**

      npx vitest run lib/queries/catalog.server.test.ts app/sitemap.test.ts app/tiendas/[slug]/page.test.tsx app/productos/[slug]/page.test.tsx lib/cart-insert.test.ts app/api/search-events/selection/route.test.ts
      git add app lib supabase
      git commit -m "feat: filter public paths by moderation gates"

### Task 8: Full verification and final audit

**Files:**
- Modify only test/implementation files required by failures.

- [ ] **Step 1: Database validation**

      npx supabase test db
      npx supabase db lint --local --level warning --fail-on error

  Run available Supabase advisors. Fix warnings introduced by this change; record pre-existing unrelated warnings.

- [ ] **Step 2: Application validation**

      npm test
      npm run typecheck
      npm run lint
      npm run build

  When local Supabase supports it:

      npm run test:e2e -- tests/e2e/purchase-intent.spec.ts tests/e2e/messaging.spec.ts

- [ ] **Step 3: Final security and scope audit**

  Confirm no product public path checks status alone; no seller can mutate moderation fields; no non-admin/anonymous RPC caller succeeds; existing history remains readable; no permanent public catalog URL remains.

- [ ] **Step 4: Commit any verification fixes**

      git add app components lib supabase tests
      git commit -m "test: verify publication moderation gates"

### Task 9: Private catalog media and repaired switch feedback

**Files:**
- Create: generated `supabase/migrations/<timestamp>_private_catalog_image_access.sql`
- Modify: `lib/storage.ts`, catalog/message server queries, seller routes, admin action/switch, and focused tests

- [x] **Step 1: Add failing tests**

  Prove hidden Storage objects are broadly readable, bucket is public, signing helper is absent, and successful admin action leaves switch stale.

- [x] **Step 2: Restrict Storage reads**

  Make `catalogo` private, remove broad read policy, permit shop media and RLS-visible product media, and allow administrators to read hidden product media. Preserve object paths and upload/update/delete ownership policies.

- [x] **Step 3: Use signed URLs and post-success switch state**

  Batch unique paths into `createSignedUrls(paths, 300)` from server reads. Never emit permanent public URLs. Return applied switch value from Server Action and update controlled client state only after success.

- [ ] **Step 4: Verify and deploy in safe order**

  Run full application/database checks. Deploy signed-URL application code before applying private-bucket migration; older public-URL code cannot display private objects. After migration, purge the `catalogo` CDN cache because direct SQL bucket updates do not invoke Storage API cache invalidation.
