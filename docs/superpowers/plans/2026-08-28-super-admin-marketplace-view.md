# Super Admin Marketplace View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give existing administrators a read-only page showing every signed-up user, their shops, and each shop's draft or published products, while bootstrapping `bsorianodev@gmail.com` into the existing administrator role.

**Architecture:** Keep the authoritative sensitive-read check inside Postgres. An operator-only bootstrap helper grants the one existing account, and one authenticated admin-only RPC returns flat account/shop/product rows; pure TypeScript groups them for a server-rendered Next.js page. A server-only, React-cached `requireAdmin()` DAL centralizes the same application redirects and is awaited by both the shared admin layout and the users leaf page before its sensitive query, because layouts do not serialize child route rendering.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript, Supabase Auth/Postgres/PostgREST, pgTAP, Vitest, Testing Library, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-08-28-super-admin-marketplace-view-design.md`

## Global Constraints

- Reuse `private.admin_users` and `public.is_current_user_admin()`; do not add a new role or JWT authorization claim.
- Read-only view. Add no admin, account, shop, or product mutations.
- Return only account id/email/signup date/display name, shop id/name/slug/date, and product id/name/slug/status/created/updated dates.
- Include only product statuses `draft` and `published`; preserve users without shops and shops without included products.
- Never expose a Supabase secret/service-role key.
- Await the cached administrator DAL at every sensitive leaf before starting its query; do not treat layout execution as the sole application authorization boundary.
- Every `security definer` function uses `set search_path = ''`, schema-qualifies every object, revokes execution from `public` and `anon`, and grants only explicitly required roles.
- No signup-based admin trigger. Local email confirmation is disabled.
- Preserve unrelated dirty-worktree changes and stage only files named by each task.
- Follow current Supabase function/grant guidance and local Next.js 16 authentication/redirect docs before editing.

## File Map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/*_add_admin_marketplace_view.sql` | Operator-only bootstrap helper and admin-only marketplace RPC; exact timestamp generated through Supabase CLI diff workflow. |
| `supabase/tests/database/admin_marketplace_users.test.sql` | pgTAP authorization, bootstrap, inclusion, exclusion, and nullable-parent coverage. |
| `lib/queries/admin.ts` | RPC row types, nested view types, pure flat-row grouper. |
| `lib/queries/admin.test.ts` | Grouper order, deduplication, and empty-child tests. |
| `lib/database.types.ts` | Typed `list_admin_marketplace_users` RPC contract. |
| `lib/admin-auth.server.ts` | Server-only cached administrator DAL with the existing exact redirects and database membership check. |
| `lib/admin-auth.server.test.ts` | Unconfigured, anonymous, non-admin, and authorized DAL behavior. |
| `lib/queries/admin.server.ts` | Existing dispute query plus `getAdminMarketplaceUsers()`. |
| `lib/queries/admin.server.test.ts` | RPC success/error/config behavior. |
| `components/admin/marketplace-users.tsx` | Read-only nested administrator view. |
| `components/admin/marketplace-users.test.tsx` | User/shop/product rendering and empty states. |
| `app/admin/usuarios/page.tsx` | Leaf authorization before server fetch and composition. |
| `app/admin/usuarios/page.test.tsx` | Composed authorization-to-query ordering and authorized page wiring. |
| `app/admin/layout.tsx` | Cached DAL invocation plus shared admin navigation. |
| `app/admin/layout.test.tsx` | Signed-out/non-admin redirects and admin navigation. |

---

### Task 1: Database bootstrap and least-privilege read RPC

**Files:**
- Create: `supabase/tests/database/admin_marketplace_users.test.sql`
- Create via `supabase db pull add_admin_marketplace_view --local`: `supabase/migrations/*_add_admin_marketplace_view.sql`

**Interfaces:**
- Produces: `private.bootstrap_initial_admin() returns boolean`
- Produces: `public.list_admin_marketplace_users() returns table (...)`
- Security contract: only `authenticated` can execute public RPC, and function body admits only existing administrators.

- [ ] **Step 1: Write failing pgTAP coverage**

Create `supabase/tests/database/admin_marketplace_users.test.sql` with transaction-scoped fixtures. Use fixed ids and explicit dates so ordering assertions remain deterministic:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_function('private', 'bootstrap_initial_admin', array[]::text[],
  'operator-only bootstrap helper exists');
select has_function('public', 'list_admin_marketplace_users', array[]::text[],
  'administrator marketplace RPC exists');

insert into auth.users (id, email, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'bsorianodev@gmail.com', '2026-08-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'seller@test.local', '2026-08-02T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'empty@test.local', '2026-08-03T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', 'member@test.local', '2026-08-04T00:00:00Z');

insert into public.user_display_names (user_id, display_name)
values ('10000000-0000-4000-8000-000000000002', 'María Taller');

select ok(private.bootstrap_initial_admin(), 'existing bootstrap account is granted');
select isnt_empty(
  $$select 1 from private.admin_users where user_id = '10000000-0000-4000-8000-000000000001'$$,
  'bootstrap membership uses existing administrator table'
);
select is(
  (select count(*) from private.admin_users
   where user_id <> '10000000-0000-4000-8000-000000000001')::integer,
  0,
  'bootstrap does not grant another account'
);

insert into public.shops (id, owner_id, name, slug, description, created_at)
overriding system value
values
  (9101, '10000000-0000-4000-8000-000000000002', 'Taller Volcán', 'taller-volcan',
   'Taller de prueba con productos en distintos estados.', '2026-08-05T00:00:00Z'),
  (9102, '10000000-0000-4000-8000-000000000004', 'Tienda Vacía', 'tienda-vacia',
   'Tienda de prueba sin productos visibles para administración.', '2026-08-06T00:00:00Z');

insert into public.products
  (id, shop_id, name, slug, description, price_mxn, status, created_at, updated_at)
overriding system value
values
  (9201, 9101, 'Borrador visible', 'borrador-visible',
   'Descripción suficientemente larga para producto de prueba.', 100, 'draft',
   '2026-08-07T00:00:00Z', '2026-08-08T00:00:00Z'),
  (9202, 9101, 'Publicado visible', 'publicado-visible',
   'Descripción suficientemente larga para producto de prueba.', 200, 'published',
   '2026-08-09T00:00:00Z', '2026-08-10T00:00:00Z'),
  (9203, 9101, 'Vencido oculto', 'vencido-oculto',
   'Descripción suficientemente larga para producto de prueba.', 300, 'expired',
   '2026-08-11T00:00:00Z', '2026-08-12T00:00:00Z'),
  (9204, 9101, 'Eliminado oculto', 'eliminado-oculto',
   'Descripción suficientemente larga para producto de prueba.', 400, 'deleted',
   '2026-08-13T00:00:00Z', '2026-08-14T00:00:00Z');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$select * from public.list_admin_marketplace_users()$$,
  '42501', null, 'non-administrator cannot read account marketplace data'
);

set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq(
  $$select distinct email from public.list_admin_marketplace_users() order by email$$,
  $$values ('bsorianodev@gmail.com'::text), ('empty@test.local'::text),
           ('member@test.local'::text), ('seller@test.local'::text)$$,
  'administrator sees every signed-up user'
);
select results_eq(
  $$select display_name from public.list_admin_marketplace_users()
    where email = 'seller@test.local' limit 1$$,
  array['María Taller'::text], 'display name is returned when present'
);
select isnt_empty(
  $$select 1 from public.list_admin_marketplace_users()
    where email = 'empty@test.local' and shop_id is null$$,
  'user without a shop remains present'
);
select isnt_empty(
  $$select 1 from public.list_admin_marketplace_users()
    where shop_id = 9102 and product_id is null$$,
  'shop without included products remains present'
);
select results_eq(
  $$select product_status from public.list_admin_marketplace_users()
    where shop_id = 9101 order by product_created_at$$,
  $$values ('draft'::text), ('published'::text)$$,
  'draft and published products are returned'
);
select is_empty(
  $$select 1 from public.list_admin_marketplace_users() where product_id in (9203, 9204)$$,
  'expired and deleted products are excluded'
);
select results_eq(
  $$select email from public.list_admin_marketplace_users()
    group by user_id, email, user_created_at order by user_created_at desc, user_id$$,
  $$values ('member@test.local'::text), ('empty@test.local'::text),
           ('seller@test.local'::text), ('bsorianodev@gmail.com'::text)$$,
  'users return newest first with stable ordering'
);
select is(
  has_function_privilege('anon', 'public.list_admin_marketplace_users()', 'EXECUTE'),
  false, 'anonymous role cannot execute RPC'
);
select is(
  has_function_privilege('authenticated', 'private.bootstrap_initial_admin()', 'EXECUTE'),
  false, 'browser roles cannot invoke bootstrap helper'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test and confirm missing-function failure**

Run:

```bash
supabase test db supabase/tests/database/admin_marketplace_users.test.sql --local
```

Expected: FAIL because `private.bootstrap_initial_admin()` and `public.list_admin_marketplace_users()` do not exist.

- [ ] **Step 3: Apply exact SQL to local database for iteration**

Use `supabase db query --local` with this SQL body (pass through a temporary task-scoped SQL file if shell quoting becomes unsafe):

```sql
create function private.bootstrap_initial_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id
  from auth.users u
  where lower(btrim(u.email)) = 'bsorianodev@gmail.com';

  if v_user_id is null then
    return false;
  end if;

  insert into private.admin_users (user_id, granted_by)
  values (v_user_id, v_user_id)
  on conflict (user_id) do nothing;

  return true;
end;
$$;

revoke all on function private.bootstrap_initial_admin() from public, anon, authenticated;

do $$
begin
  if not private.bootstrap_initial_admin() then
    raise notice 'Bootstrap admin bsorianodev@gmail.com does not exist in auth.users.';
  end if;
end;
$$;

create function public.list_admin_marketplace_users()
returns table (
  user_id uuid,
  email text,
  user_created_at timestamptz,
  display_name text,
  shop_id bigint,
  shop_name text,
  shop_slug text,
  shop_created_at timestamptz,
  product_id bigint,
  product_name text,
  product_slug text,
  product_status text,
  product_created_at timestamptz,
  product_updated_at timestamptz
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
    s.id,
    s.name,
    s.slug,
    s.created_at,
    p.id,
    p.name,
    p.slug,
    p.status,
    p.created_at,
    p.updated_at
  from auth.users u
  left join public.user_display_names d on d.user_id = u.id
  left join public.shops s on s.owner_id = u.id
  left join public.products p
    on p.shop_id = s.id and p.status in ('draft', 'published')
  order by u.created_at desc, u.id, s.created_at desc nulls last, s.id,
           p.created_at desc nulls last, p.id;
end;
$$;

revoke all on function public.list_admin_marketplace_users() from public, anon;
grant execute on function public.list_admin_marketplace_users() to authenticated;
```

- [ ] **Step 4: Run focused database test**

Run:

```bash
supabase test db supabase/tests/database/admin_marketplace_users.test.sql --local
```

Expected: `15` tests pass.

- [ ] **Step 5: Run database advisors before generating migration**

Run:

```bash
supabase db advisors --local --type security --level warn --fail-on error
supabase db advisors --local --type performance --level warn --fail-on error
```

Expected: no new error attributable to these functions.

- [ ] **Step 6: Generate and inspect clean migration**

Run:

```bash
supabase db pull add_admin_marketplace_view --local --yes
supabase migration list --local
```

Expected: one CLI-timestamped migration containing only bootstrap/RPC SQL and current migration list aligned locally. Add rollback comments revoking/dropping `public.list_admin_marketplace_users()` then `private.bootstrap_initial_admin()`.

- [ ] **Step 7: Reset and prove migration from scratch**

Run:

```bash
supabase db reset --local
supabase test db supabase/tests/database/admin_marketplace_users.test.sql --local
```

Expected: reset succeeds when bootstrap account is absent, migration emits notice, then all `15` pgTAP assertions pass after test fixtures are inserted.

- [ ] **Step 8: Commit database slice**

```bash
git add supabase/migrations/*_add_admin_marketplace_view.sql supabase/tests/database/admin_marketplace_users.test.sql
git commit -m "feat(admin): add marketplace user read model"
```

---

### Task 2: Pure nested marketplace mapper

**Files:**
- Create: `lib/queries/admin.ts`
- Create: `lib/queries/admin.test.ts`

**Interfaces:**
- Produces: `AdminMarketplaceRpcRow`
- Produces: `AdminMarketplaceUser`, `AdminMarketplaceShop`, `AdminMarketplaceProduct`
- Produces: `mapAdminMarketplaceUsers(rows: AdminMarketplaceRpcRow[]): AdminMarketplaceUser[]`

- [ ] **Step 1: Write failing mapper tests**

Cover one user with two products, repeated user/shop fields, user with `shop_id: null`, shop with `product_id: null`, and two users in supplied order. Assert exact nested output and no duplicate shop/product entries.

```ts
import { describe, expect, it } from "vitest";

import {
  mapAdminMarketplaceUsers,
  type AdminMarketplaceRpcRow,
} from "@/lib/queries/admin";

const base: AdminMarketplaceRpcRow = {
  user_id: "user-1",
  email: "seller@test.local",
  user_created_at: "2026-08-03T00:00:00.000Z",
  display_name: "María Taller",
  shop_id: 10,
  shop_name: "Taller Volcán",
  shop_slug: "taller-volcan",
  shop_created_at: "2026-08-04T00:00:00.000Z",
  product_id: 20,
  product_name: "Taza",
  product_slug: "taza",
  product_status: "published",
  product_created_at: "2026-08-05T00:00:00.000Z",
  product_updated_at: "2026-08-06T00:00:00.000Z",
};

describe("mapAdminMarketplaceUsers", () => {
  it("groups repeated flat rows without duplicating users or shops", () => {
    const users = mapAdminMarketplaceUsers([
      base,
      { ...base, product_id: 21, product_name: "Plato", product_slug: "plato", product_status: "draft" },
    ]);

    expect(users).toHaveLength(1);
    expect(users[0]?.shops).toHaveLength(1);
    expect(users[0]?.shops[0]?.products.map((product) => product.id)).toEqual([20, 21]);
  });

  it("preserves users without shops and shops without products", () => {
    const users = mapAdminMarketplaceUsers([
      { ...base, user_id: "user-2", email: null, shop_id: null, shop_name: null,
        shop_slug: null, shop_created_at: null, product_id: null, product_name: null,
        product_slug: null, product_status: null, product_created_at: null,
        product_updated_at: null },
      { ...base, product_id: null, product_name: null, product_slug: null,
        product_status: null, product_created_at: null, product_updated_at: null },
    ]);

    expect(users[0]).toMatchObject({ id: "user-2", email: null, shops: [] });
    expect(users[1]?.shops[0]?.products).toEqual([]);
  });

  it("keeps first-seen database order", () => {
    const second = { ...base, user_id: "user-2", email: "second@test.local" };
    expect(mapAdminMarketplaceUsers([second, base]).map((user) => user.id))
      .toEqual(["user-2", "user-1"]);
  });
});
```

- [ ] **Step 2: Run tests and confirm module failure**

```bash
npx vitest run lib/queries/admin.test.ts
```

Expected: FAIL because `lib/queries/admin.ts` does not exist.

- [ ] **Step 3: Implement minimal types and grouper**

Define status as `"draft" | "published"`. Treat email as `string | null`. Create users and shops only when every required left-join field is present; create products only when every required product field and supported status is present. Use `Map` objects keyed by user id, `${user_id}:${shop_id}`, and `${shop_id}:${product_id}` so duplicate rows cannot duplicate entities while array insertion preserves first-seen order.

Core signature:

```ts
export function mapAdminMarketplaceUsers(
  rows: AdminMarketplaceRpcRow[],
): AdminMarketplaceUser[] {
  const users: AdminMarketplaceUser[] = [];
  const usersById = new Map<string, AdminMarketplaceUser>();
  const shopsByKey = new Map<string, AdminMarketplaceShop>();
  const productKeys = new Set<string>();

  for (const row of rows) {
    let user = usersById.get(row.user_id);
    if (!user) {
      user = {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.user_created_at,
        shops: [],
      };
      usersById.set(row.user_id, user);
      users.push(user);
    }

    if (row.shop_id === null || row.shop_name === null ||
        row.shop_slug === null || row.shop_created_at === null) continue;

    const shopKey = `${row.user_id}:${row.shop_id}`;
    let shop = shopsByKey.get(shopKey);
    if (!shop) {
      shop = { id: row.shop_id, name: row.shop_name, slug: row.shop_slug,
        createdAt: row.shop_created_at, products: [] };
      shopsByKey.set(shopKey, shop);
      user.shops.push(shop);
    }

    if (row.product_id === null || row.product_name === null ||
        row.product_slug === null || row.product_created_at === null ||
        row.product_updated_at === null ||
        (row.product_status !== "draft" && row.product_status !== "published")) continue;

    const productKey = `${row.shop_id}:${row.product_id}`;
    if (!productKeys.has(productKey)) {
      productKeys.add(productKey);
      shop.products.push({ id: row.product_id, name: row.product_name,
        slug: row.product_slug, status: row.product_status,
        createdAt: row.product_created_at, updatedAt: row.product_updated_at });
    }
  }

  return users;
}
```

- [ ] **Step 4: Run mapper tests**

```bash
npx vitest run lib/queries/admin.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit mapper slice**

```bash
git add lib/queries/admin.ts lib/queries/admin.test.ts
git commit -m "feat(admin): group marketplace users"
```

---

### Task 3: Typed server query

**Files:**
- Modify: `lib/database.types.ts` under `public.Functions`
- Modify: `lib/queries/admin.server.ts`
- Create: `lib/queries/admin.server.test.ts`

**Interfaces:**
- Consumes: `public.list_admin_marketplace_users()` RPC
- Consumes: `mapAdminMarketplaceUsers()`
- Produces: `getAdminMarketplaceUsers(): Promise<AdminMarketplaceUser[]>`

- [ ] **Step 1: Write failing server-query tests**

Mock `isSupabaseConfigured`, `createServerSupabaseClient`, and `mapAdminMarketplaceUsers`. Assert:

```ts
it("returns grouped RPC data", async () => {
  rpc.mockResolvedValue({ data: [row], error: null });
  expect(await getAdminMarketplaceUsers()).toEqual(grouped);
  expect(rpc).toHaveBeenCalledWith("list_admin_marketplace_users");
  expect(mapAdminMarketplaceUsers).toHaveBeenCalledWith([row]);
});

it("throws instead of rendering a query failure as an empty list", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });
  await expect(getAdminMarketplaceUsers())
    .rejects.toThrow("No pudimos consultar los usuarios de la plataforma.");
});
```

Also assert unconfigured Supabase returns `[]` without creating a client, matching existing query-module behavior.

- [ ] **Step 2: Run focused test and confirm export/type failure**

```bash
npx vitest run lib/queries/admin.server.test.ts
```

Expected: FAIL because `getAdminMarketplaceUsers` and RPC type are absent.

- [ ] **Step 3: Add exact RPC type**

Under `Database["public"]["Functions"]` add:

```ts
list_admin_marketplace_users: {
  Args: Record<never, never>;
  Returns: {
    user_id: string;
    email: string | null;
    user_created_at: string;
    display_name: string | null;
    shop_id: number | null;
    shop_name: string | null;
    shop_slug: string | null;
    shop_created_at: string | null;
    product_id: number | null;
    product_name: string | null;
    product_slug: string | null;
    product_status: string | null;
    product_created_at: string | null;
    product_updated_at: string | null;
  }[];
};
```

- [ ] **Step 4: Implement server query**

Append to `lib/queries/admin.server.ts`:

```ts
export async function getAdminMarketplaceUsers(): Promise<AdminMarketplaceUser[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_admin_marketplace_users");

  if (error) {
    throw new Error("No pudimos consultar los usuarios de la plataforma.");
  }

  return mapAdminMarketplaceUsers(data ?? []);
}
```

Import `AdminMarketplaceUser` and `mapAdminMarketplaceUsers` from `@/lib/queries/admin`.

- [ ] **Step 5: Run tests and typecheck**

```bash
npx vitest run lib/queries/admin.server.test.ts lib/queries/admin.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit server query slice**

```bash
git add lib/database.types.ts lib/queries/admin.server.ts lib/queries/admin.server.test.ts
git commit -m "feat(admin): fetch marketplace users"
```

---

### Task 4: Read-only nested users UI and page

**Files:**
- Create: `components/admin/marketplace-users.tsx`
- Create: `components/admin/marketplace-users.test.tsx`
- Create: `app/admin/usuarios/page.tsx`
- Create: `app/admin/usuarios/page.test.tsx`

**Interfaces:**
- Consumes: `AdminMarketplaceUser[]`
- Consumes: cached `requireAdmin()`
- Consumes: `getAdminMarketplaceUsers()`
- Produces: `<MarketplaceUsers users={users} />`

- [ ] **Step 1: Write failing component tests**

Use one user with display name, one published and one draft product, one user without email/shops, and one shop without products. Assert:

- Total copy says `2 personas registradas`.
- Email and display name render.
- Shop link is `/tiendas/taller-volcan`.
- Published product link is `/productos/taza`.
- Draft product name renders without a link.
- `Publicado` and `Borrador` badges render through `StatusBadge`.
- `Sin correo registrado`, `Sin tiendas`, and `Sin borradores ni publicaciones` render for empty levels.
- Empty `users` renders `No hay personas registradas`.

- [ ] **Step 2: Write failing page authorization and wiring tests**

Mock `requireAdmin` and `getAdminMarketplaceUsers`. First reject authorization, assert the page rejects, and prove `getAdminMarketplaceUsers` is never called. Then authorize, render `await AdminUsersPage()`, assert the returned user email appears, and verify both authorization and query are called once.

- [ ] **Step 3: Run tests and confirm missing-module failures**

```bash
npx vitest run components/admin/marketplace-users.test.tsx app/admin/usuarios/page.test.tsx
```

Expected: FAIL because component and page do not exist.

- [ ] **Step 4: Implement server-rendered nested component**

Use semantic `section`, `article`, headings, and lists. Reuse `formatDate`, `StatusBadge`, `EmptyState`, and `Link`. Published products receive links; drafts use `<span>`. Keep all copy Spanish and all data read-only.

Implement this complete component shape, adjusting only class names when tests retain semantics and copy:

```tsx
import Link from "next/link";
import { UsersRound } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { AdminMarketplaceUser } from "@/lib/queries/admin";

export function MarketplaceUsers({ users }: { users: AdminMarketplaceUser[] }) {
  if (!users.length) {
    return (
      <EmptyState
        icon={<UsersRound aria-hidden="true" className="size-7" />}
        title="No hay personas registradas"
        description="Las cuentas nuevas aparecerán aquí."
      />
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted">
        {users.length} {users.length === 1 ? "persona registrada" : "personas registradas"}
      </p>
      {users.map((user) => (
        <article className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8" key={user.id}>
          <h2 className="font-display text-2xl font-semibold">
            {user.displayName ?? user.email ?? "Cuenta sin nombre"}
          </h2>
          <p className="mt-1 text-sm text-muted">{user.email ?? "Sin correo registrado"}</p>
          <p className="mt-1 text-sm text-muted">Registro: {formatDate(user.createdAt)}</p>
          {user.shops.length ? (
            <div className="mt-6 space-y-4">
              {user.shops.map((shop) => (
                <section className="rounded-2xl bg-background p-5" key={shop.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-semibold">
                        <Link className="text-brand underline-offset-4 hover:underline" href={`/tiendas/${shop.slug}`}>
                          {shop.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-muted">Creada: {formatDate(shop.createdAt)}</p>
                    </div>
                  </div>
                  {shop.products.length ? (
                    <ul className="mt-4 divide-y divide-line">
                      {shop.products.map((product) => (
                        <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={product.id}>
                          <div>
                            <h4 className="font-semibold">
                              {product.status === "published" ? (
                                <Link className="text-brand underline-offset-4 hover:underline" href={`/productos/${product.slug}`}>
                                  {product.name}
                                </Link>
                              ) : (
                                <span>{product.name}</span>
                              )}
                            </h4>
                            <p className="mt-1 text-xs text-muted">
                              Creado: {formatDate(product.createdAt)} · Actualizado: {formatDate(product.updatedAt)}
                            </p>
                          </div>
                          <StatusBadge status={product.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted">Sin borradores ni publicaciones</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-background p-5 text-sm text-muted">Sin tiendas</p>
          )}
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement page composition**

```tsx
import { MarketplaceUsers } from "@/components/admin/marketplace-users";
import { requireAdmin } from "@/lib/admin-auth.server";
import { getAdminMarketplaceUsers } from "@/lib/queries/admin.server";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await getAdminMarketplaceUsers();

  return (
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Administración</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Usuarios y publicaciones</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        Consulta cuentas registradas, sus tiendas y publicaciones activas o en borrador.
      </p>
      <MarketplaceUsers users={users} />
    </section>
  );
}
```

- [ ] **Step 6: Run UI tests**

```bash
npx vitest run components/admin/marketplace-users.test.tsx app/admin/usuarios/page.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit UI slice**

```bash
git add components/admin/marketplace-users.tsx components/admin/marketplace-users.test.tsx app/admin/usuarios/page.tsx app/admin/usuarios/page.test.tsx
git commit -m "feat(admin): show users shops and products"
```

---

### Task 5: Shared admin navigation and complete verification

**Files:**
- Create: `lib/admin-auth.server.ts`
- Create: `lib/admin-auth.server.test.ts`
- Modify: `app/admin/layout.tsx`
- Create: `app/admin/layout.test.tsx`

**Interfaces:**
- Consumes: existing Supabase configuration, auth claims, and `is_current_user_admin()` RPC
- Produces: server-only React-cached `requireAdmin()` used by the layout and sensitive leaf page
- Produces: shared `Usuarios` and `Disputas` navigation for authorized administrators

- [ ] **Step 1: Write failing DAL and layout tests**

Mock `next/navigation.redirect`, Supabase config/client, and RPC responses. Cover the exact three redirects and the authorized return in `lib/admin-auth.server.test.ts`. Keep the layout composition assertions, including:

```ts
await expect(AdminLayout({ children: <p>Privado</p> }))
  .rejects.toThrow("REDIRECT");
expect(redirect).toHaveBeenCalledWith("/ingresar?continuar=/admin/disputas");
```

For authenticated non-admin, expect `/panel`. For authenticated admin, render returned JSX and assert links:

```ts
expect(screen.getByRole("link", { name: "Usuarios" }))
  .toHaveAttribute("href", "/admin/usuarios");
expect(screen.getByRole("link", { name: "Disputas" }))
  .toHaveAttribute("href", "/admin/disputas");
expect(screen.getByText("Privado")).toBeInTheDocument();
```

- [ ] **Step 2: Run layout test and confirm missing-navigation failure**

```bash
npx vitest run app/admin/layout.test.tsx
```

Expected: redirect tests pass; authorized-admin navigation assertions fail.

- [ ] **Step 3: Add cached DAL and shared navigation after authorization**

Move the existing exact checks into server-only `requireAdmin()` wrapped in React `cache()`. Await it from both the layout and users leaf page, with the leaf call before `getAdminMarketplaceUsers()`. Import `Link` from `next/link` and return a wrapper containing:

```tsx
<nav aria-label="Administración" className="mx-auto flex max-w-6xl gap-2 px-5 pt-6 sm:px-8">
  <Link className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/usuarios">
    Usuarios
  </Link>
  <Link className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-brand" href="/admin/disputas">
    Disputas
  </Link>
</nav>
{children}
```

- [ ] **Step 4: Run focused feature suite**

```bash
npx vitest run \
  lib/admin-auth.server.test.ts \
  lib/queries/admin.test.ts \
  lib/queries/admin.server.test.ts \
  components/admin/marketplace-users.test.tsx \
  app/admin/usuarios/page.test.tsx \
  app/admin/layout.test.tsx
supabase test db supabase/tests/database/admin_marketplace_users.test.sql --local
```

Expected: all focused tests pass.

- [ ] **Step 5: Run repository gates**

```bash
npm run typecheck
npm run lint
npm test
supabase db advisors --local --type security --level warn --fail-on error
supabase db advisors --local --type performance --level warn --fail-on error
git diff --check
```

Expected: commands pass. If unrelated pre-existing dirty-worktree changes fail a broad gate, capture exact failing test/file and prove feature-focused gates independently; do not edit unrelated files.

- [ ] **Step 6: Verify target bootstrap membership**

After applying migration to target project through normal deployment, run an operator-side read-only check:

```sql
select exists (
  select 1
  from private.admin_users a
  join auth.users u on u.id = a.user_id
  where lower(btrim(u.email)) = 'bsorianodev@gmail.com'
) as bootstrap_admin_exists;
```

Expected: `true`. Do not expose query result through application UI.

- [ ] **Step 7: Commit navigation and verification slice**

```bash
git add lib/admin-auth.server.ts lib/admin-auth.server.test.ts app/admin/layout.tsx app/admin/layout.test.tsx app/admin/usuarios/page.tsx app/admin/usuarios/page.test.tsx
git commit -m "fix(admin): authorize users before sensitive query"
```

- [ ] **Step 8: Stop at approved scope**

Confirm no role-management UI, mutations, search, pagination, expired/deleted listings, service-role client, or signup trigger entered diff. Report any omitted verification caused by unavailable local Supabase/Docker separately.
