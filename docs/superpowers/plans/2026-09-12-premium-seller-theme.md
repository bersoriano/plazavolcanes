# Premium Seller Theme Implementation Plan

> **Status: executed, with deviations.** The tasks below are the plan as written. Where the shipped code differs, the controller recorded a ruling in `.superpowers/sdd/2026-09-12-premium-seller-theme/progress.md`, and the spec describes what shipped. The key superseded points:
> - **Ruling 1:** the scope overrides `--font-bricolage: var(--font-fraunces-variable)`, not `--font-display`, because `@theme inline` bakes the variable into the utility.
> - **Ruling 2:** `admin_marketplace_users.test.sql` lists `shop_is_premium` in the RPC's argument names (19 fields).
> - **Ruling 8:** Task 2's pgTAP needed one more assertion than its `plan(15)`, and the product fixture needs `category_id`.
> - **Ruling 9:** a `BEFORE INSERT` trigger, `private.apply_shop_premium_defaults()`, scrubs the flag on seller inserts; the update guard alone left insert open.
> - **Ruling 13:** the workspace header stays light and renders `PremiumBadge` directly, with no scope wrapper.
> - **Ruling 14:** `setShopPremium` and `setShopPublishingApproval` share one helper, the two admin switches share one component, and the action has its own tests.
> - **Ruling 16:** `--accent` inside the scope is `#1e1a24`, not gold, because gold on gold measured 1:1. The tier pill uses a new `--trust-tier-fill` token.
> - **Ruling 17:** the base `* { border-color }` rule moved into `@layer base` so border colour utilities render.
> - **Ruling 18:** `premium_granted_at` and `premium_granted_by` are not on `public.shops`. They live in `private.shop_premium_grants`, written only by `set_shop_premium`, and a re-grant keeps the original row.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give administratively distinguished shops an obsidian-and-gold presentation across their public shop page, their product pages, their catalog listings, and their seller workspace header, granted per shop by an administrator and unforgeable by sellers.

**Architecture:** A new system-managed `is_premium` flag on `public.shops`, protected by the same trigger that already protects trust fields and written only through an admin-gated RPC. The visual difference is achieved by scoping CSS custom properties: a `[data-theme="premium"]` wrapper redefines the same tokens existing components already consume (`bg-surface`, `text-brand`, `text-muted`, `border-line`), so no component needs a variant prop. Three hardcoded colors are first replaced with tokens, because they would otherwise stay light inside a dark scope.

**Tech Stack:** Next.js 16 (App Router, React 19 server components), Tailwind CSS v4 (`@theme inline` token bridge), Supabase Postgres with pgTAP, Vitest + Testing Library, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-09-12-premium-seller-theme-design.md`

## Global Constraints

- Branch: `feat/premium-seller-theme`. Never commit to `main`. Verify with `git branch --show-current` before editing.
- Conventional Commits for every commit (`feat(...)`, `fix(...)`, `test(...)`, `style(...)`).
- Buyer-facing label is exactly `Premium`. Accessible name and tooltip text use `Tienda Premium`. All user-visible copy is Spanish.
- The flag is system-managed: sellers must never be able to write `is_premium`, `premium_granted_at`, or `premium_granted_by`. Database rejection message: `Los campos de confianza y publicación son administrados por el sistema.` (existing guard message, unchanged).
- RPC authorization failures raise SQLSTATE `42501`. Missing shop raises `P0002`.
- `lib/database.types.ts` is hand-maintained in this repo. There is no typegen script; edit it by hand when the schema changes.
- Premium theming never removes or weakens trust information. `TrustTierBadge` and `TrustBadges` stay present and unchanged in meaning.
- Site header, footer, bottom nav, and checkout are never premium-themed.
- Every text pair must meet WCAG AA (4.5:1 body text). Premium palette values, used verbatim: background `#0f0d12`, surface `#16131a`, raised surface `#1e1a24`, text `#f5f1ea`, muted text `#a9a0b0`, border `#3a3142`, brand/accent gold `#e8c777`, brand hover `#f2d894`, on-brand `#16131a`, photo backdrop `#211c27`.
- Verification commands: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npx supabase test db` for database tests.

---

## File Structure

**Created:**
- `supabase/migrations/20260912090000_add_shop_premium_status.sql` — columns, guard extension, `set_shop_premium`, extended admin listing RPC
- `supabase/tests/database/shop_premium.test.sql` — pgTAP coverage for the flag and the RPC
- `components/shops/premium-badge.tsx` — the `Premium` pill
- `components/shops/premium-badge.test.tsx`
- `components/shops/premium-scope.tsx` — the `data-theme="premium"` wrapper
- `components/shops/premium-scope.test.tsx`

**Modified:**
- `app/globals.css` — three new default tokens, the premium scope block, `gold-rule` utility, scoped focus ring and selection
- `app/layout.tsx` — Fraunces font variable
- `components/ui/button.tsx` — `text-white` → `text-on-brand`, `bg-white` → `bg-surface-raised`
- `components/ui/button.test.tsx` — assertion follows the token
- `components/share/share-actions.tsx` — `bg-white` → `bg-surface-raised`
- `components/catalog/product-gallery.tsx` — three `bg-[#eee8e1]` → `bg-photo-backdrop`
- `components/catalog/product-card.tsx` — photo backdrop token, premium ring and chip
- `components/catalog/shop-card.tsx` — photo backdrop token, premium ring and chip
- `app/tiendas/[slug]/page.tsx` — photo backdrop token, premium scope and hero treatment
- `app/tiendas/[slug]/page.test.tsx` — premium assertions
- `app/productos/[slug]/page.tsx` — premium scope and badge
- `app/productos/[slug]/page.test.tsx` — premium assertions
- `components/shops/shop-workspace-header.tsx` — premium badge and note
- `components/shops/shop-workspace-header.test.tsx` — premium assertions
- `app/panel/tiendas/[id]/page.tsx` — passes `isPremium` to the header
- `lib/database.types.ts` — shops row/insert/update columns, `set_shop_premium`, extended listing row
- `lib/queries/catalog.server.ts` — `is_premium` in `productSelection`, in the row type, in `CatalogProduct.shop`, in `mapProduct`
- `lib/queries/catalog.server.test.ts` — passthrough assertion
- `lib/queries/admin.ts` — `shop_is_premium` on the RPC row, `isPremium` on the mapped shop
- `lib/queries/admin.test.ts` — mapper assertion
- `lib/actions/admin-publication.ts` — `setShopPremium`
- `components/admin/marketplace-users.tsx` — premium switch
- `components/admin/marketplace-users.test.tsx` — switch assertions

---

## Task 1: Token gaps that block any theme scope

Three hardcoded colors survive a scoped theme and would render light inside an obsidian surface. Replacing them with tokens changes nothing visually today, which is exactly why it is a separate, independently reviewable task.

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ui/button.tsx:5-10`
- Modify: `components/share/share-actions.tsx:70`
- Modify: `components/catalog/product-gallery.tsx:68`, `:80`, `:101`
- Modify: `components/catalog/product-card.tsx:68`
- Modify: `components/catalog/shop-card.tsx:12`
- Modify: `app/tiendas/[slug]/page.tsx:48`
- Test: `components/ui/button.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utilities `bg-photo-backdrop`, `text-on-brand`, `bg-surface-raised`, backed by CSS custom properties `--photo-backdrop`, `--on-brand`, `--surface-raised`. Every later task depends on these existing.

- [ ] **Step 1: Write the failing test**

Replace the primary-variant assertion in `components/ui/button.test.tsx` (the `renders an accessible aubergine primary action` case) with token-based assertions:

```tsx
  it("renders an accessible aubergine primary action", () => {
    render(<Button>Crear tienda</Button>);

    const button = screen.getByRole("button", { name: "Crear tienda" });
    expect(button).toHaveClass("bg-[var(--brand)]");
    // The label colour follows a token, so a themed scope can darken it where
    // the brand colour is light enough to swallow white text.
    expect(button).toHaveClass("text-on-brand");
  });

  it("renders a secondary action on a tokenised raised surface", () => {
    render(<Button variant="secondary">Cancelar</Button>);

    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("bg-surface-raised");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/button.test.tsx`
Expected: FAIL — both new assertions report the element has `text-white` / `bg-white` instead.

- [ ] **Step 3: Add the three default tokens**

In `app/globals.css`, add to the `:root` block (after `--border`):

```css
  --surface-raised: #ffffff;
  --on-brand: #ffffff;
  --photo-backdrop: #eee8e1;
```

And to the `@theme inline` block (after `--color-line`):

```css
  --color-surface-raised: var(--surface-raised);
  --color-on-brand: var(--on-brand);
  --color-photo-backdrop: var(--photo-backdrop);
```

- [ ] **Step 4: Point the components at the tokens**

`components/ui/button.tsx` — variants map becomes:

```tsx
const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand)] text-on-brand hover:bg-[var(--brand-hover)] shadow-[0_8px_24px_rgba(50,23,77,0.16)]",
  secondary:
    "border border-[var(--border)] bg-surface-raised text-[var(--brand)] hover:border-[var(--brand)]",
  ghost: "bg-transparent text-[var(--brand)] hover:bg-[var(--accent)]",
};
```

`components/share/share-actions.tsx:70` — in the WhatsApp anchor's class string, replace `bg-white` with `bg-surface-raised`.

Replace `bg-[#eee8e1]` with `bg-photo-backdrop` at each of these sites, leaving the rest of every class string untouched:
- `components/catalog/product-gallery.tsx:68` (empty-state frame), `:80` (zoom button), `:101` (thumbnail button)
- `components/catalog/product-card.tsx:68` (image frame)
- `components/catalog/shop-card.tsx:12` (image frame)
- `app/tiendas/[slug]/page.tsx:48` (hero frame)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/ui/button.test.tsx`
Expected: PASS

Run: `grep -rn "bg-\[#eee8e1\]" app components`
Expected: no output.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: all pass. If another test asserted `text-white` on a brand-filled button, update that assertion to `text-on-brand` — the rendered colour is unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css components/ui/button.tsx components/ui/button.test.tsx components/share/share-actions.tsx components/catalog/product-gallery.tsx components/catalog/product-card.tsx components/catalog/shop-card.tsx "app/tiendas/[slug]/page.tsx"
git commit -m "style(theme): drive photo backdrops and button ink from tokens"
```

---

## Task 2: Premium flag in the database

**Files:**
- Create: `supabase/migrations/20260912090000_add_shop_premium_status.sql`
- Create: `supabase/tests/database/shop_premium.test.sql`

**Interfaces:**
- Consumes: existing `private.guard_shop_trust_cache()`, `public.is_current_user_admin()`, `private.shop_limit_for(uuid)`, `public.list_admin_marketplace_users()`.
- Produces: `public.shops.is_premium boolean not null default false`, `public.shops.premium_granted_at timestamptz`, `public.shops.premium_granted_by uuid`; `public.set_shop_premium(p_shop_id bigint, p_enabled boolean) returns table (shop_id bigint, shop_slug text, product_slugs text[])`; `public.list_admin_marketplace_users()` gains a `shop_is_premium boolean` column positioned immediately after `shop_is_publishing_approved`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/shop_premium.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_column('public', 'shops', 'is_premium',
  'shop records whether administration distinguished it');
select has_column('public', 'shops', 'premium_granted_at',
  'shop records when the distinction was granted');
select has_column('public', 'shops', 'premium_granted_by',
  'shop records which administrator granted the distinction');
select has_function('public', 'set_shop_premium', array['bigint', 'boolean'],
  'administrator can set a shop premium status');

insert into auth.users (id, email, created_at) values
  ('30000000-0000-4000-8000-000000000001', 'admin-premium@test.local', now()),
  ('30000000-0000-4000-8000-000000000002', 'seller-premium@test.local', now());

insert into private.admin_users (user_id, granted_by) values
  ('30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000001');

insert into public.shops (id, owner_id, name, slug, description)
overriding system value
values (
  9101,
  '30000000-0000-4000-8000-000000000002',
  'Casa Premium',
  'casa-premium',
  'Descripción suficientemente larga para la tienda distinguida.'
);

insert into public.products (
  id, shop_id, name, slug, description, price_mxn, status, is_admin_enabled
)
overriding system value
values (
  9201,
  9101,
  'Jarra de barro',
  'jarra-de-barro-premium',
  'Pieza descrita con suficiente detalle para la prueba.',
  700,
  'published',
  true
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$update public.shops set is_premium = true where id = 9101$$,
  '42501',
  'Los campos de confianza y publicación son administrados por el sistema.',
  'seller cannot award itself the premium distinction'
);

select throws_ok(
  $$select public.set_shop_premium(9101, true)$$,
  '42501',
  'Solo administración puede cambiar la distinción Premium.',
  'non-administrator cannot grant the premium distinction'
);

set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  (select shop_slug from public.set_shop_premium(9101, true)),
  'casa-premium',
  'grant returns the shop slug for revalidation'
);

select is(
  (select product_slugs from public.set_shop_premium(9101, true)),
  array['jarra-de-barro-premium']::text[],
  'grant returns published product slugs for revalidation'
);

select is(
  (select is_premium from public.shops where id = 9101),
  true,
  'administrator grants the premium distinction'
);

select isnt(
  (select premium_granted_at from public.shops where id = 9101),
  null,
  'granting stamps the moment of the decision'
);

select is(
  (select premium_granted_by from public.shops where id = 9101),
  '30000000-0000-4000-8000-000000000001'::uuid,
  'granting records the administrator who decided'
);

select is(
  (select shop_is_premium
   from public.list_admin_marketplace_users()
   where shop_id = 9101
   limit 1),
  true,
  'administration screen reads the current premium status'
);

select lives_ok(
  $$select public.set_shop_premium(9101, false)$$,
  'administrator withdraws the premium distinction'
);

select is(
  (select is_premium from public.shops where id = 9101),
  false,
  'withdrawal clears the premium flag'
);

select is(
  (select premium_granted_at from public.shops where id = 9101),
  null,
  'withdrawal clears the grant timestamp'
);

select is(
  (select premium_granted_by from public.shops where id = 9101),
  null,
  'withdrawal clears the granting administrator'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx supabase test db`
Expected: FAIL — `has_column` assertions fail and `set_shop_premium` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260912090000_add_shop_premium_status.sql`:

```sql
alter table public.shops
  add column is_premium boolean not null default false,
  add column premium_granted_at timestamptz,
  add column premium_granted_by uuid references auth.users (id) on delete set null;

-- The distinction is administration's decision, so it joins the trust fields a
-- seller may read but never write.
create or replace function private.guard_shop_trust_cache()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') and (
    new.trust_tier is distinct from old.trust_tier
    or new.listing_limit is distinct from old.listing_limit
    or new.trust_evaluated_at is distinct from old.trust_evaluated_at
    or new.is_publishing_approved is distinct from old.is_publishing_approved
    or new.publishing_reviewed_at is distinct from old.publishing_reviewed_at
    or new.is_premium is distinct from old.is_premium
    or new.premium_granted_at is distinct from old.premium_granted_at
    or new.premium_granted_by is distinct from old.premium_granted_by
  ) then
    raise exception using
      errcode = '42501',
      message = 'Los campos de confianza y publicación son administrados por el sistema.';
  end if;
  return new;
end;
$$;

create function public.set_shop_premium(p_shop_id bigint, p_enabled boolean)
returns table (shop_id bigint, shop_slug text, product_slugs text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop_slug text;
  v_product_slugs text[];
begin
  if auth.uid() is null or not (select public.is_current_user_admin()) then
    raise exception using
      errcode = '42501',
      message = 'Solo administración puede cambiar la distinción Premium.';
  end if;

  update public.shops s
  set is_premium = p_enabled,
      premium_granted_at = case when p_enabled then now() else null end,
      premium_granted_by = case when p_enabled then auth.uid() else null end,
      updated_at = now()
  where s.id = p_shop_id
  returning s.slug into v_shop_slug;

  if not found then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;

  select coalesce(array_agg(p.slug order by p.id), '{}'::text[])
  into v_product_slugs
  from public.products p
  where p.shop_id = p_shop_id
    and p.status = 'published';

  return query select p_shop_id, v_shop_slug, v_product_slugs;
end;
$$;

revoke all on function public.set_shop_premium(bigint, boolean) from public, anon;
grant execute on function public.set_shop_premium(bigint, boolean) to authenticated;

drop function public.list_admin_marketplace_users();

create function public.list_admin_marketplace_users()
returns table (
  user_id uuid,
  email text,
  user_created_at timestamp with time zone,
  display_name text,
  shop_limit integer,
  shop_id bigint,
  shop_name text,
  shop_slug text,
  shop_created_at timestamp with time zone,
  shop_is_publishing_approved boolean,
  shop_is_premium boolean,
  product_id bigint,
  product_name text,
  product_slug text,
  product_status text,
  product_is_admin_enabled boolean,
  product_expires_at timestamp with time zone,
  product_created_at timestamp with time zone,
  product_updated_at timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501',
      message = 'Solo administración puede consultar usuarios.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    d.display_name,
    private.shop_limit_for(u.id),
    s.id,
    s.name,
    s.slug,
    s.created_at,
    s.is_publishing_approved,
    s.is_premium,
    p.id,
    p.name,
    p.slug,
    p.status,
    p.is_admin_enabled,
    p.expires_at,
    p.created_at,
    p.updated_at
  from auth.users u
  left join public.user_display_names d on d.user_id = u.id
  left join public.shops s on s.owner_id = u.id
  left join public.products p
    on p.shop_id = s.id and p.status in ('draft', 'published', 'expired')
  order by u.created_at desc, u.id, s.created_at desc nulls last, s.id,
           p.created_at desc nulls last, p.id;
end;
$$;

revoke all on function public.list_admin_marketplace_users() from public, anon;
grant execute on function public.list_admin_marketplace_users() to authenticated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx supabase test db`
Expected: PASS — 15 of 15 in `shop_premium.test.sql`, and every other database test still passing. `admin_marketplace_users.test.sql` exercises the replaced listing function; if it asserts a column count or ordering, the added column is the cause — update that expectation, do not remove the column.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912090000_add_shop_premium_status.sql supabase/tests/database/shop_premium.test.sql
git commit -m "feat(shops): let administration distinguish a shop as Premium"
```

---

## Task 3: Carry the flag through types and queries

**Files:**
- Modify: `lib/database.types.ts:411-470` (shops Row/Insert/Update), `:664-690` (Functions)
- Modify: `lib/queries/catalog.server.ts:34-38` (`CatalogProduct.shop`), `:41-42` (`productSelection`), `:55-67` (`ProductQueryRow.shops`), `:96-103` (`mapProduct`)
- Modify: `lib/queries/admin.ts`
- Test: `lib/queries/catalog.server.test.ts`, `lib/queries/admin.test.ts`

**Interfaces:**
- Consumes: `public.shops.is_premium` and the extended `list_admin_marketplace_users()` from Task 2.
- Produces: `CatalogProduct["shop"]["is_premium"]: boolean`; `Shop["is_premium"]: boolean` (via `lib/database.types.ts`); `AdminMarketplaceRpcRow["shop_is_premium"]: boolean | null`; `AdminMarketplaceShop["isPremium"]: boolean`; `Database["public"]["Functions"]["set_shop_premium"]`.

- [ ] **Step 1: Write the failing tests**

In `lib/queries/admin.test.ts`, add:

```ts
it("carries the premium distinction onto each mapped shop", () => {
  const [user] = mapAdminMarketplaceUsers([
    {
      user_id: "persona-1",
      email: "lucia@tallervolcan.mx",
      user_created_at: "2026-08-01T00:00:00.000Z",
      display_name: "Lucía Martínez",
      shop_limit: 1,
      shop_id: 1,
      shop_name: "Taller Volcán",
      shop_slug: "taller-volcan",
      shop_created_at: "2026-08-02T00:00:00.000Z",
      shop_is_publishing_approved: true,
      shop_is_premium: true,
      product_id: null,
      product_name: null,
      product_slug: null,
      product_status: null,
      product_is_admin_enabled: null,
      product_expires_at: null,
      product_created_at: null,
      product_updated_at: null,
    },
  ]);

  expect(user.shops[0].isPremium).toBe(true);
});
```

If `lib/queries/admin.test.ts` already builds rows through a local helper, use that helper and pass `shop_is_premium: true` instead of restating the row.

In `lib/queries/catalog.server.test.ts`, inside the `getHomeCatalog` describe block, add a case modelled on the existing `keeps selected shop location and tier evidence on catalog products` test — copy that test's mock setup verbatim, add `is_premium: true` to the `shops` object of the product row, and assert:

```ts
    expect(catalog.products[0].shop.is_premium).toBe(true);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/queries/admin.test.ts lib/queries/catalog.server.test.ts`
Expected: FAIL — `isPremium` is `undefined`, and `shop.is_premium` does not exist on the type or the result.

- [ ] **Step 3: Extend the generated types by hand**

In `lib/database.types.ts`, `shops.Row` (after `is_publishing_approved`):

```ts
          is_premium: boolean;
          premium_granted_at: string | null;
          premium_granted_by: string | null;
```

In `shops.Insert` and `shops.Update`, the same three keys as optional:

```ts
          is_premium?: boolean;
          premium_granted_at?: string | null;
          premium_granted_by?: string | null;
```

In the `Functions` block, beside `set_shop_publishing_approval`:

```ts
      set_shop_premium: {
        Args: { p_shop_id: number; p_enabled: boolean };
        Returns: { shop_id: number; shop_slug: string; product_slugs: string[] }[];
      };
```

In the `list_admin_marketplace_users` `Returns` row type, add `shop_is_premium: boolean | null;` immediately after `shop_is_publishing_approved`.

- [ ] **Step 4: Thread it through the catalog query**

In `lib/queries/catalog.server.ts`:

`CatalogProduct["shop"]` becomes:

```ts
  shop: Pick<Shop, "name" | "slug" | "country_code" | "trust_tier" | "is_premium"> & {
    administrative_area_codes: string[];
  };
```

`productSelection` — add `is_premium` to the shops join (keep every other field and the `!inner` modifier):

```ts
const productSelection =
  "id, slug, name, description, price_mxn, units_available, condition, used_condition, image_path, created_at, category_id, currency_code, is_admin_enabled, expires_at, shops!inner(id, owner_id, name, slug, country_code, administrative_area_codes, trust_tier, is_publishing_approved, is_premium), product_translations(locale, name, description, review_status)";
```

`ProductQueryRow["shops"]` — add `is_premium: boolean;` after `is_publishing_approved`.

`mapProduct` — in the returned `shop` object, after `trust_tier`:

```ts
      is_premium: item.shops.is_premium,
```

`getPublicShop` already selects `*`, so the flag reaches the shop page with no further change.

- [ ] **Step 5: Thread it through the admin mapper**

In `lib/queries/admin.ts`:

- `AdminMarketplaceRpcRow`: add `shop_is_premium: boolean | null;` after `shop_is_publishing_approved`.
- `AdminMarketplaceShop`: add `isPremium: boolean;` after `isPublishingApproved`.
- In `mapAdminMarketplaceUsers`, where the shop object is built, add `isPremium: row.shop_is_premium ?? false,` after `isPublishingApproved`. Do **not** add `shop_is_premium` to the null-guard that skips rows without a shop: a missing flag must default to false rather than discard the shop.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/queries/admin.test.ts lib/queries/catalog.server.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS. Any error naming `is_premium` as missing points at a test fixture building a `CatalogProduct.shop`; add `is_premium: false` there.

- [ ] **Step 7: Commit**

```bash
git add lib/database.types.ts lib/queries/catalog.server.ts lib/queries/catalog.server.test.ts lib/queries/admin.ts lib/queries/admin.test.ts
git commit -m "feat(catalog): carry the premium distinction through queries and types"
```

---

## Task 4: The premium theme scope

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx:1-21`, `:44-46`
- Create: `components/shops/premium-scope.tsx`
- Test: `components/shops/premium-scope.test.tsx`

**Interfaces:**
- Consumes: the tokens from Task 1.
- Produces: `PremiumScope({ premium, children, className }: { premium: boolean; children: ReactNode; className?: string })` from `@/components/shops/premium-scope` — renders a `<div data-theme="premium">` with `bg-background text-ink` plus any `className` when `premium` is true, and renders `children` unwrapped when false. Also produces the `gold-rule` utility class and the CSS variables `--premium-gold`, `--premium-ink`, `--premium-text` with Tailwind utilities `bg-premium-ink`, `text-premium-gold`, `ring-premium-gold`, `text-premium-text`.

- [ ] **Step 1: Write the failing test**

Create `components/shops/premium-scope.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumScope } from "@/components/shops/premium-scope";

afterEach(cleanup);

describe("PremiumScope", () => {
  it("opens a premium theme scope around a distinguished shop", () => {
    render(
      <PremiumScope premium>
        <p>Casa Premium</p>
      </PremiumScope>,
    );

    const scope = screen.getByText("Casa Premium").closest("[data-theme]");
    expect(scope).toHaveAttribute("data-theme", "premium");
    expect(scope).toHaveClass("bg-background");
  });

  it("leaves an ordinary shop in the ordinary theme", () => {
    render(
      <PremiumScope premium={false}>
        <p>Casa Niebla</p>
      </PremiumScope>,
    );

    expect(screen.getByText("Casa Niebla").closest("[data-theme]")).toBeNull();
  });

  it("keeps extra layout classes the caller needs on the scope", () => {
    render(
      <PremiumScope className="pb-10" premium>
        <p>Casa Premium</p>
      </PremiumScope>,
    );

    expect(screen.getByText("Casa Premium").closest("[data-theme]")).toHaveClass("pb-10");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shops/premium-scope.test.tsx`
Expected: FAIL — cannot resolve `@/components/shops/premium-scope`.

- [ ] **Step 3: Write the scope component**

Create `components/shops/premium-scope.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * The room a distinguished shop is shown in.
 *
 * Every component below already draws its colour from tokens, so the whole
 * subtree turns obsidian and gold the moment those tokens are redefined. An
 * ordinary shop is left unwrapped rather than given a second, identical
 * wrapper, so nothing about its markup changes.
 */
export function PremiumScope({
  premium,
  children,
  className = "",
}: {
  premium: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!premium) return <>{children}</>;

  return (
    <div className={`bg-background text-ink ${className}`.trim()} data-theme="premium">
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shops/premium-scope.test.tsx`
Expected: PASS

- [ ] **Step 5: Add the premium tokens and scope to the stylesheet**

In `app/globals.css`, add to `:root`:

```css
  --premium-gold: #e8c777;
  --premium-ink: #16131a;
  --premium-text: #6f5412;
```

Add to `@theme inline`:

```css
  --color-premium-gold: var(--premium-gold);
  --color-premium-ink: var(--premium-ink);
  --color-premium-text: var(--premium-text);
  --font-fraunces: var(--font-fraunces-variable);
```

Then, after the `body` rule, add the scope:

```css
/*
 * A distinguished shop's own room.
 *
 * Nothing here restyles a component: the same tokens every component already
 * reads are given different values inside the scope, so the whole subtree turns
 * obsidian and gold at once. The site's header and footer stay outside it, so
 * the marketplace still reads as one place.
 */
[data-theme="premium"] {
  --background: #0f0d12;
  --surface: #16131a;
  --surface-raised: #1e1a24;
  --text: #f5f1ea;
  --text-muted: #a9a0b0;
  --border: #3a3142;
  --brand: #e8c777;
  --brand-hover: #f2d894;
  --accent: #e8c777;
  --on-brand: #16131a;
  --photo-backdrop: #211c27;
  --premium-text: #e8c777;
  --font-display: var(--font-fraunces-variable);

  color: var(--text);
}

/* The site's focus ring pairs an aubergine outline with a lime shadow, and
   aubergine is invisible on obsidian. Gold carries the same two-tone ring. */
[data-theme="premium"] :where(a, button, input, textarea, select):focus-visible {
  box-shadow: 0 0 0 3px var(--surface);
  outline: 3px solid var(--brand);
}

[data-theme="premium"] ::selection {
  background: var(--brand);
  color: var(--premium-ink);
}

/* A hairline that reads as metal rather than as a border. */
@utility gold-rule {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--premium-gold) 18%,
    var(--premium-gold) 82%,
    transparent
  );
}
```

- [ ] **Step 6: Load the serif display face**

In `app/layout.tsx`, extend the font import and add the instance:

```tsx
import { Bricolage_Grotesque, Fraunces, Instrument_Sans } from "next/font/google";
```

```tsx
// Bound to --font-display only inside the premium scope, so an ordinary page
// keeps Bricolage and this face costs it nothing but the stylesheet entry.
const fraunces = Fraunces({
  variable: "--font-fraunces-variable",
  subsets: ["latin"],
  display: "swap",
});
```

And add it to the `<html>` class list:

```tsx
      className={`${bricolage.variable} ${instrument.variable} ${fraunces.variable}`}
```

- [ ] **Step 7: Verify the scope renders**

Run: `npm run build`
Expected: PASS — the build fetches the Fraunces files, so a failure here is usually a network-restricted environment, not a code error. If the build cannot reach Google Fonts, note it and continue; the variable binding is still correct.

Run: `npm run test && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/globals.css app/layout.tsx components/shops/premium-scope.tsx components/shops/premium-scope.test.tsx
git commit -m "feat(theme): add the obsidian and gold premium scope"
```

---

## Task 5: The Premium badge

**Files:**
- Create: `components/shops/premium-badge.tsx`
- Test: `components/shops/premium-badge.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 4.
- Produces: `PremiumBadge({ showDetails }: { showDetails?: boolean })` from `@/components/shops/premium-badge`, defaulting `showDetails` to `true`. Mirrors `TrustTierBadge`'s prop so both badges can sit side by side on a card with details suppressed.

- [ ] **Step 1: Write the failing test**

Create `components/shops/premium-badge.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PremiumBadge } from "@/components/shops/premium-badge";

afterEach(cleanup);

describe("PremiumBadge", () => {
  it("names the distinction for sighted and assistive readers alike", () => {
    render(<PremiumBadge />);

    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tienda Premium" })).toBeInTheDocument();
  });

  it("says who grants the distinction, so it is not read as a measured metric", () => {
    render(<PremiumBadge />);

    expect(screen.getByRole("tooltip")).toHaveTextContent(
      /Plaza Volcanes distingue a esta tienda/,
    );
  });

  it("drops the explanation where there is no room for it", () => {
    render(<PremiumBadge showDetails={false} />);

    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shops/premium-badge.test.tsx`
Expected: FAIL — cannot resolve `@/components/shops/premium-badge`.

- [ ] **Step 3: Write the badge**

Create `components/shops/premium-badge.tsx`:

```tsx
import { CircleHelp, Sparkles } from "lucide-react";

/**
 * The mark of a shop administration has distinguished.
 *
 * The tooltip names Plaza Volcanes as the one who grants it: the trust tier
 * beside it is measured, this is chosen, and a buyer deserves to know which is
 * which.
 */
export function PremiumBadge({ showDetails = true }: { showDetails?: boolean }) {
  return (
    <div
      aria-label="Tienda Premium"
      className="group relative mt-4 inline-flex items-center gap-2 rounded-full border border-premium-gold bg-premium-ink px-3 py-2 text-sm font-bold text-premium-gold"
      role="group"
    >
      <Sparkles aria-hidden="true" className="size-4" />
      Premium
      {showDetails ? (
        <>
          <button
            aria-describedby="premium-badge-tooltip"
            aria-label="Más información sobre la distinción Premium"
            className="tap-halo grid size-5 place-items-center rounded-full text-premium-gold/70 hover:text-premium-gold"
            type="button"
          >
            <CircleHelp aria-hidden="true" className="size-3.5" />
          </button>
          <span
            className="pointer-events-none absolute left-0 top-[calc(100%+.5rem)] z-30 w-72 rounded-xl bg-premium-ink px-3 py-2 text-xs font-normal leading-5 text-[#f5f1ea] opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            id="premium-badge-tooltip"
            role="tooltip"
          >
            Plaza Volcanes distingue a esta tienda. No sustituye a las métricas de
            confianza, que se miden aparte y nadie puede editar.
          </span>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/shops/premium-badge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/shops/premium-badge.tsx components/shops/premium-badge.test.tsx
git commit -m "feat(shops): add the Premium distinction badge"
```

---

## Task 6: Premium public shop page

**Files:**
- Modify: `app/tiendas/[slug]/page.tsx`
- Test: `app/tiendas/[slug]/page.test.tsx`

**Interfaces:**
- Consumes: `PremiumScope`, `PremiumBadge`, `shop.is_premium` from `getPublicShop`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Add to `app/tiendas/[slug]/page.test.tsx`:

```tsx
test("shows a distinguished shop in its own premium room", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: true });

  const { container } = await renderPage();

  expect(container.querySelector('[data-theme="premium"]')).not.toBeNull();
  expect(screen.getByRole("group", { name: "Tienda Premium" })).toBeInTheDocument();
});

test("leaves an ordinary shop in the ordinary theme", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: false });

  const { container } = await renderPage();

  expect(container.querySelector('[data-theme="premium"]')).toBeNull();
  expect(screen.queryByRole("group", { name: "Tienda Premium" })).toBeNull();
});

test("keeps the measured trust badge beside the granted distinction", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: true });

  await renderPage();

  expect(screen.getByText("Nivel Estándar")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/tiendas/[slug]/page.test.tsx"`
Expected: FAIL — no `[data-theme="premium"]` element, no `Tienda Premium` group.

- [ ] **Step 3: Wrap the page in the scope**

In `app/tiendas/[slug]/page.tsx`:

Add the imports:

```tsx
import { PremiumBadge } from "@/components/shops/premium-badge";
import { PremiumScope } from "@/components/shops/premium-scope";
```

Derive the flag right after the shop is loaded (a shop row from before the column existed reads as not premium):

```tsx
  const isPremium = shop.is_premium === true;
```

Wrap the whole returned `<section>` in the scope so the obsidian background reaches the viewport edges rather than stopping at the content column:

```tsx
  return (
    <PremiumScope className="pb-4" premium={isPremium}>
      <section className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        {/* …existing content… */}
      </section>
    </PremiumScope>
  );
```

- [ ] **Step 4: Give the premium hero its treatment**

Still in the same file, make these four changes inside the existing markup:

The hero frame aspect — a distinguished shop gets the wider cinematic crop:

```tsx
        <div
          className={`relative bg-photo-backdrop ${
            isPremium ? "aspect-[21/9] sm:aspect-[21/6] sm:min-h-48" : "aspect-[16/9] sm:aspect-[4/1] sm:min-h-40"
          }`}
        >
```

The badge, beside the existing trust badge:

```tsx
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <h1
              className={`font-display text-4xl font-semibold sm:text-5xl ${
                isPremium ? "tracking-[-0.02em]" : "tracking-[-0.04em]"
              }`}
            >
              {shop.name}
            </h1>
            <TrustTierBadge tier={shop.trust_tier} />
            {isPremium ? <PremiumBadge /> : null}
          </div>
```

A gold hairline between the identity block and the description, rendered only in the premium room:

```tsx
          {isPremium ? <div aria-hidden="true" className="gold-rule mt-6" /> : null}
```

Place that line immediately before the `<p className="mt-4 max-w-2xl …">{shop.description}</p>` element.

The showcase eyebrow and heading need no change: both already use `text-brand` and `font-display`, which the scope has redefined.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run "app/tiendas/[slug]/page.test.tsx"`
Expected: PASS — all tests in the file, including the pre-existing delivery-policy and enquiry cases.

- [ ] **Step 6: Commit**

```bash
git add "app/tiendas/[slug]/page.tsx" "app/tiendas/[slug]/page.test.tsx"
git commit -m "feat(shops): show a distinguished shop in the premium theme"
```

---

## Task 7: Premium public product page

**Files:**
- Modify: `app/productos/[slug]/page.tsx`
- Test: `app/productos/[slug]/page.test.tsx`

**Interfaces:**
- Consumes: `PremiumScope`, `PremiumBadge`, `product.shop.is_premium` from `getPublicProduct`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Open `app/productos/[slug]/page.test.tsx` and read how it mocks `getPublicProduct` and renders the page. Add, using that file's own fixture name in place of `product`:

```tsx
test("shows a distinguished shop's product in the premium room", async () => {
  getPublicProduct.mockResolvedValue({
    ...product,
    shop: { ...product.shop, is_premium: true },
  });

  const { container } = await renderPage();

  expect(container.querySelector('[data-theme="premium"]')).not.toBeNull();
  expect(screen.getByRole("group", { name: "Tienda Premium" })).toBeInTheDocument();
});

test("leaves an ordinary shop's product in the ordinary theme", async () => {
  getPublicProduct.mockResolvedValue({
    ...product,
    shop: { ...product.shop, is_premium: false },
  });

  const { container } = await renderPage();

  expect(container.querySelector('[data-theme="premium"]')).toBeNull();
});
```

If that test file has no `renderPage` helper, call the page component the way its existing tests do.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/productos/[slug]/page.test.tsx"`
Expected: FAIL — no premium scope element.

- [ ] **Step 3: Wrap the page and mark the shop link**

In `app/productos/[slug]/page.tsx`, add the imports:

```tsx
import { PremiumBadge } from "@/components/shops/premium-badge";
import { PremiumScope } from "@/components/shops/premium-scope";
```

Derive the flag after the product is loaded:

```tsx
  const isPremium = product.shop.is_premium === true;
```

Wrap the returned `<section className="mx-auto max-w-6xl …">` in `<PremiumScope className="pb-4" premium={isPremium}>`, closing it after the section.

Put the badge beside the shop backlink, inside the right-hand column, replacing the bare `<Link …>` with:

```tsx
          <div className="flex flex-wrap items-center gap-3">
            <Link className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-brand-hover" href={`/tiendas/${product.shop.slug}`}>
              <Store aria-hidden="true" className="size-4" />
              {product.shop.name}
            </Link>
            {isPremium ? <PremiumBadge showDetails={false} /> : null}
          </div>
```

The price, condition pill, divider, description, and the closing note all read from tokens already and need no change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/productos/[slug]/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/productos/[slug]/page.tsx" "app/productos/[slug]/page.test.tsx"
git commit -m "feat(catalog): frame a distinguished shop's product in the premium theme"
```

---

## Task 8: Premium marks on catalog cards

A dark card inside a light grid reads as a layout defect. Premium cards keep the light surface and carry an obsidian chip with gold text plus a gold hairline ring on the image — a preview of the room the click leads to.

**Files:**
- Modify: `components/catalog/product-card.tsx:20-38` (props), `:66-90` (markup)
- Modify: `components/catalog/shop-card.tsx`
- Test: `components/catalog/product-card.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `CatalogProduct["shop"]["is_premium"]` from Task 3, `CatalogShop` (a full `Shop` row, so `is_premium` is already on it), premium tokens from Task 4.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Create `components/catalog/product-card.test.tsx` (if the file exists, add these cases to it):

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductCard } from "@/components/catalog/product-card";

afterEach(cleanup);

const product = {
  id: 7,
  slug: "taza-de-barro",
  imageUrl: null,
  name: "Taza de barro",
  price_mxn: 480,
  currency_code: "MXN",
  condition: "new" as const,
  used_condition: null,
  shop: {
    name: "Casa Premium",
    country_code: "MX",
    administrative_area_codes: ["MX-OAX"],
    trust_tier: "standard" as const,
    is_premium: false,
  },
};

describe("ProductCard", () => {
  it("marks a distinguished shop's listing in the ordinary grid", () => {
    render(<ProductCard product={{ ...product, shop: { ...product.shop, is_premium: true } }} />);

    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("leaves an ordinary listing unmarked", () => {
    render(<ProductCard product={product} />);

    expect(screen.queryByText("Premium")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/catalog/product-card.test.tsx`
Expected: FAIL — no `Premium` text, and TypeScript rejects `is_premium` on the card's `shop` prop type.

- [ ] **Step 3: Mark the premium product card**

In `components/catalog/product-card.tsx`, add `is_premium?: boolean;` to the `shop` object inside `ProductCardProps` (optional, because the seller panel and tests build lighter fixtures), then derive and apply it:

```tsx
  const isPremium = product.shop.is_premium === true;
```

The image frame gains the ring, and the chip sits opposite the condition pill:

```tsx
      <div
        className={`relative aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-photo-backdrop ${
          isPremium ? "ring-1 ring-premium-gold ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <span className="absolute left-3 top-3 z-10 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-semibold text-brand shadow-sm">
          {formatProductCondition(product.condition, product.used_condition)}
        </span>
        {isPremium ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-premium-ink px-2.5 py-1.5 text-xs font-bold text-premium-gold shadow-sm">
            <Sparkles aria-hidden="true" className="size-3" />
            Premium
          </span>
        ) : null}
```

Add `Sparkles` to the existing lucide import:

```tsx
import { ImageIcon, Sparkles } from "lucide-react";
```

And give the shop name the deeper gold ink when premium, leaving the rest of the meta line alone:

```tsx
          <span className={isPremium ? "font-semibold text-premium-text" : undefined}>
            {product.shop.name}
          </span>
```

- [ ] **Step 4: Mark the premium shop card**

In `components/catalog/shop-card.tsx`, add the same treatment. `CatalogShop` is a full `Shop` row, so the flag is already typed:

```tsx
import { ArrowUpRight, MapPin, Sparkles, Store } from "lucide-react";
```

```tsx
export function PublicShopCard({ shop }: { shop: CatalogShop }) {
  const isPremium = shop.is_premium === true;

  return (
    <Link
      className={`group min-w-[260px] flex-1 overflow-hidden rounded-[1.5rem] border bg-surface ${
        isPremium ? "border-premium-gold" : "border-line"
      }`}
      href={`/tiendas/${shop.slug}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-photo-backdrop">
        {isPremium ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-premium-ink px-2.5 py-1.5 text-xs font-bold text-premium-gold shadow-sm">
            <Sparkles aria-hidden="true" className="size-3" />
            Premium
          </span>
        ) : null}
        {/* …existing CatalogImage… */}
      </div>
```

Leave the card's lower half as it is: the trust badge stays where it is, unchanged.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/catalog/product-card.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/catalog/product-card.tsx components/catalog/product-card.test.tsx components/catalog/shop-card.tsx
git commit -m "feat(catalog): mark distinguished shops in the catalog grid"
```

---

## Task 9: The seller sees the distinction in their workspace

The workspace header carries the badge and a one-line confirmation. The forms below stay in the ordinary theme: they are a work surface, and the seller's public page is where the distinction is meant to be seen.

**Files:**
- Modify: `components/shops/shop-workspace-header.tsx`
- Modify: `app/panel/tiendas/[id]/page.tsx:66`
- Modify: `app/panel/tiendas/[id]/ajustes/page.tsx` (same header call)
- Test: `components/shops/shop-workspace-header.test.tsx`

**Interfaces:**
- Consumes: `PremiumBadge`, `shop.is_premium` from `getOwnedShop` (which selects `*`).
- Produces: `ShopWorkspaceHeader` gains a required-by-caller optional prop `isPremium?: boolean`, defaulting to `false`.

- [ ] **Step 1: Write the failing test**

Add to `components/shops/shop-workspace-header.test.tsx`:

```tsx
it("tells a distinguished seller their shop carries the distinction", () => {
  render(
    <ShopWorkspaceHeader
      active="catalogo"
      isPremium
      shopId={4}
      shopName="Casa Premium"
      shopSlug="casa-premium"
    />,
  );

  expect(screen.getByRole("group", { name: "Tienda Premium" })).toBeInTheDocument();
  expect(screen.getByText(/Plaza Volcanes distinguió tu tienda/)).toBeInTheDocument();
});

it("says nothing about the distinction to an ordinary seller", () => {
  render(
    <ShopWorkspaceHeader
      active="catalogo"
      shopId={4}
      shopName="Casa Niebla"
      shopSlug="casa-niebla"
    />,
  );

  expect(screen.queryByRole("group", { name: "Tienda Premium" })).toBeNull();
});
```

Match the file's existing import and `describe` structure. If the file has no `describe`, write the cases as `test(...)` at top level, as its neighbours do.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shops/shop-workspace-header.test.tsx`
Expected: FAIL — the `isPremium` prop does not exist and no badge renders.

- [ ] **Step 3: Add the note to the header**

In `components/shops/shop-workspace-header.tsx`:

```tsx
import { PremiumBadge } from "@/components/shops/premium-badge";
```

Add `isPremium = false` to the destructured props and its type (`isPremium?: boolean;`), then replace the name block:

```tsx
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-brand">Tu tienda</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{shopName}</h1>
        {isPremium ? (
          <div data-theme="premium">
            <PremiumBadge showDetails={false} />
          </div>
        ) : null}
      </div>
      {isPremium ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Plaza Volcanes distinguió tu tienda. Tu tienda pública y tus productos se
          muestran con el tema Premium.
        </p>
      ) : null}
```

The badge is wrapped in its own `data-theme="premium"` element so its gold reads correctly against the light workspace without theming the forms below.

- [ ] **Step 4: Pass the flag from both workspace routes**

In `app/panel/tiendas/[id]/page.tsx`, the header call becomes:

```tsx
      <ShopWorkspaceHeader active="catalogo" isPremium={shop.is_premium === true} shopId={shopId} shopName={shop.name} shopSlug={shop.slug} />
```

Make the same change in `app/panel/tiendas/[id]/ajustes/page.tsx`, keeping that file's `active="ajustes"` value.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/shops/shop-workspace-header.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/shops/shop-workspace-header.tsx components/shops/shop-workspace-header.test.tsx "app/panel/tiendas/[id]/page.tsx" "app/panel/tiendas/[id]/ajustes/page.tsx"
git commit -m "feat(panel): show the seller the distinction their shop carries"
```

---

## Task 10: Administration grants and withdraws the distinction

**Files:**
- Modify: `lib/actions/admin-publication.ts`
- Modify: `components/admin/marketplace-users.tsx`
- Test: `components/admin/marketplace-users.test.tsx`

**Interfaces:**
- Consumes: `public.set_shop_premium` from Task 2, `AdminMarketplaceShop.isPremium` from Task 3.
- Produces: `setShopPremium(previousState: ActionState, formData: FormData): Promise<ActionState>` exported from `@/lib/actions/admin-publication`, reading `shop_id` and `enabled` form fields exactly like `setShopPublishingApproval`.

- [ ] **Step 1: Write the failing test**

Add to `components/admin/marketplace-users.test.tsx` — extend the hoisted mock first:

```tsx
const { setShopPublishingApproval, setShopPremium, setUserShopLimit } = vi.hoisted(() => ({
  setShopPublishingApproval: vi.fn(),
  setShopPremium: vi.fn(),
  setUserShopLimit: vi.fn(),
}));

vi.mock("@/lib/actions/admin-publication", () => ({
  setShopPublishingApproval,
  setShopPremium,
  setUserShopLimit,
}));
```

Add `vi.mocked(setShopPremium).mockResolvedValue({ status: "idle", message: "" });` to the `beforeEach` block, add `isPremium: false` to every shop fixture in the file, then add the cases:

```tsx
  it("offers administration a switch for the Premium distinction", () => {
    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shopLimit: 3,
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: true,
                isPremium: false,
                products: [],
              },
            ],
          },
        ]}
      />,
    );

    const premiumSwitch = screen.getByRole("switch", { name: "Distinción Premium" });
    expect(premiumSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(premiumSwitch);

    return waitFor(() => expect(setShopPremium).toHaveBeenCalled());
  });

  it("shows a granted distinction as already on", () => {
    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shopLimit: 3,
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: true,
                isPremium: true,
                products: [],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("switch", { name: "Distinción Premium" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/admin/marketplace-users.test.tsx`
Expected: FAIL — no switch named `Distinción Premium`, and `setShopPremium` is not exported.

- [ ] **Step 3: Write the server action**

Append to `lib/actions/admin-publication.ts`, after `setShopPublishingApproval`:

```ts
export async function setShopPremium(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shopId = parseShopId(formData.get("shop_id"));
  const enabled = parseEnabled(formData.get("enabled"));
  if (shopId === null || enabled === null) {
    return {
      status: "error",
      message: "Datos de distinción inválidos.",
      values: formValues(formData),
    };
  }

  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Servicio no configurado." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return {
      status: "error",
      message: "Tu sesión terminó. Ingresa nuevamente.",
      values: formValues(formData),
    };
  }

  const { data: allowed, error: authorizationError } = await supabase.rpc(
    "is_current_user_admin",
  );
  if (authorizationError || !allowed) {
    return {
      status: "error",
      message: "No tienes permiso para administrar la distinción Premium.",
      values: formValues(formData),
    };
  }

  const { data, error } = await supabase.rpc("set_shop_premium", {
    p_shop_id: shopId,
    p_enabled: enabled,
  });
  if (error || !data?.[0]) {
    return {
      status: "error",
      message: "No pudimos actualizar la distinción Premium.",
      values: formValues(formData),
    };
  }

  // The look changes on the shop, on every published product, and on every
  // grid those cards appear in, so the same paths the approval switch clears
  // are cleared here.
  const affected = data[0];
  for (const path of [
    "/",
    "/admin/usuarios",
    `/tiendas/${affected.shop_slug}`,
    ...affected.product_slugs.map((slug) => `/productos/${slug}`),
    "/sitemap.xml",
    `/panel/tiendas/${affected.shop_id}`,
  ]) {
    revalidatePath(path);
  }

  return {
    status: "success",
    message: enabled ? "Distinción Premium otorgada." : "Distinción Premium retirada.",
    values: { enabled: String(enabled) },
  };
}
```

- [ ] **Step 4: Add the switch to the admin screen**

In `components/admin/marketplace-users.tsx`, extend the import:

```tsx
import {
  setShopPremium,
  setShopPublishingApproval,
  setUserShopLimit,
} from "@/lib/actions/admin-publication";
```

Add this component beside `ShopPublishingApproval`:

```tsx
function ShopPremiumDistinction({ shop }: { shop: AdminMarketplaceShop }) {
  const [state, formAction, pending] = useFormAction(setShopPremium);
  const appliedValue = state.status === "success" ? state.values?.enabled : undefined;
  const isPremium =
    appliedValue === "true"
      ? true
      : appliedValue === "false"
        ? false
        : shop.isPremium;

  return (
    <form action={formAction} className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <input name="shop_id" type="hidden" value={shop.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {isPremium ? "Distinción Premium otorgada" : "Sin distinción Premium"}
          </p>
          <p className="mt-1 text-sm text-muted">
            La tienda y sus productos se muestran con el tema Premium. No cambia sus
            métricas de confianza.
          </p>
        </div>
        <button
          aria-checked={isPremium}
          aria-label="Distinción Premium"
          className={`tap-halo relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition ${
            isPremium ? "bg-premium-ink" : "bg-line"
          }`}
          disabled={pending}
          name="enabled"
          role="switch"
          type="submit"
          value={String(!isPremium)}
        >
          <span
            aria-hidden="true"
            className={`size-6 rounded-full shadow transition-transform ${
              isPremium ? "translate-x-7 bg-premium-gold" : "translate-x-1 bg-white"
            }`}
          />
        </button>
      </div>
      {state.message ? (
        <p
          className={`mt-3 text-sm ${state.status === "error" ? "text-sale" : "text-success"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
```

Then render it immediately after `<ShopPublishingApproval shop={shop} />` wherever that appears in the shop list markup.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/admin/marketplace-users.test.tsx && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/actions/admin-publication.ts components/admin/marketplace-users.tsx components/admin/marketplace-users.test.tsx
git commit -m "feat(admin): grant and withdraw the Premium distinction"
```

---

## Task 11: Verification and contrast check

**Files:**
- Modify: any file a failure points at.

**Interfaces:**
- Consumes: everything above.
- Produces: a verified branch.

- [ ] **Step 1: Run the whole suite**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx supabase test db
```

Expected: all pass. Do not proceed while anything fails; fix the cause and re-run.

- [ ] **Step 2: Prove no hardcoded colour survived inside a premium surface**

```bash
grep -rn "bg-\[#\|text-white\|bg-white" app/tiendas app/productos components/catalog components/shops
```

Expected: no hit inside a subtree that renders under `PremiumScope`. `text-white` on the trust tooltip (`components/shops/trust-tier-badge.tsx:28`) sits on `bg-brand-hover`, which in the premium scope becomes light gold — white on light gold fails contrast. Fix it by changing that tooltip's classes to `bg-premium-ink text-[#f5f1ea]` in the premium case, or by giving the tooltip its own token; the same applies to `components/shops/trust-badges.tsx:61` if it renders on a brand fill.

- [ ] **Step 3: Look at the real pages**

Start the app with `npm run dev`, grant a local shop the distinction from `/admin/usuarios`, then open, at both phone and desktop width:
- `/tiendas/<slug>` — obsidian reaches the viewport edges; hero, badges, delivery policy, trust badges, and product grid all legible
- `/productos/<slug>` — gallery, price, add-to-cart, message and share controls all legible
- `/` — the premium card's chip and ring read as intentional next to ordinary cards
- `/panel/tiendas/<id>` — badge and note render on a light workspace

Confirm every text pair meets 4.5:1. Any pair that does not is fixed by adjusting the token value in the scope block, not by overriding a single component.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(theme): keep every premium surface legible"
```

---

## Self-Review Notes

Spec coverage checked section by section: `shops` columns and guard (Task 2), `set_shop_premium` (Task 2), extended admin listing RPC (Task 2), token gaps (Task 1), premium scope and typography (Task 4), focus ring and selection (Task 4), `gold-rule` (Task 4), badge (Task 5), shop page (Task 6), product page (Task 7), catalog cards (Task 8), seller workspace (Task 9), admin control (Task 10), database tests (Task 2), application tests (Tasks 1, 3–10), contrast verification (Task 11).

Naming is consistent across tasks: `is_premium` in SQL and query rows, `isPremium` in mapped and component types, `PremiumScope`, `PremiumBadge`, `setShopPremium`, tokens `--premium-gold` / `--premium-ink` / `--premium-text`, and the Fraunces variable `--font-fraunces-variable` bound to `--font-display` only inside the scope.
