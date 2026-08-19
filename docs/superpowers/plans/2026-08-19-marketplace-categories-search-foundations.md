# Marketplace Categories and Search Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add curated bilingual product categories, seller classification and suggestion flows, deterministic multilingual search foundations, optional English product content, and anonymous search telemetry while preserving existing products.

**Architecture:** Supabase stores language-neutral category identity plus locale-specific translations and aliases. Product rows gain nullable category, currency, and source-locale fields; PostgreSQL validates publication and exposes ranked full-text search through an RPC. Next.js Server Components load category/search data, Client Components manage dependent controls and click telemetry, and Server Actions enforce seller ownership.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Tailwind CSS 4.3.3, Supabase PostgreSQL/Auth/RLS, Zod 4.4.3, Vitest 4.1.11, Testing Library, pgTAP.

**Spec:** `docs/superpowers/specs/2026-08-19-marketplace-categories-search-foundations-design.md`

## Global Constraints

- Work directly on `main`; never stage or alter user-owned `.env.example` and `.gitignore` changes.
- Product UI copy remains Spanish; seed category/search content for `es-MX` and `en-US`.
- Country, locale, currency, and listing type stay independent.
- Current buyer UI exposes products only; do not add service or restaurant screens.
- Drafts may omit category; every new publication requires one active product leaf.
- Existing published uncategorized products remain visible until edited or reclassified.
- Taxonomy writes remain unavailable to frontend roles; seller suggestions never publish categories.
- No LLM calls, embeddings, vector indexes, automatic translation, carts, checkout, payments, booking, or menus.
- Preserve existing visual tokens, typography, marketplace treatment, and WCAG 2.2 AA intent.
- Use Server Components by default and verify auth/authorization inside every Server Action.
- Read relevant `node_modules/next/dist/docs/` guides before framework edits.

---

## File Structure

- `supabase/migrations/20260819173000_add_categories_and_search.sql`: schema, seeds, guards, search RPC, telemetry RPCs, grants, and RLS.
- `supabase/tests/database/categories_search.test.sql`: database behavior and security tests.
- `lib/database.types.ts`: exact new table, relationship, and RPC contracts.
- `lib/catalog-locale.ts`, `lib/categories.ts`: locale constants, category tree types, selection, icons, and URL helpers.
- `lib/validation/category.ts`, `lib/validation/product-translation.ts`, `lib/validation/search-event.ts`: mutation boundaries.
- `lib/queries/categories.server.ts`, `lib/queries/catalog.server.ts`: taxonomy loading and ranked catalog retrieval.
- `lib/actions/categories.ts`, `lib/actions/product-translations.ts`, `lib/actions/products.ts`: owner-checked mutations.
- `components/catalog/category-icon.tsx`, `components/catalog/category-navigation.tsx`: buyer category rail.
- `components/products/category-fields.tsx`, `category-suggestion-form.tsx`, `product-translation-form.tsx`: seller flows.
- `app/api/search-events/selection/route.ts`: validated, non-blocking search-click telemetry.

---

### Task 1: Database taxonomy, localization, search, and telemetry

**Files:**
- Create: `supabase/migrations/20260819173000_add_categories_and_search.sql`
- Create: `supabase/tests/database/categories_search.test.sql`

**Interfaces:**
- Produces tables `categories`, `category_translations`, `category_aliases`, `category_suggestions`, `product_translations`, `search_events`.
- Produces product columns `category_id`, `currency_code`, `content_locale`, `search_document`.
- Produces RPCs:
  - `search_product_ids(p_query text, p_locale text, p_country_code text, p_category_id bigint, p_limit integer) returns table(product_id bigint, rank real)`.
  - `record_catalog_search(p_query text, p_locale text, p_country_code text, p_category_id bigint, p_result_count integer) returns uuid`.
  - `record_search_selection(p_event_id uuid, p_product_id bigint, p_position integer) returns void`.

- [ ] **Step 1: Write failing pgTAP schema and behavior tests**

Assert all new tables, product columns, and RPC signatures exist. Add fixtures proving:

```sql
select lives_ok(
  $$select id from public.products where status = 'published' and category_id is null$$,
  'legacy uncategorized publications remain readable'
);
select throws_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status) values (1, 'Sin categoría', 'Descripción suficientemente larga para probar.', 100, 'published')$$,
  '23514', null, 'new publications require a category'
);
select lives_ok(
  $$insert into public.products (shop_id, name, description, price_mxn, status) values (1, 'Borrador libre', 'Descripción suficientemente larga para probar.', 100, 'draft')$$,
  'drafts may omit category'
);
```

Also prove anonymous category reads, denied category writes, seller-owned suggestion reads, cross-seller suggestion privacy, owner-only translation writes, active-leaf enforcement, Spanish alias search, English translation search, country filtering, and denied direct telemetry-table reads.

- [ ] **Step 2: Run database tests and verify failure**

Run: `npx supabase test db`

Expected: FAIL because new database objects do not exist.

- [ ] **Step 3: Create schema, guards, grants, and RLS**

Create language-neutral categories:

```sql
create table public.categories (
  id bigint generated always as identity primary key,
  parent_id bigint references public.categories (id) on delete restrict,
  listing_type text not null check (listing_type in ('product', 'service', 'restaurant')),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_type, slug),
  check (parent_id is null or parent_id <> id)
);
```

Create `category_translations(category_id, locale, name, description)` with `(category_id, locale)` primary key and locales constrained to `es-MX|en-US`. Create localized unique aliases. Add hierarchy trigger rejecting depth beyond two and parent/child listing-type mismatch.

Create private suggestions with seller UUID, optional root context, locale, status `pending|approved|rejected`, timestamps, and seller-only insert/select policies. Frontend roles get no category write grants.

Create product translations with `(product_id, locale)` primary key, `source in ('manual','ai')`, `review_status in ('draft','approved')`, and generated English `tsvector`. Public reads require approved translation plus published parent product; writes require shop ownership.

Extend products:

```sql
alter table public.products
  add column category_id bigint references public.categories (id) on delete restrict,
  add column currency_code text not null default 'MXN' check (currency_code ~ '^[A-Z]{3}$'),
  add column content_locale text not null default 'es-MX' check (content_locale in ('es-MX', 'en-US')),
  add column search_document tsvector generated always as (
    setweight(to_tsvector('spanish'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('spanish'::regconfig, coalesce(description, '')), 'C')
  ) stored;
create index products_search_document_idx on public.products using gin (search_document);
create index products_category_published_idx on public.products (category_id, created_at desc)
  where status = 'published';
```

Add product trigger raising SQLSTATE `23514` and `Published products require an active product leaf category.` for inserted/updated published rows with null, inactive, non-product, or non-leaf category. Migration must not rewrite legacy rows, preserving existing publications until their next edit.

Create stable, security-invoker ranked search RPC. Rank exact localized name, prefix, full-text, category translation/alias, description, then shop name. Filter published status, country, and selected root-or-leaf category. Cap limit to `1..100`.

Create telemetry table without direct frontend grants. Expose only security-definer insert/update RPCs with empty search path, argument validation, and execute grants to `anon, authenticated`.

- [ ] **Step 4: Seed exact bilingual taxonomy and aliases**

Seed roots and leaves in this order:

```text
electronica: celulares-y-accesorios, computacion, audio-y-video, videojuegos, accesorios-electronicos
hogar-y-jardin: muebles, decoracion, cocina-y-comedor, electrodomesticos, jardin-y-herramientas
moda-y-accesorios: ropa-para-mujer, ropa-para-hombre, calzado, bolsas-y-accesorios, joyeria-y-relojes
belleza-y-cuidado-personal: maquillaje, cuidado-de-piel, cuidado-del-cabello, perfumes, cuidado-personal
alimentos-y-bebidas: despensa, panaderia-y-postres, bebidas-sin-alcohol, alimentos-artesanales
deportes-y-aire-libre: ejercicio-y-fitness, ciclismo, camping, articulos-deportivos
bebes-ninas-y-ninos: ropa-infantil, juguetes, cuidado-infantil, articulos-escolares
arte-papeleria-y-manualidades: arte, papeleria, manualidades, instrumentos-musicales
mascotas: alimento-para-mascotas, accesorios-para-mascotas, higiene-y-cuidado-para-mascotas
automotriz: refacciones, accesorios-automotrices, herramientas-automotrices
libros-medios-y-coleccionables: libros, musica-y-peliculas, coleccionables, antiguedades
```

Use exact Spanish names from spec. Add direct English translations, including `Electronics`, `Home & Garden`, `Fashion & Accessories`, `Beauty & Personal Care`, `Food & Beverages`, `Sports & Outdoors`, `Babies & Kids`, `Art, Stationery & Crafts`, `Pets`, `Automotive`, and `Books, Media & Collectibles`.

Seed aliases:

```text
es-MX celulares-y-accesorios: celular, teléfono, smartphone, móvil
en-US celulares-y-accesorios: phone, smartphone, mobile phone
es-MX computacion: computadora, laptop, pc
en-US computacion: computer, laptop, pc
es-MX decoracion: decoración del hogar, adornos
en-US decoracion: home decor, decorations
es-MX ropa-para-mujer: ropa mujer, moda mujer
en-US ropa-para-mujer: womenswear, women's fashion
es-MX panaderia-y-postres: pan, pastel, repostería
en-US panaderia-y-postres: bakery, cake, desserts
es-MX refacciones: autopartes, piezas para auto
en-US refacciones: auto parts, car parts
```

- [ ] **Step 5: Reset local database and pass pgTAP**

Run: `npx supabase db reset`

Run: `npx supabase test db`

Expected: all database tests PASS.

- [ ] **Step 6: Commit database foundation**

```bash
git add supabase/migrations/20260819173000_add_categories_and_search.sql supabase/tests/database/categories_search.test.sql
git commit -m "feat: add category and search schema"
```

---

### Task 2: Typed locale, category, validation, and database contracts

**Files:**
- Create: `lib/catalog-locale.ts`, `lib/categories.ts`, `lib/categories.test.ts`
- Create: `lib/validation/category.ts`, `lib/validation/category.test.ts`
- Create: `lib/validation/product-translation.ts`, `lib/validation/product-translation.test.ts`
- Modify: `lib/validation/product.ts`, `lib/validation/product.test.ts`
- Modify: `lib/database.types.ts`, `lib/format.ts`, `lib/format.test.ts`

**Interfaces:**
- Produces `CatalogLocale`, defaults, `CategoryOption`, `CategoryTree`, `findCategorySelection`, `buildCatalogHref`, suggestion schema, and translation schema.
- Product output adds `category_id: number|null`, `currency_code:'MXN'`, `content_locale:'es-MX'`.

- [ ] **Step 1: Write failing helper and validation tests**

```ts
expect(normalizeCatalogLocale("en-US")).toBe("en-US");
expect(normalizeCatalogLocale("fr-FR")).toBe("es-MX");
expect(findCategorySelection(tree, 22)).toEqual({ parentId: 2, leafId: 22 });
expect(buildCatalogHref({ query: "iphone", categorySlug: "electronica" }))
  .toBe("/?q=iphone&categoria=electronica");
```

Test suggestion name `3..80`, context max `500`, optional positive root ID, translation both-blank removal, translation complete-pair requirement, draft without category, and published error `Selecciona una subcategoría antes de publicar.`

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- lib/categories.test.ts lib/validation/category.test.ts lib/validation/product-translation.test.ts lib/validation/product.test.ts lib/format.test.ts`

Expected: FAIL on missing modules and fields.

- [ ] **Step 3: Implement contracts**

```ts
export const SUPPORTED_CATALOG_LOCALES = ["es-MX", "en-US"] as const;
export type CatalogLocale = (typeof SUPPORTED_CATALOG_LOCALES)[number];
export const DEFAULT_CATALOG_LOCALE: CatalogLocale = "es-MX";
export const DEFAULT_CATALOG_MARKET = "MX" as const;
export const DEFAULT_CATALOG_CURRENCY = "MXN" as const;

export type CategoryOption = {
  id: number; parentId: number | null; slug: string; name: string;
  sortOrder: number; isActive: boolean;
};
export type CategoryTree = CategoryOption & { children: CategoryOption[] };
```

Map 11 root slugs to `electronics|home|fashion|beauty|food|sports|kids|art|pets|automotive|books`. Implement currency-aware `formatCurrency(value,currencyCode,locale='es-MX')`; keep `formatMxn` delegating to it.

Extend manual database types with all tables, relationships, functions, and new product fields. Represent `search_document` as `unknown` in Row and omit generated writes.

- [ ] **Step 4: Pass focused tests and type-check**

Run: `npm test -- lib/categories.test.ts lib/validation/category.test.ts lib/validation/product-translation.test.ts lib/validation/product.test.ts lib/format.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit contracts**

```bash
git add lib/catalog-locale.ts lib/categories.ts lib/categories.test.ts lib/validation/category.ts lib/validation/category.test.ts lib/validation/product-translation.ts lib/validation/product-translation.test.ts lib/validation/product.ts lib/validation/product.test.ts lib/database.types.ts lib/format.ts lib/format.test.ts
git commit -m "feat: add category domain contracts"
```

---

### Task 3: Category loaders and ranked catalog queries

**Files:**
- Create: `lib/queries/categories.server.ts`
- Modify: `lib/queries/catalog.ts`, `lib/queries/catalog.test.ts`, `lib/queries/catalog.server.ts`

**Interfaces:**
- `getProductCategoryTree(locale, { includeInactive? }): Promise<CategoryTree[]>`.
- `CatalogFilters` contains query, root slug, leaf slug, locale, and country.
- `getHomeCatalog(filters)` also returns resolved selections, invalid flag, and search event ID.
- `getPublicShop(slug, locale = DEFAULT_CATALOG_LOCALE)` and `getPublicProduct(id, locale = DEFAULT_CATALOG_LOCALE)` preserve existing one-argument callers while enabling localized output.

- [ ] **Step 1: Write failing normalization tests**

```ts
expect(normalizeCatalogFilters({ q: ["  iphone  "], categoria: "electronica",
  subcategoria: "celulares-y-accesorios" })).toEqual({
  query: "iphone", categorySlug: "electronica",
  subcategorySlug: "celulares-y-accesorios", locale: "es-MX", countryCode: "MX",
});
expect(normalizeCatalogFilters({ categoria: "INVALID SLUG" }).categorySlug).toBeUndefined();
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- lib/queries/catalog.test.ts`

Expected: FAIL on missing filter contract.

- [ ] **Step 3: Implement loaders and ranked search integration**

Load category rows and requested/fallback translations, then build sorted roots and children. Public mode includes active rows only; seller mode includes inactive selections.

Resolve root/leaf relationship before query. Call `search_product_ids` when text/category filter exists, fetch returned products, and preserve RPC rank order. On RPC failure, fall back to published name `ilike` plus resolved category leaf IDs. Localize approved English content when locale is `en-US`; otherwise use source fields.

Record catalog search after results only when text/category filter exists. Telemetry failure must not fail catalog.

- [ ] **Step 4: Pass tests and type-check**

Run: `npm test -- lib/queries/catalog.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit discovery layer**

```bash
git add lib/queries/categories.server.ts lib/queries/catalog.ts lib/queries/catalog.test.ts lib/queries/catalog.server.ts
git commit -m "feat: add category-aware catalog search"
```

---

### Task 4: Buyer category navigation and shareable filtering

**Files:**
- Create: `components/catalog/category-icon.tsx`, `components/catalog/category-navigation.tsx`, `components/catalog/category-navigation.test.tsx`
- Modify: `components/catalog/search-bar.tsx`, `components/catalog/product-card.tsx`, `components/catalog/product-card.test.tsx`
- Modify: `app/page.tsx`, `app/productos/[id]/page.tsx`, `app/public-sharing.test.tsx`

**Interfaces:**
- CategoryNavigation receives tree, active slugs, and query.
- SearchBar preserves category slugs through hidden inputs.
- ProductCard receives explicit currency/category and optional tracking metadata.

- [ ] **Step 1: Write failing navigation/card tests**

Assert navigation accessible name `Categorías de productos`, `Todos` current state, query-preserving root links, leaf chips for selected root, selected leaf `aria-current='page'`, and card currency from `currency_code`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- components/catalog/category-navigation.test.tsx components/catalog/product-card.test.tsx app/public-sharing.test.tsx`

Expected: FAIL on missing navigation and expanded product fields.

- [ ] **Step 3: Implement Airbnb-like category rail**

Use Lucide mappings: Smartphone, House, Shirt, Sparkles, UtensilsCrossed, Bike, Baby, Palette, PawPrint, Car, BookOpen. Render semantic nav, 44px targets, horizontal overflow, visible labels, `aria-current`, aubergine selection, mint indicator, and leaf chips. Root change clears stale leaf; all links preserve `q`.

- [ ] **Step 4: Integrate home and product pages**

Parse promised `searchParams`. Render category navigation below search. Show `Categoría no disponible. Mostramos todos los productos.` for unresolved slugs. Preserve filters in search submission, headings, reset links, refresh, back, and sharing. Pass one-based result position and event ID to cards. Add localized category breadcrumb to product detail.

- [ ] **Step 5: Pass component and static gates**

Run: `npm test -- components/catalog/category-navigation.test.tsx components/catalog/product-card.test.tsx app/public-sharing.test.tsx`

Run: `npm run lint && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit buyer UI**

```bash
git add components/catalog/category-icon.tsx components/catalog/category-navigation.tsx components/catalog/category-navigation.test.tsx components/catalog/search-bar.tsx components/catalog/product-card.tsx components/catalog/product-card.test.tsx app/page.tsx 'app/productos/[id]/page.tsx' app/public-sharing.test.tsx
git commit -m "feat: add buyer category navigation"
```

---

### Task 5: Seller classification and publication enforcement

**Files:**
- Create: `components/products/category-fields.tsx`
- Modify: `components/products/product-form.tsx`, `components/products/product-form.test.tsx`
- Modify: `lib/actions/products.ts`, `components/products/product-row.tsx`
- Modify: `app/panel/tiendas/[id]/productos/nuevo/page.tsx`, `app/panel/productos/[id]/editar/page.tsx`

**Interfaces:**
- CategoryFields receives category tree, selected leaf, and field error.
- ProductForm requires category tree and writes category, `MXN`, and `es-MX`.

- [ ] **Step 1: Write failing form tests**

Assert main selector, disabled leaf before root selection, leaf options after root selection, inactive selection notice, and published category field error.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- components/products/product-form.test.tsx lib/validation/product.test.ts`

Expected: FAIL on missing category controls.

- [ ] **Step 3: Implement dependent selectors and product persistence**

Use labeled `Categoría` and `Subcategoría` selects. Main changes clear stale leaf. Hidden inputs set `currency_code='MXN'` and `content_locale='es-MX'`. Parse/persist new fields in create/update actions. Before image upload, reject invalid published category with `Selecciona una subcategoría válida antes de publicar.` Draft category stays nullable.

Update quick publish: invalid category redirects to `/panel/productos/{id}/editar?categoria=requerida=1`; database errors are no longer ignored.

- [ ] **Step 4: Load seller category tree**

New page loads active tree. Edit page includes inactive categories, passes existing `category_id`, and shows correction notice from search parameter.

- [ ] **Step 5: Pass tests and static gates**

Run: `npm test -- components/products/product-form.test.tsx lib/validation/product.test.ts`

Run: `npm run lint && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit classification**

```bash
git add components/products/category-fields.tsx components/products/product-form.tsx components/products/product-form.test.tsx lib/actions/products.ts components/products/product-row.tsx 'app/panel/tiendas/[id]/productos/nuevo/page.tsx' 'app/panel/productos/[id]/editar/page.tsx'
git commit -m "feat: require categories for publication"
```

---

### Task 6: Private category suggestions

**Files:**
- Create: `lib/actions/categories.ts`, `components/products/category-suggestion-form.tsx`, `components/products/category-suggestion-form.test.tsx`
- Modify: new/edit product pages.

**Interfaces:**
- `createCategorySuggestion(previousState, formData): Promise<ActionState>`.

- [ ] **Step 1: Write failing suggestion-form test**

Assert collapsed `No encuentro mi categoría`, suggested name, optional details/root, pending copy, success status, and field errors.

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- components/products/category-suggestion-form.test.tsx lib/validation/category.test.ts`

Expected: FAIL on missing flow.

- [ ] **Step 3: Implement action and sibling form**

Authenticate with `getClaims`; validate; verify optional parent is active product root; insert seller ID, `es-MX`, pending status. Success: `Sugerencia enviada. La revisaremos antes de publicarla.` Failure: `No pudimos enviar la sugerencia.` Render as independent sibling form so product form DOM state survives.

- [ ] **Step 4: Pass tests and type-check**

Run: `npm test -- components/products/category-suggestion-form.test.tsx lib/validation/category.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit suggestions**

```bash
git add lib/actions/categories.ts components/products/category-suggestion-form.tsx components/products/category-suggestion-form.test.tsx 'app/panel/tiendas/[id]/productos/nuevo/page.tsx' 'app/panel/productos/[id]/editar/page.tsx'
git commit -m "feat: add category suggestion flow"
```

---

### Task 7: Optional seller-authored English product content

**Files:**
- Create: `lib/actions/product-translations.ts`, `components/products/product-translation-form.tsx`, `components/products/product-translation-form.test.tsx`
- Modify: edit product page, `lib/queries/catalog.server.ts`, `app/public-sharing.test.tsx`

**Interfaces:**
- `saveEnglishProductTranslation(productId, previousState, formData): Promise<ActionState>`.

- [ ] **Step 1: Write failing translation tests**

Assert `Agregar versión en inglés`, English name/description, complete-pair requirement, blank-pair removal, and success feedback.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- components/products/product-translation-form.test.tsx lib/validation/product-translation.test.ts app/public-sharing.test.tsx`

Expected: FAIL on missing UI.

- [ ] **Step 3: Implement owner-checked translation action**

Authenticate and verify parent shop ownership. Blank fields delete `en-US`; valid pair upserts manual/approved translation. Revalidate home, product, shop, and edit pages. Return `Versión en inglés guardada.`, `Versión en inglés eliminada.`, or `No pudimos guardar la versión en inglés.`

- [ ] **Step 4: Render editor and locale fallback**

Load existing English row on edit page and render separate form after ProductForm. For future `en-US` catalog calls, use approved translation then fall back to source name/description.

- [ ] **Step 5: Pass tests and type-check**

Run: `npm test -- components/products/product-translation-form.test.tsx lib/validation/product-translation.test.ts app/public-sharing.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit translations**

```bash
git add lib/actions/product-translations.ts components/products/product-translation-form.tsx components/products/product-translation-form.test.tsx 'app/panel/productos/[id]/editar/page.tsx' lib/queries/catalog.server.ts app/public-sharing.test.tsx
git commit -m "feat: add manual product translations"
```

---

### Task 8: Anonymous result-selection telemetry

**Files:**
- Create: `app/api/search-events/selection/route.ts`, `lib/validation/search-event.ts`, `lib/validation/search-event.test.ts`
- Modify: `components/catalog/product-card.tsx`, `components/catalog/product-card.test.tsx`

**Interfaces:**
- POST body `{ eventId: string, productId: number, position: number }`; response `204|400|500|503`.

- [ ] **Step 1: Write failing validation/card tests**

Assert UUID/positive IDs pass, position zero fails, tracked card sends one keepalive POST, and untracked card sends none.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- lib/validation/search-event.test.ts components/catalog/product-card.test.tsx`

Expected: FAIL on missing schema/click behavior.

- [ ] **Step 3: Implement route and non-blocking signal**

Validate JSON and invoke `record_search_selection`. Return 204 success, 400 invalid input, 503 unavailable Supabase, 500 RPC failure. ProductCard becomes Client Component and fires:

```ts
void fetch('/api/search-events/selection', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ eventId, productId: product.id, position }), keepalive: true,
});
```

Never block navigation or display telemetry errors.

- [ ] **Step 4: Pass tests and static gates**

Run: `npm test -- lib/validation/search-event.test.ts components/catalog/product-card.test.tsx`

Run: `npm run lint && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit telemetry**

```bash
git add app/api/search-events/selection/route.ts lib/validation/search-event.ts lib/validation/search-event.test.ts components/catalog/product-card.tsx components/catalog/product-card.test.tsx
git commit -m "feat: record search result selections"
```

---

### Task 9: Full verification and linked Supabase deployment

**Files:**
- Modify only files required by verification failures.

**Interfaces:**
- Consumes all previous deliverables; produces passing gates and deployed schema.

- [ ] **Step 1: Run complete app gates**

Run: `npm test`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run build`

Expected: all exit 0.

- [ ] **Step 2: Run clean database gates**

Run: `npx supabase db reset`

Run: `npx supabase test db`

Expected: migrations apply from zero and all pgTAP tests PASS.

- [ ] **Step 3: Inspect and deploy migration**

Run: `npx supabase db diff --linked`

Expected: no unrelated/destructive changes. Then run `npx supabase db push --linked`; expected new migration applies successfully.

- [ ] **Step 4: Verify remote schema read-only**

```sql
select listing_type, count(*) from public.categories group by listing_type;
select locale, count(*) from public.category_translations group by locale order by locale;
select count(*) from public.category_aliases;
select count(*) from public.products where status = 'published' and category_id is null;
```

Expected: product category count equals 11 roots plus listed leaves; both locales contain one translation per category; aliases exist; legacy uncategorized count is reported, not mutated.

- [ ] **Step 5: Review scope and commit verification fixes only**

Run: `git status --short`

Run: `git diff --check`

Expected: `.env.example` and `.gitignore` remain untouched. If verification changed feature files, stage exact paths and commit `fix: close category search verification gaps`; otherwise create no empty commit.

## Completion Criteria

- Every spec acceptance criterion maps to a task above.
- Vitest, ESLint, TypeScript, production build, clean DB reset, and pgTAP pass.
- Linked Supabase migration deploys and seed counts verify.
- No browser automation runs without explicit user permission.
- Existing `.env.example` and `.gitignore` changes remain untouched.
