# Super Admin Marketplace View — Design Specification

## Objective

Give existing administrators a read-only view of every person who has signed up to Plaza Volcanes, their shops, and each shop's draft or published product listings. Bootstrap `bsorianodev@gmail.com` as the first member of the existing administrator role.

## Scope

This project includes:

- Administrator membership for `bsorianodev@gmail.com`, using the existing `private.admin_users` table and `public.is_current_user_admin()` authorization boundary
- A database-owned read path for administrator access to account email addresses, signup dates, display names, shops, and draft or published products
- A protected `/admin/usuarios` page that groups marketplace activity by user and shop
- Navigation between the new user view and the existing `/admin/disputas` view
- Database and application tests for authorization, data visibility, grouping, and rendering

This project excludes:

- A new role or permission system
- Creating, granting, revoking, or otherwise managing administrators from the application
- Editing, publishing, expiring, or deleting shops and products from the administrator view
- Account suspension, deletion, impersonation, or password management
- Search, filtering, sorting controls, or pagination
- Expired and deleted products
- Changes to existing dispute or legal-publication powers

## Administrator Bootstrap

`private.admin_users` remains the only administrator-membership source. No `super_admin` role, JWT claim, public profile flag, or user-editable metadata is introduced.

The migration resolves the existing `auth.users` row whose normalized email is `bsorianodev@gmail.com`, then inserts that user's id into `private.admin_users` with the same id as `granted_by`. Email matching uses `lower(btrim(email))`, and the insert is idempotent. Existing `audit_admin_membership` behavior records the grant.

The user confirmed this account already exists in the target Supabase project. If it does not exist in another environment, the migration raises an explicit exception instead of succeeding without an administrator or creating a future email-based grant path.

No signup trigger is added. Local Supabase configuration has email confirmation disabled, so automatically granting administrator access to a future signup based only on its submitted email would allow privileged access before inbox ownership is proven. Recreating the account later requires a new, explicit administrator grant.

## Data Access Boundary

Account emails live in `auth.users`; browser roles must not receive direct table access or a service-role key. Draft products are likewise not made generally visible through a broader product select policy.

A new `public.list_admin_marketplace_users()` RPC is the sole read path for this view. It is:

- `stable`
- `security definer`
- declared with `set search_path = ''`
- revoked from `public` and `anon`
- executable by `authenticated`
- guarded at the start with `public.is_current_user_admin()`

A non-administrator receives SQLSTATE `42501` before account data is queried. The function returns a flat relation with these columns:

```text
user_id uuid
email text
user_created_at timestamptz
display_name text nullable
shop_id bigint nullable
shop_name text nullable
shop_slug text nullable
shop_created_at timestamptz nullable
product_id bigint nullable
product_name text nullable
product_slug text nullable
product_status text nullable
product_created_at timestamptz nullable
product_updated_at timestamptz nullable
```

The query begins at `auth.users`, left joins `public.user_display_names`, `public.shops`, and `public.products`, and includes products only when `status in ('draft', 'published')`. Left joins preserve users without shops and shops without included products. Rows sort by newest user first, then newest shop, then newest product, with stable id tie-breakers.

This function exposes only fields needed by the approved view. It excludes phone numbers, addresses, buyer trust evidence, orders, conversations, messages, product descriptions, prices, inventory, and other private or operational data.

## Application Data Model

`lib/queries/admin.ts` owns RPC row types, nested view types, and a pure mapper:

```text
AdminMarketplaceUser
  id, email, displayName, createdAt
  shops[]
    id, name, slug, createdAt
    products[]
      id, name, slug, status, createdAt, updatedAt
```

The mapper folds repeated flat rows into users, shops, and products while preserving database order. It never creates a placeholder shop or product from nullable left-join columns.

`lib/queries/admin.server.ts` retains existing dispute access and adds `getAdminMarketplaceUsers()`. It calls `list_admin_marketplace_users`, throws when Supabase returns an error, and delegates grouping to the pure mapper. It does not silently return an empty list on authorization or query failure.

Generated/manual `Database` types gain the RPC signature so application code does not use an untyped escape hatch.

## Routes and UI

`app/admin/layout.tsx` remains the route-level authorization gate. Signed-out visitors keep the existing redirect to `/ingresar?continuar=/admin/disputas`; authenticated non-administrators are redirected to `/panel`. Existing behavior for `/admin/disputas` remains intact, and authenticated administrators can reach the new page through admin navigation.

The shared administrator layout adds compact navigation:

- `Usuarios` → `/admin/usuarios`
- `Disputas` → `/admin/disputas`

`app/admin/usuarios/page.tsx` renders a read-only server page in Spanish. It shows:

- Heading and short explanation of included data
- Total signed-up user count
- One user card per account with email, optional display name, and signup date
- Nested shop sections with shop name, creation date, and public shop link
- Nested product rows with product name, creation/update dates, and `Borrador` or `Publicado` status badge
- Public product links for published products only; draft products remain plain text because no public route should reveal them
- Explicit empty states for no users, a user without shops, and a shop without draft or published products

No client component, mutation, modal, or form is needed.

## Error Handling

- Route authorization runs before page data access.
- RPC authorization repeats the check at the database boundary; layout protection is not treated as sufficient authorization.
- Supabase RPC errors are thrown from the server query and reach the normal Next.js error path. Failure never appears as "no users."
- Nullable left-join fields are validated structurally by the mapper. A partial shop or product row is ignored rather than rendered as a malformed entity.
- Missing Supabase configuration keeps existing administrator-layout redirect behavior.

## Testing

### Database

A pgTAP test covers:

- Existing `bsorianodev@gmail.com` account receives administrator membership when migration runs
- Migration fails explicitly when the bootstrap account is absent
- Other accounts do not receive membership
- Non-administrator RPC call fails with `42501`
- Administrator call returns every auth user, including a user with no shop
- Shops with no draft or published products remain present
- Draft and published products are returned
- Expired and deleted products are excluded
- Returned rows do not contain unapproved sensitive fields

### Unit and component

Vitest covers:

- Flat rows group into users, shops, and products without duplication
- Users without shops and shops without products map correctly
- Database ordering remains stable after grouping
- Administrator page renders email, display name, dates, shop links, product names, and localized status badges
- Draft products do not receive public links
- Empty states render at all three levels
- Admin layout keeps signed-out and non-admin redirect behavior

### Verification gates

- Focused Vitest files
- Supabase database tests
- `npm run typecheck`
- `npm run lint`
- Full `npm test`

## Acceptance Criteria

- Signing in as `bsorianodev@gmail.com` permits access to `/admin/usuarios` through existing administrator authorization.
- Any signed-out or non-administrator visitor cannot obtain account emails or draft product data from page or RPC.
- Page lists all signed-up users, including users without shops.
- Each user's shops appear under correct account.
- Each shop's draft and published products appear under correct shop with clear Spanish status.
- Expired and deleted products do not appear.
- View is read-only and adds no administrator-management or marketplace-mutation capability.

## Rejected Alternatives

### Broader product RLS plus separate queries

Adding administrator branches to product policies and fetching accounts, shops, and products separately would make draft visibility available through every authenticated Supabase client query made by an administrator. It also creates multiple query and grouping paths. One purpose-built RPC exposes less data through a smaller interface.

### Service-role server client

A service-role client would bypass RLS and make application code the primary security boundary. The repository currently uses the publishable key and database authorization for user-facing server work. Adding a privileged secret for one read-only page creates unnecessary blast radius.

### New super-administrator role

Current requirements explicitly choose the existing administrator role. A second role would add membership storage, authorization logic, provisioning, and audit semantics without granting any requested behavior.
