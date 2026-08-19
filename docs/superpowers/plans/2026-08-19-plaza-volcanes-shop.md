# Plaza Volcanes Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Spanish multi-seller marketplace where public visitors browse listings and authenticated sellers immediately create shops and publish products.

**Architecture:** Next.js App Router renders public catalog and protected seller pages with Server Components. Server Actions validate writes, then use a cookie-authenticated Supabase SSR client; PostgreSQL RLS remains final authorization boundary. Supabase Storage holds public catalog images under seller-scoped object paths.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript, Tailwind CSS 4.3.3, `@supabase/supabase-js` 2.112.3, `@supabase/ssr` 0.12.4, Zod 4.4.3, Vitest 4.1.11, Playwright 1.62.1

**Spec:** `docs/superpowers/specs/2026-08-19-plaza-volcanes-shop-design.md`

## Global Constraints

- Spanish interface and validation copy only.
- Public visitors read shops and published products; sellers mutate only owned shops/products.
- Latest verified package versions above must be pinned through `package-lock.json`.
- Public browser configuration uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no secret or service-role key.
- Normal text contrast must reach WCAG 2.2 AA 4.5:1; keyboard focus stays visible; reduced motion is respected.
- No cart, checkout, payment, order, inventory, category, rating, admin, or analytics surface.
- One optional image per shop and product; accepted formats JPEG, PNG, or WebP; maximum size 5 MB.
- All exposed tables enable RLS and receive explicit Data API grants because current Supabase projects may not auto-expose new tables.

---

### Task 1: Scaffold Current Next.js Application and Test Harness

**Files:**
- Preserve: `docs/superpowers/specs/2026-08-19-plaza-volcanes-shop-design.md`
- Preserve: `docs/superpowers/plans/2026-08-19-plaza-volcanes-shop.md`
- Create through scaffold: `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `public/*`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `.env.example`
- Modify: `package.json`

**Interfaces:**
- Consumes: approved design and exact package versions from Global Constraints.
- Produces: scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, and `test:e2e`; alias `@/*`; environment contract used by all later tasks.

- [ ] **Step 1: Scaffold without overwriting approved docs**

Run from temporary directory, then copy generated application files into repository:

```bash
npx create-next-app@16.3.1 plaza-volcanes-scaffold --typescript --tailwind --eslint --app --src-dir=false --import-alias='@/*' --use-npm --yes
```

Expected: generated app uses Next.js 16.3.1, React 19.2.8, TypeScript, and Tailwind 4.

- [ ] **Step 2: Install pinned runtime and test dependencies**

```bash
npm install --save-exact @supabase/supabase-js@2.112.3 @supabase/ssr@0.12.4 zod@4.4.3 lucide-react
npm install --save-dev --save-exact vitest@4.1.11 @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test@1.62.1
```

Expected: lockfile pins exact Supabase, Zod, Vitest, and Playwright versions.

- [ ] **Step 3: Add test and type-check scripts**

Set package scripts to:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 4: Configure Vitest and Playwright**

`vitest.config.ts` uses jsdom, React plugin, `@` alias to repository root, and `vitest.setup.ts`. `playwright.config.ts` uses `tests/e2e`, Chromium, base URL `http://127.0.0.1:3000`, and starts `npm run dev` unless `PLAYWRIGHT_BASE_URL` exists.

- [ ] **Step 5: Define public environment contract**

`.env.example`:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

- [ ] **Step 6: Verify clean scaffold**

Run: `npm run lint && npm run typecheck && npm run build`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js marketplace"
```

---

### Task 2: Add Database Schema, RLS Policies, and Typed Supabase Clients

**Files:**
- Create: `supabase/config.toml`
- Create via CLI: `supabase/migrations/<timestamp>_create_marketplace.sql`
- Create: `supabase/tests/database/marketplace_rls.test.sql`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, `lib/supabase/config.ts`
- Create: `lib/database.types.ts`
- Create: `proxy.ts`
- Test: `lib/supabase/config.test.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Produces: `isSupabaseConfigured(): boolean`, `createBrowserSupabaseClient()`, async `createServerSupabaseClient()`, `updateSession(request: NextRequest)`, typed `Database` with `shops` and `products` rows/inserts/updates.

- [ ] **Step 1: Initialize Supabase CLI structure using discovered commands**

Run `npx supabase --help`, `npx supabase init --help`, then `npx supabase init` only if documented flags match. Run `npx supabase migration new --help`, then create migration with `npx supabase migration new create_marketplace`.

Expected: timestamped migration generated by CLI, never hand-named.

- [ ] **Step 2: Write failing environment tests**

```ts
describe("isSupabaseConfigured", () => {
  it("is false for example credentials", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_your-key";
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is true for real-looking public credentials", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_live";
    expect(isSupabaseConfigured()).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `npm test -- lib/supabase/config.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 4: Implement migration**

Migration creates bigint-identity `shops` and `products`, check constraints, foreign keys, timestamps, indexes `shops_owner_id_idx`, `products_shop_id_idx`, and partial `products_published_created_at_idx`. It inserts public `catalogo` bucket with 5 MB size limit and MIME allowlist. It explicitly grants select to `anon`; grants select/insert/update/delete plus sequence use to `authenticated`; enables RLS; creates separate select/insert/update/delete policies with `(select auth.uid())`; and scopes storage mutation policies with `(storage.foldername(name))[1] = (select auth.uid())::text`.

Exact public product predicate:

```sql
status = 'published'
or exists (
  select 1 from public.shops
  where shops.id = products.shop_id
    and shops.owner_id = (select auth.uid())
)
```

Exact product ownership predicate:

```sql
exists (
  select 1 from public.shops
  where shops.id = products.shop_id
    and shops.owner_id = (select auth.uid())
)
```

- [ ] **Step 5: Implement clients and session proxy**

`lib/supabase/server.ts` uses `createServerClient<Database>` with async Next.js `cookies()`, `getAll`, and guarded `setAll`. Root `proxy.ts` calls `updateSession`; matcher excludes static image assets. Session refresh uses `supabase.auth.getClaims()` and never trusts `getSession()` for authorization.

- [ ] **Step 6: Implement typed environment guard**

`isSupabaseConfigured()` returns false for missing or example values. Client factories throw Spanish configuration error only when called without real values; public shell remains renderable for setup verification.

- [ ] **Step 7: Run focused tests and static gates**

Run: `npm test -- lib/supabase/config.test.ts && npm run typecheck && npm run lint`

Expected: all exit 0.

- [ ] **Step 8: Run database tests when local Supabase is available**

Run `npx supabase test db --help`, then `npx supabase test db` when local Docker-backed services start. Tests create two authenticated JWT contexts and prove seller A cannot read seller B draft or mutate seller B shop/product.

Expected: pgTAP suite passes. If Docker is unavailable, record command and exact infrastructure error without weakening SQL tests.

- [ ] **Step 9: Commit**

```bash
git add lib proxy.ts supabase
git commit -m "feat: secure marketplace data with Supabase RLS"
```

---

### Task 3: Build Marketplace Shell and Design System

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `components/brand/volcano-mark.tsx`, `components/layout/site-header.tsx`, `components/layout/site-footer.tsx`
- Create: `components/ui/button.tsx`, `components/ui/field.tsx`, `components/ui/empty-state.tsx`, `components/ui/status-badge.tsx`
- Create: `components/catalog/product-card.tsx`, `components/catalog/product-grid.tsx`, `components/catalog/search-bar.tsx`
- Create: `lib/format.ts`
- Test: `lib/format.test.ts`, `components/ui/button.test.tsx`

**Interfaces:**
- Produces: `formatMxn(value: number | string): string`; reusable `Button`, `Field`, `EmptyState`, `StatusBadge`; `ProductCard` accepts `{ id, name, price_mxn, image_path, shop: { name: string } }`.

- [ ] **Step 1: Write failing format and button tests**

```ts
expect(formatMxn(1299)).toBe("$1,299.00");
expect(formatMxn("49.5")).toBe("$49.50");
```

Button test asserts aubergine primary class, disabled state, and forwarded accessible name.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- lib/format.test.ts components/ui/button.test.tsx`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement tokens and typography**

Load Bricolage Grotesque and Instrument Sans with `next/font/google`. Define approved CSS variables, cream body canvas, white surfaces, aubergine primary actions, dark-plum hover, mint focus ring, warm-gray borders, 4.5:1 text colors, and reduced-motion override.

- [ ] **Step 4: Implement brand and layout primitives**

Create continuous SVG volcanic-ridge mark with `currentColor`. Header contains logo, compact navigation, `Publica tu tienda`, and account link. Footer uses aubergine background. Button variants are `primary`, `secondary`, and `ghost`; no cart variant or copy.

- [ ] **Step 5: Implement catalog primitives and empty home shell**

Home starts with search thesis, shop-discovery copy, and responsive 1/2/4-column grid container. Empty state says `Aún no hay productos publicados` and links sellers to registration.

- [ ] **Step 6: Run tests and render gates**

Run: `npm test -- lib/format.test.ts components/ui/button.test.tsx && npm run lint && npm run typecheck && npm run build`

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add app components lib/format.ts lib/format.test.ts
git commit -m "feat: add Plaza Volcanes marketplace design system"
```

---

### Task 4: Implement Email and Password Authentication

**Files:**
- Create: `lib/validation/auth.ts`, `lib/validation/auth.test.ts`
- Create: `lib/actions/auth.ts`
- Create: `components/auth/auth-form.tsx`, `components/auth/sign-out-button.tsx`
- Create: `app/(auth)/layout.tsx`, `app/(auth)/ingresar/page.tsx`, `app/(auth)/registro/page.tsx`
- Create: `app/auth/confirm/route.ts`
- Modify: `components/layout/site-header.tsx`

**Interfaces:**
- Produces: `authSchema`, `signIn(previousState, formData)`, `signUp(previousState, formData)`, `signOut()`, confirmation GET handler exchanging `token_hash` and `type` for session.

- [ ] **Step 1: Write failing auth validation tests**

```ts
expect(authSchema.safeParse({ email: "persona@volcanes.mx", password: "secreto12" }).success).toBe(true);
expect(authSchema.safeParse({ email: "correo-invalido", password: "123" }).success).toBe(false);
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- lib/validation/auth.test.ts`

Expected: FAIL because schema does not exist.

- [ ] **Step 3: Implement schema and server actions**

Use `z.email()` and minimum eight-character password. `signUp` passes `${NEXT_PUBLIC_SITE_URL}/auth/confirm` as `emailRedirectTo`; success message is `Revisa tu correo para confirmar tu cuenta`. `signIn` maps invalid credentials to `Correo o contraseña incorrectos`; valid session redirects to `/panel`. `signOut` redirects to `/`.

- [ ] **Step 4: Implement accessible auth pages and confirmation route**

Both forms use `useActionState`, labeled email/password inputs, inline field errors, pending text, and cross-links. Confirmation route exchanges code, redirects success to `/panel`, and redirects failure to `/ingresar?error=confirmacion`.

- [ ] **Step 5: Update session-aware header**

Server header renders `Ingresar` and `Regístrate` when signed out; renders `Mi panel` and sign-out action when signed in. When Supabase lacks configuration, header stays public and auth page shows setup guidance without exposing secrets.

- [ ] **Step 6: Verify**

Run: `npm test -- lib/validation/auth.test.ts && npm run lint && npm run typecheck && npm run build`

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add app components/auth components/layout/site-header.tsx lib/actions/auth.ts lib/validation/auth.ts lib/validation/auth.test.ts
git commit -m "feat: add Supabase email authentication"
```

---

### Task 5: Implement Seller Shop Management

**Files:**
- Create: `lib/validation/shop.ts`, `lib/validation/shop.test.ts`
- Create: `lib/slug.ts`, `lib/slug.test.ts`, `lib/storage.ts`, `lib/action-state.ts`
- Create: `lib/actions/shops.ts`
- Create: `components/shops/shop-form.tsx`, `components/shops/shop-card.tsx`
- Create: `app/panel/layout.tsx`, `app/panel/page.tsx`, `app/panel/loading.tsx`
- Create: `app/panel/tiendas/nueva/page.tsx`, `app/panel/tiendas/[id]/page.tsx`

**Interfaces:**
- Produces: `shopSchema`, `slugify(value: string): string`, `uniqueShopSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string>`, `validateImage(file: File): string | null`, `createShop`, `updateShop`, `deleteShop`.

- [ ] **Step 1: Write failing schema, slug, and image tests**

Cover required 3–80 character name, 20–1200 character description, accent removal (`"Café del Volcán" -> "cafe-del-volcan"`), collision suffix (`cafe-del-volcan-2`), accepted JPEG/PNG/WebP, and rejection above 5 MB.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- lib/validation/shop.test.ts lib/slug.test.ts lib/storage.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement pure validation helpers**

Return Spanish Zod messages. `uniqueShopSlug` probes base then numeric suffixes through provided callback. `validateImage` returns exact Spanish error or null.

- [ ] **Step 4: Implement shop actions**

Every action calls `auth.getClaims()`, validates input, and lets RLS enforce ownership. Upload optional image to `catalogo/${user.id}/shops/${crypto.randomUUID()}.${extension}`. On insert failure, delete uploaded object. Revalidate `/`, `/panel`, and `/tiendas/${slug}`. Delete stored image after successful row deletion.

- [ ] **Step 5: Implement protected panel and forms**

Panel layout redirects missing user to `/ingresar?continuar=/panel`. Overview queries owned shops ordered newest first. Empty state offers `Crear tu primera tienda`. Form uses explicit labels, image preview, pending state, and Spanish feedback. Edit page also lists shop products and offers `Agregar producto`.

- [ ] **Step 6: Verify**

Run: `npm test -- lib/validation/shop.test.ts lib/slug.test.ts lib/storage.test.ts && npm run lint && npm run typecheck && npm run build`

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/panel components/shops lib/actions/shops.ts lib/action-state.ts lib/slug.ts lib/slug.test.ts lib/storage.ts lib/storage.test.ts lib/validation/shop.ts lib/validation/shop.test.ts
git commit -m "feat: let sellers manage shops"
```

---

### Task 6: Implement Product Draft and Publishing Management

**Files:**
- Create: `lib/validation/product.ts`, `lib/validation/product.test.ts`
- Create: `lib/actions/products.ts`
- Create: `components/products/product-form.tsx`, `components/products/product-row.tsx`
- Create: `app/panel/tiendas/[id]/productos/nuevo/page.tsx`
- Create: `app/panel/productos/[id]/editar/page.tsx`
- Modify: `app/panel/tiendas/[id]/page.tsx`

**Interfaces:**
- Produces: `productSchema`; actions `createProduct`, `updateProduct`, `setProductStatus`, `deleteProduct`; status union `"draft" | "published"`.

- [ ] **Step 1: Write failing product validation tests**

```ts
expect(productSchema.safeParse({ name: "Taza de barro", description: "Hecha a mano en taller local.", price_mxn: "349.00", status: "draft" }).success).toBe(true);
expect(productSchema.safeParse({ name: "X", description: "corta", price_mxn: "-1", status: "public" }).success).toBe(false);
```

- [ ] **Step 2: Verify test fails**

Run: `npm test -- lib/validation/product.test.ts`

Expected: FAIL because schema does not exist.

- [ ] **Step 3: Implement product schema and actions**

Validate name 3–120, description 20–3000, decimal price 0–9,999,999,999.99, and exact status values. Use seller-scoped path `${user.id}/products/${uuid}.${extension}`. Create defaults to draft unless submitted action equals `published`. Updates preserve old image when no new file exists, clean new upload on row failure, then delete replaced old image. Revalidate home, shop slug, public product route, and panel routes.

- [ ] **Step 4: Implement create/edit forms and shop product table**

Form includes `Guardar borrador` and aubergine `Publicar producto`; edit form includes `Despublicar` when published. Dashboard rows show image, name, formatted price, status badge, edit link, and delete action. Draft links stay inside dashboard.

- [ ] **Step 5: Verify**

Run: `npm test -- lib/validation/product.test.ts && npm run lint && npm run typecheck && npm run build`

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/panel components/products lib/actions/products.ts lib/validation/product.ts lib/validation/product.test.ts
git commit -m "feat: add product drafts and publishing"
```

---

### Task 7: Connect Public Catalog, Search, Shop, and Product Pages

**Files:**
- Create: `lib/queries/catalog.ts`, `lib/queries/catalog.test.ts`
- Create: `app/tiendas/[slug]/page.tsx`, `app/tiendas/[slug]/loading.tsx`
- Create: `app/productos/[id]/page.tsx`, `app/productos/[id]/loading.tsx`
- Create: `app/not-found.tsx`
- Modify: `app/page.tsx`, `components/catalog/search-bar.tsx`, `components/catalog/product-card.tsx`

**Interfaces:**
- Produces: `getHomeCatalog(query?: string)`, `getPublicShop(slug: string)`, `getPublicProduct(id: number)`; public pages consume typed query results and use `notFound()` for absent/RLS-hidden rows.

- [ ] **Step 1: Write failing search normalization tests**

Test trims whitespace, caps query at 80 characters, and returns undefined for empty input. The query builder must select only products visible through RLS, limit homepage results to 24, and order `created_at` descending.

- [ ] **Step 2: Verify test fails**

Run: `npm test -- lib/queries/catalog.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement public query boundary**

When Supabase is not configured, return empty typed collections rather than instantiate client. Search applies case-insensitive `ilike` to product name. Shop query selects shop plus published child products. Product query selects product plus shop name/slug. RLS hides drafts from anonymous visitors.

- [ ] **Step 4: Implement public pages**

Home renders search result heading, newest products, shop discovery strip, and clear empty state. Shop page renders image, description, seller-neutral storefront header, and product grid. Product page renders large 4:3 image, shop backlink, name, description, and MXN price; contains no purchase control.

- [ ] **Step 5: Add metadata and localized 404**

Dynamic metadata uses product/shop names. Missing content shows `No encontramos esta publicación` with link back to marketplace.

- [ ] **Step 6: Verify**

Run: `npm test -- lib/queries/catalog.test.ts && npm run lint && npm run typecheck && npm run build`

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add app components/catalog lib/queries
git commit -m "feat: publish searchable product catalog"
```

---

### Task 8: Add Browser Proof, Documentation, and Final Verification

**Files:**
- Create: `tests/e2e/public-marketplace.spec.ts`, `tests/e2e/auth.spec.ts`
- Create: `README.md`
- Modify: files uncovered by accessibility or responsive verification only when required for acceptance.

**Interfaces:**
- Consumes: complete public and seller flows.
- Produces: documented setup, public browser smoke suite, conditional authenticated smoke suite, final passing quality gates.

- [ ] **Step 1: Write public browser tests**

Tests assert homepage Spanish heading, search input label, registration navigation, absence of `Agregar al carrito`, mobile navigation accessibility, and 404 copy. Capture desktop and mobile screenshots for visual inspection.

- [ ] **Step 2: Write conditional authenticated smoke test**

When `E2E_SELLER_EMAIL` and `E2E_SELLER_PASSWORD` exist, test signs in, creates uniquely named shop, creates draft product, publishes it, signs out, and confirms public visibility. Without credentials, skip with explicit reason.

- [ ] **Step 3: Document setup**

README gives exact install, `.env.local`, Supabase migration, Auth redirect URL, dev, test, and build commands. It states email confirmation requirement, Data API grants included in migration, image limits, and excluded v1 features.

- [ ] **Step 4: Run full automated gates**

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected: lint, type-check, unit tests, build, and public browser tests exit 0. Authenticated test passes with test credentials or reports skip without them.

- [ ] **Step 5: Inspect rendered desktop and mobile screenshots**

Check search prominence, 1/2/4-column behavior, aubergine/mint balance, focus visibility, no overflow, and no generic scaffold content. Remove one nonfunctional decorative element if it competes with search or product content.

- [ ] **Step 6: Run Supabase policy proof**

Run local pgTAP suite when Docker-backed Supabase is available. Otherwise preserve test file and report infrastructure limitation exactly; never claim policy execution passed.

- [ ] **Step 7: Commit**

```bash
git add README.md tests app components lib
git commit -m "test: verify marketplace seller journey"
```

